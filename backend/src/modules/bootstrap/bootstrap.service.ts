import { Injectable, type OnModuleInit } from "@nestjs/common";
import { RoleCode, UserStatus } from "@prisma/client";
import { ConfigService } from "@nestjs/config";

import { PrismaService } from "src/prisma/prisma.service";

import {
  createPasswordRecord,
  normalizeUsername
} from "../auth/auth.utils";

const defaultRoles = [
  {
    code: RoleCode.SUPER_ADMIN,
    name: "Super Admin"
  },
  {
    code: RoleCode.ADMIN,
    name: "Admin"
  },
  {
    code: RoleCode.MEMBER,
    name: "Member"
  }
] as const;

const defaultKartTypes = [
  {
    code: "200cc",
    name: "200cc",
    sortOrder: 10
  },
  {
    code: "270cc",
    name: "270cc",
    sortOrder: 20
  },
  {
    code: "super4t200",
    name: "超级4T(200)",
    sortOrder: 30
  },
  {
    code: "super4t206",
    name: "超级4T(206)",
    sortOrder: 40
  },
  {
    code: "gpmax",
    name: "GPMAX",
    sortOrder: 50
  },
  {
    code: "x30",
    name: "X30",
    sortOrder: 60
  }
] as const;

@Injectable()
export class BootstrapService implements OnModuleInit {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService
  ) {}

  async onModuleInit() {
    await this.ensureRoles();
    await this.ensureKartTypes();
    await this.ensureDefaultAdmin();
  }

  private async ensureRoles() {
    for (const role of defaultRoles) {
      await this.prisma.role.upsert({
        where: { code: role.code },
        update: {
          name: role.name
        },
        create: {
          code: role.code,
          name: role.name
        }
      });
    }
  }

  private async ensureKartTypes() {
    for (const kartType of defaultKartTypes) {
      await this.prisma.kartType.upsert({
        where: { code: kartType.code },
        update: {
          name: kartType.name,
          sortOrder: kartType.sortOrder,
          isEnabled: true
        },
        create: {
          code: kartType.code,
          name: kartType.name,
          sortOrder: kartType.sortOrder,
          isEnabled: true
        }
      });
    }
  }

  private async ensureDefaultAdmin() {
    const configuredUsername =
      this.configService.get<string>("DEFAULT_ADMIN_USERNAME") ?? "CUKA_Admin";
    const username = normalizeUsername(configuredUsername);
    const nickname =
      this.configService.get<string>("DEFAULT_ADMIN_NICKNAME")?.trim() ||
      "CUKA Admin";
    const password =
      this.configService.get<string>("DEFAULT_ADMIN_PASSWORD") ??
      "Admin123456";

    const adminRole = await this.prisma.role.findUnique({
      where: { code: RoleCode.ADMIN }
    });

    if (!adminRole) {
      return;
    }

    const existingUser = await this.prisma.user.findUnique({
      where: { username }
    });

    if (!existingUser) {
      const passwordRecord = createPasswordRecord(password);
      const user = await this.prisma.user.create({
        data: {
          username,
          nickname,
          passwordSalt: passwordRecord.passwordSalt,
          passwordHash: passwordRecord.passwordHash,
          status: UserStatus.ACTIVE
        }
      });

      await this.prisma.userRole.create({
        data: {
          userId: user.id,
          roleId: adminRole.id
        }
      });

      return;
    }

    const roleBinding = await this.prisma.userRole.findUnique({
      where: {
        userId_roleId: {
          userId: existingUser.id,
          roleId: adminRole.id
        }
      }
    });

    if (!roleBinding) {
      await this.prisma.userRole.create({
        data: {
          userId: existingUser.id,
          roleId: adminRole.id
        }
      });
    }
  }
}
