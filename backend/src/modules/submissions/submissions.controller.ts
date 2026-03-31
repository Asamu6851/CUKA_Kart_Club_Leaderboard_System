import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Res,
  StreamableFile,
  UploadedFiles,
  UseGuards,
  UseInterceptors
} from "@nestjs/common";
import { FilesInterceptor } from "@nestjs/platform-express";

import type { AuthenticatedRequestUser } from "../auth/auth.types";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { AccessTokenGuard } from "../auth/guards/access-token.guard";
import { CreateSubmissionDto } from "./dto/create-submission.dto";
import { ReviewSubmissionDto } from "./dto/review-submission.dto";
import { SubmissionsService } from "./submissions.service";

interface UploadedAttachmentFile {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

@Controller("submissions")
export class SubmissionsController {
  constructor(private readonly submissionsService: SubmissionsService) {}

  @Post()
  @UseGuards(AccessTokenGuard)
  create(
    @Body() payload: CreateSubmissionDto,
    @CurrentUser() currentUser: AuthenticatedRequestUser
  ) {
    return this.submissionsService.create(payload, currentUser);
  }

  @Post(":submissionId/attachments")
  @UseGuards(AccessTokenGuard)
  @UseInterceptors(
    FilesInterceptor("files", 5, {
      limits: {
        fileSize: 10 * 1024 * 1024
      }
    })
  )
  uploadAttachments(
    @Param("submissionId") submissionId: string,
    @UploadedFiles() files: UploadedAttachmentFile[],
    @CurrentUser() currentUser: AuthenticatedRequestUser
  ) {
    return this.submissionsService.addAttachments(submissionId, files, currentUser);
  }

  @Get("pending")
  @UseGuards(AccessTokenGuard)
  async pending(@CurrentUser() currentUser: AuthenticatedRequestUser) {
    return {
      items: await this.submissionsService.findPending(currentUser)
    };
  }

  @Get("mine")
  @UseGuards(AccessTokenGuard)
  async mine(@CurrentUser() currentUser: AuthenticatedRequestUser) {
    return {
      items: await this.submissionsService.findMine(currentUser)
    };
  }

  @Get("attachments/:attachmentId")
  @UseGuards(AccessTokenGuard)
  async readAttachment(
    @Param("attachmentId") attachmentId: string,
    @CurrentUser() currentUser: AuthenticatedRequestUser,
    @Res({ passthrough: true }) response: any
  ) {
    const attachment = await this.submissionsService.readAttachment(
      attachmentId,
      currentUser
    );

    response.setHeader("Content-Type", attachment.mimeType);
    response.setHeader("Content-Length", String(attachment.fileSize));
    response.setHeader(
      "Content-Disposition",
      `inline; filename*=UTF-8''${encodeURIComponent(attachment.fileName)}`
    );

    return new StreamableFile(attachment.stream);
  }

  @Post(":submissionId/approve")
  @UseGuards(AccessTokenGuard)
  approve(
    @Param("submissionId") submissionId: string,
    @Body() payload: ReviewSubmissionDto,
    @CurrentUser() currentUser: AuthenticatedRequestUser
  ) {
    return this.submissionsService.approve(submissionId, payload, currentUser);
  }

  @Post(":submissionId/reject")
  @UseGuards(AccessTokenGuard)
  reject(
    @Param("submissionId") submissionId: string,
    @Body() payload: ReviewSubmissionDto,
    @CurrentUser() currentUser: AuthenticatedRequestUser
  ) {
    return this.submissionsService.reject(submissionId, payload, currentUser);
  }
}
