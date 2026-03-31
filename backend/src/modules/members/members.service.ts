import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  NotFoundException
} from "@nestjs/common";
import {
  ApprovalStatus,
  ProfilePhotoDisplayType,
  SubmissionStatus,
  RoleCode,
  UserStatus,
  type Prisma
} from "@prisma/client";

import { PrismaService } from "src/prisma/prisma.service";

import {
  authUserInclude,
  type AuthenticatedRequestUser
} from "../auth/auth.types";
import {
  assertAdminUser,
  createPasswordRecord,
  getPrimaryRole,
  normalizeUsername
} from "../auth/auth.utils";
import { StorageService } from "../storage/storage.service";
import { AdminCreateMemberDto } from "./dto/admin-create-member.dto";
import { ResetMemberPasswordDto } from "./dto/reset-member-password.dto";
import { ReviewMemberDto } from "./dto/review-member.dto";
import { UploadProfilePhotoDto } from "./dto/upload-profile-photo.dto";
import { UpdateMyProfileDto } from "./dto/update-my-profile.dto";

type DatabaseMember = Prisma.UserGetPayload<{
  include: typeof authUserInclude;
}>;

const profileRecordInclude = {
  track: true,
  kartType: true,
  approvedBy: {
    select: {
      id: true,
      username: true,
      nickname: true
    }
  }
} satisfies Prisma.RecordInclude;

const profileSubmissionInclude = {
  track: true,
  kartType: true,
  reviewedBy: {
    select: {
      id: true,
      username: true,
      nickname: true
    }
  },
  attachments: true
} satisfies Prisma.SubmissionInclude;

type ProfileRecordItem = Prisma.RecordGetPayload<{
  include: typeof profileRecordInclude;
}>;

type ProfileSubmissionItem = Prisma.SubmissionGetPayload<{
  include: typeof profileSubmissionInclude;
}>;

type DetailedMember = Prisma.UserGetPayload<{
  include: typeof authUserInclude & {
    records: {
      include: typeof profileRecordInclude;
    };
  };
}>;

type DetailedSelfProfile = Prisma.UserGetPayload<{
  include: typeof authUserInclude & {
    records: {
      include: typeof profileRecordInclude;
    };
    submissions: {
      include: typeof profileSubmissionInclude;
    };
  };
}>;

@Injectable()
export class MembersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService
  ) {}

  async findMyProfile(currentUser: AuthenticatedRequestUser) {
    const profile = await this.prisma.user.findUnique({
      where: {
        id: currentUser.user.id
      },
      include: {
        ...authUserInclude,
        records: {
          include: profileRecordInclude,
          orderBy: [
            {
              lapTimeMs: "asc"
            },
            {
              raceDate: "desc"
            },
            {
              createdAt: "desc"
            }
          ]
        },
        submissions: {
          include: profileSubmissionInclude,
          orderBy: [
            {
              raceDate: "desc"
            },
            {
              createdAt: "desc"
            }
          ]
        }
      }
    });

    if (!profile) {
      throw new NotFoundException("User not found.");
    }

    return this.buildProfileResponse(profile, {
      isSelf: true
    });
  }

  async findProfile(memberId: string) {
    const member = await this.prisma.user.findFirst({
      where: {
        id: memberId,
        status: UserStatus.ACTIVE,
        roles: {
          some: {
            role: {
              code: RoleCode.MEMBER
            }
          }
        },
        memberProfile: {
          is: {
            approvalStatus: ApprovalStatus.APPROVED
          }
        }
      },
      include: {
        ...authUserInclude,
        records: {
          include: profileRecordInclude,
          orderBy: [
            {
              lapTimeMs: "asc"
            },
            {
              raceDate: "desc"
            },
            {
              createdAt: "desc"
            }
          ]
        }
      }
    });

    if (!member) {
      throw new NotFoundException("Member not found.");
    }

    return this.buildProfileResponse(member, {
      isSelf: false
    });
  }

  async uploadMyProfilePhoto(
    payload: UploadProfilePhotoDto,
    file: {
      originalname: string;
      mimetype: string;
      size: number;
      buffer: Buffer;
    } | null | undefined,
    currentUser: AuthenticatedRequestUser
  ) {
    if (!file) {
      throw new BadRequestException("Please select an image file.");
    }

    if (!file.mimetype?.startsWith("image/")) {
      throw new BadRequestException("Only image files are allowed.");
    }

    const currentMember = await this.prisma.user.findUnique({
      where: {
        id: currentUser.user.id
      },
      include: authUserInclude
    });

    if (!currentMember) {
      throw new NotFoundException("User not found.");
    }

    const storedObject = await this.storageService.uploadMemberProfilePhoto(
      currentMember.id,
      file
    );

    const previousObjectKey = currentMember.memberProfile?.photoObjectKey ?? null;

    const updatedMember = await this.prisma.user.update({
      where: {
        id: currentMember.id
      },
      data: {
        memberProfile: {
          upsert: {
            update: {
              photoDisplayType: payload.displayType,
              photoBucket: storedObject.bucket,
              photoObjectKey: storedObject.objectKey,
              photoFileName: file.originalname,
              photoMimeType: file.mimetype || "application/octet-stream",
              photoFileSize: file.size,
              photoUpdatedAt: new Date()
            },
            create: {
              approvalStatus:
                currentMember.memberProfile?.approvalStatus ?? ApprovalStatus.APPROVED,
              photoDisplayType: payload.displayType,
              photoBucket: storedObject.bucket,
              photoObjectKey: storedObject.objectKey,
              photoFileName: file.originalname,
              photoMimeType: file.mimetype || "application/octet-stream",
              photoFileSize: file.size,
              photoUpdatedAt: new Date()
            }
          }
        }
      },
      include: authUserInclude
    });

    if (previousObjectKey && previousObjectKey !== storedObject.objectKey) {
      await this.storageService.removeObject(previousObjectKey);
    }

    return {
      success: true,
      photo: this.mapProfilePhoto(updatedMember)
    };
  }

  async removeMyProfilePhoto(currentUser: AuthenticatedRequestUser) {
    const currentMember = await this.prisma.user.findUnique({
      where: {
        id: currentUser.user.id
      },
      include: authUserInclude
    });

    if (!currentMember) {
      throw new NotFoundException("User not found.");
    }

    const previousObjectKey = currentMember.memberProfile?.photoObjectKey ?? null;

    await this.prisma.memberProfile.updateMany({
      where: {
        userId: currentMember.id
      },
      data: {
        photoDisplayType: null,
        photoBucket: null,
        photoObjectKey: null,
        photoFileName: null,
        photoMimeType: null,
        photoFileSize: null,
        photoUpdatedAt: null
      }
    });

    if (previousObjectKey) {
      await this.storageService.removeObject(previousObjectKey);
    }

    return {
      success: true
    };
  }

  async readMemberPhoto(memberId: string) {
    const member = await this.prisma.user.findFirst({
      where: {
        id: memberId,
        status: UserStatus.ACTIVE,
        roles: {
          some: {
            role: {
              code: RoleCode.MEMBER
            }
          }
        },
        memberProfile: {
          is: {
            approvalStatus: ApprovalStatus.APPROVED,
            photoObjectKey: {
              not: null
            }
          }
        }
      },
      include: authUserInclude
    });

    if (!member?.memberProfile?.photoObjectKey) {
      throw new NotFoundException("Profile photo not found.");
    }

    const stream = await this.storageService.getObjectStream(
      member.memberProfile.photoObjectKey
    );

    return {
      fileName: member.memberProfile.photoFileName ?? "profile-photo",
      fileSize: member.memberProfile.photoFileSize ?? 0,
      mimeType: member.memberProfile.photoMimeType ?? "application/octet-stream",
      stream
    };
  }

  async updateMyProfile(
    payload: UpdateMyProfileDto,
    currentUser: AuthenticatedRequestUser
  ) {
    const currentMember = await this.prisma.user.findUnique({
      where: {
        id: currentUser.user.id
      },
      include: authUserInclude
    });

    if (!currentMember) {
      throw new NotFoundException("User not found.");
    }

    const updateData: Prisma.UserUpdateInput = {};

    if (Object.prototype.hasOwnProperty.call(payload, "username")) {
      const username = normalizeUsername(payload.username ?? "");
      if (!username) {
        throw new BadRequestException("Username is required.");
      }

      if (username !== currentMember.username) {
        const existingUser = await this.prisma.user.findUnique({
          where: {
            username
          },
          select: {
            id: true
          }
        });

        if (existingUser && existingUser.id !== currentMember.id) {
          throw new ConflictException("Username already exists.");
        }
      }

      updateData.username = username;
    }

    if (Object.prototype.hasOwnProperty.call(payload, "nickname")) {
      const nickname = payload.nickname?.trim() ?? "";
      if (!nickname) {
        throw new BadRequestException("Nickname is required.");
      }

      updateData.nickname = nickname;
    }

    if (Object.keys(updateData).length === 0) {
      throw new BadRequestException("No profile fields were provided.");
    }

    const updatedMember = await this.prisma.user.update({
      where: {
        id: currentMember.id
      },
      data: updateData,
      include: authUserInclude
    });

    return {
      success: true,
      user: this.mapMember(updatedMember)
    };
  }

  async findAll(currentUser: AuthenticatedRequestUser) {
    const members = await this.prisma.user.findMany({
      where: {
        status: UserStatus.ACTIVE,
        roles: {
          some: {
            role: {
              code: RoleCode.MEMBER
            }
          }
        },
        memberProfile: {
          is: {
            approvalStatus: ApprovalStatus.APPROVED
          }
        }
      },
      include: authUserInclude,
      orderBy: {
        createdAt: "desc"
      }
    });

    return members.map((member) => this.mapMember(member));
  }

  async findManageList(currentUser: AuthenticatedRequestUser) {
    assertAdminUser(currentUser);

    const members = await this.prisma.user.findMany({
      where: {
        roles: {
          some: {
            role: {
              code: RoleCode.MEMBER
            }
          }
        }
      },
      include: authUserInclude,
      orderBy: [
        {
          createdAt: "desc"
        }
      ]
    });

    return members.map((member) => this.mapMember(member));
  }

  async createByAdmin(
    payload: AdminCreateMemberDto,
    currentUser: AuthenticatedRequestUser
  ) {
    assertAdminUser(currentUser);

    const username = normalizeUsername(payload.username);
    const nickname = payload.nickname.trim();

    if (!nickname) {
      throw new BadRequestException("Nickname is required.");
    }

    const existingUser = await this.prisma.user.findUnique({
      where: {
        username
      }
    });

    if (existingUser) {
      throw new ConflictException("Username already exists.");
    }

    const memberRole = await this.prisma.role.findUnique({
      where: {
        code: RoleCode.MEMBER
      }
    });

    if (!memberRole) {
      throw new InternalServerErrorException("Member role is not initialized yet.");
    }

    const passwordRecord = createPasswordRecord(payload.password);
    const now = new Date();
    const member = await this.prisma.user.create({
      data: {
        username,
        nickname,
        passwordSalt: passwordRecord.passwordSalt,
        passwordHash: passwordRecord.passwordHash,
        status: UserStatus.ACTIVE,
        roles: {
          create: {
            roleId: memberRole.id
          }
        },
        memberProfile: {
          create: {
            approvalStatus: ApprovalStatus.APPROVED,
            reviewNote: "Created by admin.",
            reviewedAt: now,
            reviewedById: currentUser.user.id
          }
        }
      },
      include: authUserInclude
    });

    return {
      success: true,
      member: this.mapMember(member)
    };
  }

  async findPending(currentUser: AuthenticatedRequestUser) {
    assertAdminUser(currentUser);

    const members = await this.prisma.user.findMany({
      where: {
        roles: {
          some: {
            role: {
              code: RoleCode.MEMBER
            }
          }
        },
        OR: [
          {
            status: UserStatus.PENDING
          },
          {
            memberProfile: {
              is: {
                approvalStatus: ApprovalStatus.PENDING
              }
            }
          }
        ]
      },
      include: authUserInclude,
      orderBy: {
        createdAt: "asc"
      }
    });

    return members.map((member) => this.mapMember(member));
  }

  async approve(
    memberId: string,
    currentUser: AuthenticatedRequestUser,
    payload: ReviewMemberDto
  ) {
    assertAdminUser(currentUser);
    const member = await this.findMemberOrThrow(memberId);
    const now = new Date();
    const reviewNote = payload.reviewNote?.trim() || null;

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: member.id },
        data: {
          status: UserStatus.ACTIVE
        }
      }),
      this.prisma.memberProfile.upsert({
        where: {
          userId: member.id
        },
        update: {
          approvalStatus: ApprovalStatus.APPROVED,
          reviewNote,
          reviewedAt: now,
          reviewedById: currentUser.user.id
        },
        create: {
          userId: member.id,
          approvalStatus: ApprovalStatus.APPROVED,
          reviewNote,
          reviewedAt: now,
          reviewedById: currentUser.user.id
        }
      })
    ]);

    const refreshedMember = await this.findMemberOrThrow(member.id);

    return {
      success: true,
      member: this.mapMember(refreshedMember)
    };
  }

  async reject(
    memberId: string,
    currentUser: AuthenticatedRequestUser,
    payload: ReviewMemberDto
  ) {
    assertAdminUser(currentUser);
    const member = await this.findMemberOrThrow(memberId);
    const now = new Date();
    const reviewNote = payload.reviewNote?.trim() || null;

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: member.id },
        data: {
          status: UserStatus.REJECTED
        }
      }),
      this.prisma.memberProfile.upsert({
        where: {
          userId: member.id
        },
        update: {
          approvalStatus: ApprovalStatus.REJECTED,
          reviewNote,
          reviewedAt: now,
          reviewedById: currentUser.user.id
        },
        create: {
          userId: member.id,
          approvalStatus: ApprovalStatus.REJECTED,
          reviewNote,
          reviewedAt: now,
          reviewedById: currentUser.user.id
        }
      })
    ]);

    const refreshedMember = await this.findMemberOrThrow(member.id);

    return {
      success: true,
      member: this.mapMember(refreshedMember)
    };
  }

  async disable(memberId: string, currentUser: AuthenticatedRequestUser) {
    assertAdminUser(currentUser);
    const member = await this.findMemberOrThrow(memberId);

    if (member.status === UserStatus.DISABLED) {
      return {
        success: true,
        member: this.mapMember(member)
      };
    }

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: {
          id: member.id
        },
        data: {
          status: UserStatus.DISABLED
        }
      }),
      this.prisma.refreshToken.updateMany({
        where: {
          userId: member.id,
          revokedAt: null
        },
        data: {
          revokedAt: new Date()
        }
      })
    ]);

    const refreshedMember = await this.findMemberOrThrow(member.id);

    return {
      success: true,
      member: this.mapMember(refreshedMember)
    };
  }

  async enable(memberId: string, currentUser: AuthenticatedRequestUser) {
    assertAdminUser(currentUser);
    const member = await this.findMemberOrThrow(memberId);

    const refreshedApprovalStatus = member.memberProfile?.approvalStatus ?? null;
    const approvalData =
      refreshedApprovalStatus === ApprovalStatus.APPROVED
        ? {}
        : {
            memberProfile: {
              upsert: {
                update: {
                  approvalStatus: ApprovalStatus.APPROVED,
                  reviewNote: "Enabled by admin.",
                  reviewedAt: new Date(),
                  reviewedById: currentUser.user.id
                },
                create: {
                  approvalStatus: ApprovalStatus.APPROVED,
                  reviewNote: "Enabled by admin.",
                  reviewedAt: new Date(),
                  reviewedById: currentUser.user.id
                }
              }
            }
          };

    const updatedMember = await this.prisma.user.update({
      where: {
        id: member.id
      },
      data: {
        status: UserStatus.ACTIVE,
        ...approvalData
      },
      include: authUserInclude
    });

    return {
      success: true,
      member: this.mapMember(updatedMember)
    };
  }

  async resetPassword(
    memberId: string,
    payload: ResetMemberPasswordDto,
    currentUser: AuthenticatedRequestUser
  ) {
    assertAdminUser(currentUser);
    const member = await this.findMemberOrThrow(memberId);
    const passwordRecord = createPasswordRecord(payload.password);

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: {
          id: member.id
        },
        data: {
          passwordSalt: passwordRecord.passwordSalt,
          passwordHash: passwordRecord.passwordHash
        }
      }),
      this.prisma.refreshToken.updateMany({
        where: {
          userId: member.id,
          revokedAt: null
        },
        data: {
          revokedAt: new Date()
        }
      })
    ]);

    const refreshedMember = await this.findMemberOrThrow(member.id);

    return {
      success: true,
      member: this.mapMember(refreshedMember)
    };
  }

  async remove(memberId: string, currentUser: AuthenticatedRequestUser) {
    assertAdminUser(currentUser);
    const member = await this.findMemberOrThrow(memberId);

    const photoObjectKey = member.memberProfile?.photoObjectKey ?? null;

    await this.prisma.user.delete({
      where: {
        id: member.id
      }
    });

    if (photoObjectKey) {
      await this.storageService.removeObject(photoObjectKey);
    }

    return {
      success: true
    };
  }

  private async findMemberOrThrow(memberId: string) {
    const member = await this.prisma.user.findFirst({
      where: {
        id: memberId,
        roles: {
          some: {
            role: {
              code: RoleCode.MEMBER
            }
          }
        }
      },
      include: authUserInclude
    });

    if (!member) {
      throw new NotFoundException("Member not found.");
    }

    return member;
  }

  private buildProfileResponse(
    member: DetailedMember | DetailedSelfProfile,
    options: {
      isSelf: boolean;
    }
  ) {
    const mappedRecords = this.sortProfileRecords(member.records).map((record) =>
      this.mapProfileRecord(record)
    );
    const submissions =
      options.isSelf && "submissions" in member
        ? member.submissions.map((submission) => this.mapProfileSubmission(submission))
        : [];
    const bestRecord = mappedRecords[0] ?? null;
    const approvedSubmissionCount = submissions.filter(
      (submission) => submission.status === SubmissionStatus.APPROVED
    ).length;
    const pendingSubmissionCount = submissions.filter(
      (submission) => submission.status === SubmissionStatus.PENDING
    ).length;
    const rejectedSubmissionCount = submissions.filter(
      (submission) => submission.status === SubmissionStatus.REJECTED
    ).length;

    return {
      viewer: {
        isSelf: options.isSelf,
        canEdit: options.isSelf,
        canViewPrivateSubmissions: options.isSelf
      },
      member: this.mapMember(member),
      photo: this.mapProfilePhoto(member),
      stats: {
        bestLapTimeText: bestRecord?.lapTimeText ?? null,
        approvedRecordCount: mappedRecords.length,
        submissionCount: submissions.length,
        approvedSubmissionCount,
        pendingSubmissionCount,
        rejectedSubmissionCount,
        trackCount: new Set(mappedRecords.map((record) => record.track.id)).size,
        kartTypeCount: new Set(mappedRecords.map((record) => record.kartType.id)).size
      },
      records: mappedRecords,
      submissions
    };
  }

  private sortProfileRecords(records: ProfileRecordItem[]) {
    return [...records].sort((left, right) => {
      return (
        left.lapTimeMs - right.lapTimeMs ||
        right.raceDate.getTime() - left.raceDate.getTime() ||
        right.createdAt.getTime() - left.createdAt.getTime()
      );
    });
  }

  private mapProfileRecord(record: ProfileRecordItem) {
    return {
      id: record.id,
      sourceType: record.sourceType,
      sourceSubmissionId: record.sourceSubmissionId,
      lapTimeMs: record.lapTimeMs,
      lapTimeText: record.lapTimeText,
      raceDate: record.raceDate,
      finalRanking: record.finalRanking,
      kartNo: record.kartNo,
      weather: record.weather,
      note: record.note,
      approvedAt: record.approvedAt,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      track: {
        id: record.track.id,
        name: record.track.name,
        location: record.track.location,
        lengthMeters: record.track.lengthMeters,
        layout: record.track.layout
      },
      kartType: {
        id: record.kartType.id,
        code: record.kartType.code,
        name: record.kartType.name,
        sortOrder: record.kartType.sortOrder
      },
      approvedBy: record.approvedBy
    };
  }

  private mapProfileSubmission(submission: ProfileSubmissionItem) {
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
      track: {
        id: submission.track.id,
        name: submission.track.name,
        location: submission.track.location
      },
      kartType: {
        id: submission.kartType.id,
        code: submission.kartType.code,
        name: submission.kartType.name,
        sortOrder: submission.kartType.sortOrder
      },
      reviewedBy: submission.reviewedBy,
      attachments: submission.attachments.map((attachment) => ({
        id: attachment.id,
        fileName: attachment.fileName,
        mimeType: attachment.mimeType,
        fileSize: attachment.fileSize,
        createdAt: attachment.createdAt,
        downloadPath: `/api/v1/submissions/attachments/${attachment.id}`
      }))
    };
  }

  private mapProfilePhoto(member: DatabaseMember) {
    const photo = member.memberProfile;

    if (!photo?.photoObjectKey || !photo.photoDisplayType) {
      return null;
    }

    return {
      displayType: photo.photoDisplayType,
      fileName: photo.photoFileName,
      mimeType: photo.photoMimeType,
      fileSize: photo.photoFileSize,
      updatedAt: photo.photoUpdatedAt,
      url: `/api/v1/members/${member.id}/photo`
    };
  }

  private mapMember(member: DatabaseMember) {
    return {
      id: member.id,
      username: member.username,
      nickname: member.nickname,
      role: getPrimaryRole(member),
      status: member.status,
      approvalStatus: member.memberProfile?.approvalStatus ?? null,
      photoDisplayType: member.memberProfile?.photoDisplayType ?? null,
      reviewNote: member.memberProfile?.reviewNote ?? null,
      reviewedById: member.memberProfile?.reviewedById ?? null,
      reviewedAt: member.memberProfile?.reviewedAt ?? null,
      createdAt: member.createdAt,
      updatedAt: member.updatedAt,
      lastLoginAt: member.lastLoginAt
    };
  }
}
