import { Body, Controller, Get, Post, UseGuards } from "@nestjs/common";

import { AuthService } from "./auth.service";
import { LoginDto } from "./dto/login.dto";
import { LogoutDto } from "./dto/logout.dto";
import { RefreshDto } from "./dto/refresh.dto";
import { RegisterDto } from "./dto/register.dto";
import { CurrentUser } from "./decorators/current-user.decorator";
import { AccessTokenGuard } from "./guards/access-token.guard";
import type { AuthenticatedRequestUser } from "./auth.types";

@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post("login")
  login(@Body() payload: LoginDto) {
    return this.authService.login(payload);
  }

  @Post("register")
  register(@Body() payload: RegisterDto) {
    return this.authService.register(payload);
  }

  @Post("refresh")
  refresh(@Body() payload: RefreshDto) {
    return this.authService.refresh(payload);
  }

  @Post("logout")
  logout(@Body() payload: LogoutDto) {
    return this.authService.logout(payload);
  }

  @Get("me")
  @UseGuards(AccessTokenGuard)
  me(@CurrentUser() currentUser: AuthenticatedRequestUser) {
    return this.authService.me(currentUser);
  }
}
