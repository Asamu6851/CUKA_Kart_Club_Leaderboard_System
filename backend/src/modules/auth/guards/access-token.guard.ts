import {
  CanActivate,
  Injectable,
  UnauthorizedException,
  type ExecutionContext
} from "@nestjs/common";

import type { AuthenticatedRequestUser } from "../auth.types";
import { AuthService } from "../auth.service";

@Injectable()
export class AccessTokenGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<{
      headers: Record<string, string | string[] | undefined>;
      user?: AuthenticatedRequestUser;
    }>();
    const accessToken = this.authService.extractBearerToken(
      request.headers.authorization
    );

    if (!accessToken) {
      throw new UnauthorizedException("未登录或登录已过期。");
    }

    request.user = await this.authService.authenticateAccessToken(accessToken);
    return true;
  }
}
