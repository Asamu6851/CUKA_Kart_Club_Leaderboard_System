import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  InternalServerErrorException,
  Injectable,
  UnauthorizedException
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { ApprovalStatus, RoleCode, UserStatus } from "@prisma/client";
import type { StringValue } from "ms";

import { PrismaService } from "src/prisma/prisma.service";

import type { AuthenticatedRequestUser, AuthTokenPayload } from "./auth.types";
import { authUserInclude } from "./auth.types";
import {
  assertUserCanLogin,
  buildAuthUserResponse,
  createPasswordRecord,
  hashRefreshToken,
  normalizeUsername,
  verifyPassword
} from "./auth.utils";
import { LoginDto } from "./dto/login.dto";
import { LogoutDto } from "./dto/logout.dto";
import { RefreshDto } from "./dto/refresh.dto";
import { RegisterDto } from "./dto/register.dto";

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService
  ) {}

  async login(payload: LoginDto) {
    const username = normalizeUsername(payload.username);
    const user = await this.prisma.user.findUnique({
      where: { username },
      include: authUserInclude
    });

    if (
      !user ||
      !verifyPassword(payload.password, user.passwordSalt, user.passwordHash)
    ) {
      throw new UnauthorizedException("用户名或密码不正确。");
    }

    assertUserCanLogin(user);

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        lastLoginAt: new Date()
      }
    });

    return this.issueSession(user.id);
  }

  async register(payload: RegisterDto) {
    const username = normalizeUsername(payload.username);
    const nickname = payload.nickname.trim();

    if (!nickname) {
      throw new BadRequestException("群昵称不能为空。");
    }

    const existingUser = await this.prisma.user.findUnique({
      where: { username }
    });

    if (existingUser) {
      throw new ConflictException("用户名已存在。");
    }

    const memberRole = await this.prisma.role.findUnique({
      where: {
        code: RoleCode.MEMBER
      }
    });

    if (!memberRole) {
      throw new InternalServerErrorException("会员角色尚未初始化。");
    }

    const passwordRecord = createPasswordRecord(payload.password);
    const createdUser = await this.prisma.user.create({
      data: {
        username,
        nickname,
        passwordSalt: passwordRecord.passwordSalt,
        passwordHash: passwordRecord.passwordHash,
        status: UserStatus.PENDING,
        roles: {
          create: {
            roleId: memberRole.id
          }
        },
        memberProfile: {
          create: {
            approvalStatus: ApprovalStatus.PENDING
          }
        }
      },
      include: authUserInclude
    });

    return {
      success: true,
      message: "注册申请已提交，请等待管理员审核。",
      user: {
        ...buildAuthUserResponse(createdUser),
        status: createdUser.status,
        approvalStatus:
          createdUser.memberProfile?.approvalStatus ?? ApprovalStatus.PENDING
      }
    };
  }

  async refresh(payload: RefreshDto) {
    const refreshToken = payload.refreshToken.trim();
    const verified = await this.verifyToken(refreshToken, "refresh");

    const storedToken = await this.prisma.refreshToken.findFirst({
      where: {
        userId: verified.sub,
        tokenHash: hashRefreshToken(refreshToken),
        revokedAt: null,
        expiresAt: {
          gt: new Date()
        }
      }
    });

    if (!storedToken) {
      throw new UnauthorizedException("登录已失效，请重新登录。");
    }

    await this.prisma.refreshToken.update({
      where: { id: storedToken.id },
      data: {
        revokedAt: new Date()
      }
    });

    return this.issueSession(verified.sub);
  }

  async logout(payload: LogoutDto) {
    const refreshToken = payload.refreshToken?.trim();

    if (refreshToken) {
      await this.prisma.refreshToken.updateMany({
        where: {
          tokenHash: hashRefreshToken(refreshToken),
          revokedAt: null
        },
        data: {
          revokedAt: new Date()
        }
      });
    }

    return {
      success: true
    };
  }

  async me(currentUser: AuthenticatedRequestUser) {
    return currentUser.user;
  }

  extractBearerToken(headerValue: string | string[] | undefined): string | null {
    const rawValue = Array.isArray(headerValue) ? headerValue[0] : headerValue;
    if (!rawValue) {
      return null;
    }

    const match = rawValue.match(/^Bearer\s+(.+)$/i);
    return match ? match[1].trim() : null;
  }

  async authenticateAccessToken(token: string): Promise<AuthenticatedRequestUser> {
    const payload = await this.verifyToken(token, "access");
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      include: authUserInclude
    });

    if (!user) {
      throw new UnauthorizedException("登录已失效，请重新登录。");
    }

    assertUserCanLogin(user);

    return {
      user: buildAuthUserResponse(user),
      payload
    };
  }

  private async issueSession(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: authUserInclude
    });

    if (!user) {
      throw new UnauthorizedException("登录已失效，请重新登录。");
    }

    assertUserCanLogin(user);

    const authUser = buildAuthUserResponse(user);
    const accessToken = await this.jwtService.signAsync(
      {
        sub: user.id,
        username: user.username,
        role: authUser.role,
        type: "access"
      } satisfies AuthTokenPayload,
      {
        secret: this.configService.get<string>("JWT_ACCESS_SECRET") ?? "",
        expiresIn:
          (this.configService.get<string>("JWT_ACCESS_EXPIRES_IN") ??
            "15m") as StringValue
      }
    );
    const refreshToken = await this.jwtService.signAsync(
      {
        sub: user.id,
        username: user.username,
        role: authUser.role,
        type: "refresh"
      } satisfies AuthTokenPayload,
      {
        secret: this.configService.get<string>("JWT_REFRESH_SECRET") ?? "",
        expiresIn:
          (this.configService.get<string>("JWT_REFRESH_EXPIRES_IN") ??
            "30d") as StringValue
      }
    );

    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: hashRefreshToken(refreshToken),
        expiresAt: this.buildRefreshExpiryDate()
      }
    });

    return {
      accessToken,
      refreshToken,
      user: authUser
    };
  }

  private async verifyToken(
    token: string,
    expectedType: AuthTokenPayload["type"]
  ): Promise<AuthTokenPayload> {
    try {
      const payload = await this.jwtService.verifyAsync<AuthTokenPayload>(token, {
        secret:
          expectedType === "access"
            ? this.configService.get<string>("JWT_ACCESS_SECRET") ?? ""
            : this.configService.get<string>("JWT_REFRESH_SECRET") ?? ""
      });

      if (payload.type !== expectedType || !payload.sub) {
        throw new UnauthorizedException("登录已失效，请重新登录。");
      }

      return payload;
    } catch (error) {
      if (error instanceof ForbiddenException) {
        throw error;
      }

      throw new UnauthorizedException("登录已失效，请重新登录。");
    }
  }

  private buildRefreshExpiryDate() {
    const expiresIn =
      this.configService.get<string>("JWT_REFRESH_EXPIRES_IN") ?? "30d";
    const now = new Date();
    const match = expiresIn.match(/^(\d+)([smhd])$/i);

    if (!match) {
      const fallback = new Date(now);
      fallback.setDate(fallback.getDate() + 30);
      return fallback;
    }

    const amount = Number(match[1]);
    const unit = match[2].toLowerCase();
    const multiplierMap: Record<string, number> = {
      s: 1000,
      m: 60 * 1000,
      h: 60 * 60 * 1000,
      d: 24 * 60 * 60 * 1000
    };

    return new Date(now.getTime() + amount * multiplierMap[unit]);
  }
}
