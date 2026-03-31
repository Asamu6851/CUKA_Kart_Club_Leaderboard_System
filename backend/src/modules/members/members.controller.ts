import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Res,
  StreamableFile,
  UploadedFile,
  UseGuards
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { UseInterceptors } from "@nestjs/common";

import { CurrentUser } from "../auth/decorators/current-user.decorator";
import type { AuthenticatedRequestUser } from "../auth/auth.types";
import { AccessTokenGuard } from "../auth/guards/access-token.guard";
import { AdminCreateMemberDto } from "./dto/admin-create-member.dto";
import { ResetMemberPasswordDto } from "./dto/reset-member-password.dto";
import { MembersService } from "./members.service";
import { ReviewMemberDto } from "./dto/review-member.dto";
import { UpdateMyProfileDto } from "./dto/update-my-profile.dto";
import { UploadProfilePhotoDto } from "./dto/upload-profile-photo.dto";

interface UploadedProfilePhotoFile {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

@Controller("members")
export class MembersController {
  constructor(private readonly membersService: MembersService) {}

  @Get("me/profile")
  @UseGuards(AccessTokenGuard)
  myProfile(@CurrentUser() currentUser: AuthenticatedRequestUser) {
    return this.membersService.findMyProfile(currentUser);
  }

  @Patch("me/profile")
  @UseGuards(AccessTokenGuard)
  updateMyProfile(
    @Body() payload: UpdateMyProfileDto,
    @CurrentUser() currentUser: AuthenticatedRequestUser
  ) {
    return this.membersService.updateMyProfile(payload, currentUser);
  }

  @Post("me/photo")
  @UseGuards(AccessTokenGuard)
  @UseInterceptors(
    FileInterceptor("file", {
      limits: {
        fileSize: 10 * 1024 * 1024
      }
    })
  )
  uploadMyProfilePhoto(
    @UploadedFile() file: UploadedProfilePhotoFile,
    @Body() payload: UploadProfilePhotoDto,
    @CurrentUser() currentUser: AuthenticatedRequestUser
  ) {
    return this.membersService.uploadMyProfilePhoto(payload, file, currentUser);
  }

  @Delete("me/photo")
  @UseGuards(AccessTokenGuard)
  deleteMyProfilePhoto(@CurrentUser() currentUser: AuthenticatedRequestUser) {
    return this.membersService.removeMyProfilePhoto(currentUser);
  }

  @Get()
  @UseGuards(AccessTokenGuard)
  async listMembers(@CurrentUser() currentUser: AuthenticatedRequestUser) {
    return {
      items: await this.membersService.findAll(currentUser)
    };
  }

  @Get("pending")
  @UseGuards(AccessTokenGuard)
  async listPendingMembers(@CurrentUser() currentUser: AuthenticatedRequestUser) {
    return {
      items: await this.membersService.findPending(currentUser)
    };
  }

  @Get("manage")
  @UseGuards(AccessTokenGuard)
  async listManageMembers(@CurrentUser() currentUser: AuthenticatedRequestUser) {
    return {
      items: await this.membersService.findManageList(currentUser)
    };
  }

  @Get(":memberId/profile")
  memberProfile(@Param("memberId") memberId: string) {
    return this.membersService.findProfile(memberId);
  }

  @Get(":memberId/photo")
  async readMemberPhoto(
    @Param("memberId") memberId: string,
    @Res({ passthrough: true }) response: any
  ) {
    const photo = await this.membersService.readMemberPhoto(memberId);

    response.setHeader("Content-Type", photo.mimeType);
    response.setHeader("Content-Length", String(photo.fileSize));
    response.setHeader(
      "Content-Disposition",
      `inline; filename*=UTF-8''${encodeURIComponent(photo.fileName)}`
    );
    response.setHeader("Cache-Control", "public, max-age=3600");

    return new StreamableFile(photo.stream);
  }

  @Post()
  @UseGuards(AccessTokenGuard)
  createMember(
    @Body() payload: AdminCreateMemberDto,
    @CurrentUser() currentUser: AuthenticatedRequestUser
  ) {
    return this.membersService.createByAdmin(payload, currentUser);
  }

  @Post(":memberId/approve")
  @UseGuards(AccessTokenGuard)
  approveMember(
    @Param("memberId") memberId: string,
    @Body() payload: ReviewMemberDto,
    @CurrentUser() currentUser: AuthenticatedRequestUser
  ) {
    return this.membersService.approve(memberId, currentUser, payload);
  }

  @Post(":memberId/reject")
  @UseGuards(AccessTokenGuard)
  rejectMember(
    @Param("memberId") memberId: string,
    @Body() payload: ReviewMemberDto,
    @CurrentUser() currentUser: AuthenticatedRequestUser
  ) {
    return this.membersService.reject(memberId, currentUser, payload);
  }

  @Patch(":memberId/disable")
  @UseGuards(AccessTokenGuard)
  disableMember(
    @Param("memberId") memberId: string,
    @CurrentUser() currentUser: AuthenticatedRequestUser
  ) {
    return this.membersService.disable(memberId, currentUser);
  }

  @Patch(":memberId/enable")
  @UseGuards(AccessTokenGuard)
  enableMember(
    @Param("memberId") memberId: string,
    @CurrentUser() currentUser: AuthenticatedRequestUser
  ) {
    return this.membersService.enable(memberId, currentUser);
  }

  @Patch(":memberId/reset-password")
  @UseGuards(AccessTokenGuard)
  resetMemberPassword(
    @Param("memberId") memberId: string,
    @Body() payload: ResetMemberPasswordDto,
    @CurrentUser() currentUser: AuthenticatedRequestUser
  ) {
    return this.membersService.resetPassword(memberId, payload, currentUser);
  }

  @Delete(":memberId")
  @UseGuards(AccessTokenGuard)
  deleteMember(
    @Param("memberId") memberId: string,
    @CurrentUser() currentUser: AuthenticatedRequestUser
  ) {
    return this.membersService.remove(memberId, currentUser);
  }
}
