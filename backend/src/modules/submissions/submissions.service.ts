import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import { RecordSourceType, SubmissionStatus, type Prisma } from "@prisma/client";

import {
  normalizeLapTimeText,
  parseLapTimeToMs
} from "src/common/utils/lap-time";
import { PrismaService } from "src/prisma/prisma.service";

import type { AuthenticatedRequestUser } from "../auth/auth.types";
import {
  assertAdminUser,
  assertMemberUser,
  isAdminRole
} from "../auth/auth.utils";
import { StorageService } from "../storage/storage.service";
import { CreateSubmissionDto } from "./dto/create-submission.dto";
import { ReviewSubmissionDto } from "./dto/review-submission.dto";

const submissionInclude = {
  member: {
    select: {
      id: true,
      username: true,
      nickname: true
    }
  },
  track: true,
  kartType: true,
  attachments: true,
  reviewedBy: {
    select: {
      id: true,
      username: true,
      nickname: true
    }
  }
} satisfies Prisma.SubmissionInclude;

type SubmissionItem = Prisma.SubmissionGetPayload<{
  include: typeof submissionInclude;
}>;

interface UploadedAttachmentFile {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

@Injectable()
export class SubmissionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService
  ) {}

  async create(payload: CreateSubmissionDto, currentUser: AuthenticatedRequestUser) {
    assertMemberUser(currentUser);
    await this.ensureTrackAndKartType(payload.trackId, payload.kartTypeId);

    const normalizedLapTimeText = normalizeLapTimeText(payload.lapTimeText);
    const lapTimeMs = parseLapTimeToMs(normalizedLapTimeText);

    const submission = await this.prisma.submission.create({
      data: {
        memberId: currentUser.user.id,
        trackId: payload.trackId,
        kartTypeId: payload.kartTypeId,
        lapTimeMs,
        lapTimeText: normalizedLapTimeText,
        raceDate: new Date(payload.raceDate),
        finalRanking: payload.finalRanking,
        kartNo: payload.kartNo?.trim() || null,
        weather: payload.weather?.trim() || null,
        note: payload.note?.trim() || null
      },
      include: submissionInclude
    });

    return {
      success: true,
      item: this.mapSubmission(submission)
    };
  }

  async addAttachments(
    submissionId: string,
    files: UploadedAttachmentFile[],
    currentUser: AuthenticatedRequestUser
  ) {
    if (!files || files.length === 0) {
      throw new BadRequestException("Please select at least one screenshot.");
    }

    const submission = await this.findSubmissionOrThrow(submissionId);
    this.assertSubmissionOwnership(currentUser, submission);

    if (submission.status !== SubmissionStatus.PENDING) {
      throw new ConflictException("Only pending submissions can receive attachments.");
    }

    for (const file of files) {
      if (!file.mimetype?.startsWith("image/")) {
        throw new BadRequestException("Only image files are allowed for screenshots.");
      }
    }

    const createdAttachments = [];
    for (const file of files) {
      const storedObject = await this.storageService.uploadSubmissionAttachment(
        submission.id,
        file
      );
      const attachment = await this.prisma.submissionAttachment.create({
        data: {
          submissionId: submission.id,
          bucket: storedObject.bucket,
          objectKey: storedObject.objectKey,
          fileName: file.originalname,
          mimeType: file.mimetype || "application/octet-stream",
          fileSize: file.size
        }
      });

      createdAttachments.push(this.mapAttachment(attachment));
    }

    const refreshedSubmission = await this.findSubmissionOrThrow(submission.id);

    return {
      success: true,
      attachments: createdAttachments,
      item: this.mapSubmission(refreshedSubmission)
    };
  }

  async findPending(currentUser: AuthenticatedRequestUser) {
    assertAdminUser(currentUser);

    const submissions = await this.prisma.submission.findMany({
      where: {
        status: SubmissionStatus.PENDING
      },
      include: submissionInclude,
      orderBy: {
        createdAt: "asc"
      }
    });

    return submissions.map((submission) => this.mapSubmission(submission));
  }

  async findMine(currentUser: AuthenticatedRequestUser) {
    const submissions = await this.prisma.submission.findMany({
      where: {
        memberId: currentUser.user.id
      },
      include: submissionInclude,
      orderBy: {
        createdAt: "desc"
      }
    });

    return submissions.map((submission) => this.mapSubmission(submission));
  }

  async readAttachment(attachmentId: string, currentUser: AuthenticatedRequestUser) {
    const attachment = await this.prisma.submissionAttachment.findUnique({
      where: {
        id: attachmentId
      },
      include: {
        submission: {
          include: {
            member: {
              select: {
                id: true
              }
            }
          }
        }
      }
    });

    if (!attachment) {
      throw new NotFoundException("Attachment not found.");
    }

    if (
      !isAdminRole(currentUser.user.role) &&
      attachment.submission.member.id !== currentUser.user.id
    ) {
      throw new ForbiddenException("You cannot access this attachment.");
    }

    const stream = await this.storageService.getObjectStream(attachment.objectKey);

    return {
      fileName: attachment.fileName,
      fileSize: attachment.fileSize,
      mimeType: attachment.mimeType,
      stream
    };
  }

  async approve(
    submissionId: string,
    payload: ReviewSubmissionDto,
    currentUser: AuthenticatedRequestUser
  ) {
    assertAdminUser(currentUser);
    const submission = await this.findSubmissionOrThrow(submissionId);

    if (submission.status !== SubmissionStatus.PENDING) {
      throw new ConflictException("Only pending submissions can be approved.");
    }

    const reviewNote = payload.reviewNote?.trim() || null;
    const approvedAt = new Date();

    await this.prisma.$transaction(async (tx) => {
      await tx.submission.update({
        where: {
          id: submission.id
        },
        data: {
          status: SubmissionStatus.APPROVED,
          reviewNote,
          reviewedAt: approvedAt,
          reviewedById: currentUser.user.id
        }
      });

      const existingRecord = await tx.record.findUnique({
        where: {
          sourceSubmissionId: submission.id
        }
      });

      if (existingRecord) {
        await tx.record.update({
          where: {
            id: existingRecord.id
          },
          data: {
            memberId: submission.member.id,
            trackId: submission.track.id,
            kartTypeId: submission.kartType.id,
            sourceType: RecordSourceType.SUBMISSION,
            lapTimeMs: submission.lapTimeMs,
            lapTimeText: submission.lapTimeText,
            raceDate: submission.raceDate,
            finalRanking: submission.finalRanking,
            kartNo: submission.kartNo,
            weather: submission.weather,
            note: submission.note,
            approvedById: currentUser.user.id,
            approvedAt
          }
        });
      } else {
        await tx.record.create({
          data: {
            memberId: submission.member.id,
            trackId: submission.track.id,
            kartTypeId: submission.kartType.id,
            sourceType: RecordSourceType.SUBMISSION,
            sourceSubmissionId: submission.id,
            lapTimeMs: submission.lapTimeMs,
            lapTimeText: submission.lapTimeText,
            raceDate: submission.raceDate,
            finalRanking: submission.finalRanking,
            kartNo: submission.kartNo,
            weather: submission.weather,
            note: submission.note,
            approvedById: currentUser.user.id,
            approvedAt
          }
        });
      }
    });

    const refreshedSubmission = await this.findSubmissionOrThrow(submission.id);

    return {
      success: true,
      item: this.mapSubmission(refreshedSubmission)
    };
  }

  async reject(
    submissionId: string,
    payload: ReviewSubmissionDto,
    currentUser: AuthenticatedRequestUser
  ) {
    assertAdminUser(currentUser);
    const submission = await this.findSubmissionOrThrow(submissionId);

    if (submission.status !== SubmissionStatus.PENDING) {
      throw new ConflictException("Only pending submissions can be rejected.");
    }

    await this.prisma.submission.update({
      where: {
        id: submission.id
      },
      data: {
        status: SubmissionStatus.REJECTED,
        reviewNote: payload.reviewNote?.trim() || null,
        reviewedAt: new Date(),
        reviewedById: currentUser.user.id
      }
    });

    const refreshedSubmission = await this.findSubmissionOrThrow(submission.id);

    return {
      success: true,
      item: this.mapSubmission(refreshedSubmission)
    };
  }

  private async ensureTrackAndKartType(trackId: string, kartTypeId: string) {
    const [track, kartType] = await Promise.all([
      this.prisma.track.findFirst({
        where: {
          id: trackId,
          isEnabled: true
        }
      }),
      this.prisma.kartType.findFirst({
        where: {
          id: kartTypeId,
          isEnabled: true
        }
      })
    ]);

    if (!track) {
      throw new NotFoundException("Track not found.");
    }

    if (!kartType) {
      throw new NotFoundException("Kart type not found.");
    }
  }

  private async findSubmissionOrThrow(submissionId: string) {
    const submission = await this.prisma.submission.findUnique({
      where: {
        id: submissionId
      },
      include: submissionInclude
    });

    if (!submission) {
      throw new NotFoundException("Submission not found.");
    }

    return submission;
  }

  private assertSubmissionOwnership(
    currentUser: AuthenticatedRequestUser,
    submission: SubmissionItem
  ) {
    if (
      !isAdminRole(currentUser.user.role) &&
      submission.member.id !== currentUser.user.id
    ) {
      throw new ForbiddenException("You cannot modify this submission.");
    }
  }

  private mapSubmission(submission: SubmissionItem) {
    return {
      id: submission.id,
      status: submission.status,
      lapTimeMs: submission.lapTimeMs,
      lapTimeText: submission.lapTimeText,
      raceDate: submission.raceDate,
      finalRanking: submission.finalRanking,
      kartNo: submission.kartNo,
      weather: submission.weather,
      note: submission.note,
      reviewNote: submission.reviewNote,
      reviewedAt: submission.reviewedAt,
      createdAt: submission.createdAt,
      updatedAt: submission.updatedAt,
      member: submission.member,
      track: {
        id: submission.track.id,
        name: submission.track.name
      },
      kartType: {
        id: submission.kartType.id,
        code: submission.kartType.code,
        name: submission.kartType.name
      },
      reviewedBy: submission.reviewedBy,
      attachments: submission.attachments.map((attachment) => this.mapAttachment(attachment))
    };
  }

  private mapAttachment(
    attachment: SubmissionItem["attachments"][number]
  ) {
    return {
      id: attachment.id,
      fileName: attachment.fileName,
      mimeType: attachment.mimeType,
      fileSize: attachment.fileSize,
      bucket: attachment.bucket,
      objectKey: attachment.objectKey,
      createdAt: attachment.createdAt,
      downloadPath: `/api/v1/submissions/attachments/${attachment.id}`
    };
  }
}
