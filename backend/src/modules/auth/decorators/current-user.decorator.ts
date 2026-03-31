import {
  UnauthorizedException,
  createParamDecorator,
  type ExecutionContext
} from "@nestjs/common";

import type { AuthenticatedRequestUser } from "../auth.types";

export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext) => {
    const request = context.switchToHttp().getRequest<{
      user?: AuthenticatedRequestUser;
    }>();

    if (!request.user) {
      throw new UnauthorizedException("未登录或登录已过期。");
    }

    return request.user;
  }
);
