import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import {
  ApprovalStatus,
  RecordSourceType,
  RoleCode,
  UserStatus,
  type Prisma
} from "@prisma/client";

import {
  normalizeLapTimeText,
  parseLapTimeToMs
} from "src/common/utils/lap-time";
import { PrismaService } from "src/prisma/prisma.service";

import type { AuthenticatedRequestUser } from "../auth/auth.types";
import { assertAdminUser } from "../auth/auth.utils";
import { CreateRecordDto } from "./dto/create-record.dto";
import { UpdateRecordDto } from "./dto/update-record.dto";

interface RecordFilters {
  trackId?: string;
  kartTypeId?: string;
}

const recordInclude = {
  member: {
    select: {
      id: true,
      username: true,
      nickname: true
    }
  },
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

type RecordItem = Prisma.RecordGetPayload<{
  include: typeof recordInclude;
}>;

@Injectable()
export class RecordsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(payload: CreateRecordDto, currentUser: AuthenticatedRequestUser) {
    assertAdminUser(currentUser);
    await this.ensureEntities({
      memberId: payload.memberId,
      trackId: payload.trackId,
      kartTypeId: payload.kartTypeId
    });

    const normalizedLapTimeText = normalizeLapTimeText(payload.lapTimeText);
    const lapTimeMs = parseLapTimeToMs(normalizedLapTimeText);
    const approvedAt = new Date();

    const record = await this.prisma.record.create({
      data: {
        memberId: payload.memberId,
        trackId: payload.trackId,
        kartTypeId: payload.kartTypeId,
        sourceType: RecordSourceType.ADMIN,
        lapTimeMs,
        lapTimeText: normalizedLapTimeText,
        raceDate: new Date(payload.raceDate),
        finalRanking: payload.finalRanking ?? null,
        kartNo: this.normalizeOptionalText(payload.kartNo),
        weather: this.normalizeOptionalText(payload.weather),
        note: this.normalizeOptionalText(payload.note),
        approvedById: currentUser.user.id,
        approvedAt
      },
      include: recordInclude
    });

    return {
      success: true,
      item: this.mapRecord(record)
    };
  }

  async update(
    recordId: string,
    payload: UpdateRecordDto,
    currentUser: AuthenticatedRequestUser
  ) {
    assertAdminUser(currentUser);
    const record = await this.findRecordOrThrow(recordId);
    this.assertRecordEditable(record);

    const nextMemberId = payload.memberId ?? record.memberId;
    const nextTrackId = payload.trackId ?? record.trackId;
    const nextKartTypeId = payload.kartTypeId ?? record.kartTypeId;

    await this.ensureEntities({
      memberId: nextMemberId,
      trackId: nextTrackId,
      kartTypeId: nextKartTypeId
    });

    const updateData: Prisma.RecordUpdateInput = {
      member: {
        connect: {
          id: nextMemberId
        }
      },
      track: {
        connect: {
          id: nextTrackId
        }
      },
      kartType: {
        connect: {
          id: nextKartTypeId
        }
      },
      approvedBy: {
        connect: {
          id: currentUser.user.id
        }
      },
      approvedAt: new Date()
    };

    if (Object.prototype.hasOwnProperty.call(payload, "lapTimeText")) {
      const lapTimeText = payload.lapTimeText?.trim();
      if (!lapTimeText) {
        throw new BadRequestException("Lap time is required.");
      }

      const normalizedLapTimeText = normalizeLapTimeText(lapTimeText);
      updateData.lapTimeText = normalizedLapTimeText;
      updateData.lapTimeMs = parseLapTimeToMs(normalizedLapTimeText);
    }

    if (Object.prototype.hasOwnProperty.call(payload, "raceDate")) {
      if (!payload.raceDate) {
        throw new BadRequestException("Race date is required.");
      }

      updateData.raceDate = new Date(payload.raceDate);
    }

    if (Object.prototype.hasOwnProperty.call(payload, "finalRanking")) {
      updateData.finalRanking = payload.finalRanking ?? null;
    }

    if (Object.prototype.hasOwnProperty.call(payload, "kartNo")) {
      updateData.kartNo = this.normalizeOptionalText(payload.kartNo);
    }

    if (Object.prototype.hasOwnProperty.call(payload, "weather")) {
      updateData.weather = this.normalizeOptionalText(payload.weather);
    }

    if (Object.prototype.hasOwnProperty.call(payload, "note")) {
      updateData.note = this.normalizeOptionalText(payload.note);
    }

    const updatedRecord = await this.prisma.record.update({
      where: {
        id: record.id
      },
      data: updateData,
      include: recordInclude
    });

    return {
      success: true,
      item: this.mapRecord(updatedRecord)
    };
  }

  async remove(recordId: string, currentUser: AuthenticatedRequestUser) {
    assertAdminUser(currentUser);
    const record = await this.findRecordOrThrow(recordId);
    this.assertRecordEditable(record);

    await this.prisma.record.delete({
      where: {
        id: record.id
      }
    });

    return {
      success: true
    };
  }

  async findAll(filters: RecordFilters = {}) {
    const records = await this.prisma.record.findMany({
      where: this.buildWhere(filters),
      include: recordInclude
    });

    return this.sortRecords(records).map((record) => this.mapRecord(record));
  }

  async leaderboard(filters: RecordFilters = {}) {
    const records = await this.prisma.record.findMany({
      where: this.buildWhere(filters),
      include: recordInclude
    });
    const sortedRecords = this.sortRecords(records);
    const personalBestMap = new Map<string, RecordItem>();

    for (const record of sortedRecords) {
      const key = `${record.trackId}:${record.kartTypeId}:${record.memberId}`;
      const existing = personalBestMap.get(key);

      if (
        !existing ||
        record.lapTimeMs < existing.lapTimeMs ||
        (record.lapTimeMs === existing.lapTimeMs &&
          record.createdAt.getTime() < existing.createdAt.getTime())
      ) {
        personalBestMap.set(key, record);
      }
    }

    const grouped = new Map<string, RecordItem[]>();
    for (const record of personalBestMap.values()) {
      const key = `${record.trackId}:${record.kartTypeId}`;
      const group = grouped.get(key) ?? [];
      group.push(record);
      grouped.set(key, group);
    }

    const groups = Array.from(grouped.values()).map((group) => {
      const groupSorted = this.sortRecords(group);
      const [first] = groupSorted;

      return {
        track: {
          id: first.track.id,
          name: first.track.name,
          location: first.track.location
        },
        kartType: {
          id: first.kartType.id,
          code: first.kartType.code,
          name: first.kartType.name,
          sortOrder: first.kartType.sortOrder
        },
        items: groupSorted.map((record, index) => ({
          rank: index + 1,
          ...this.mapRecord(record)
        }))
      };
    });

    return groups.sort((left, right) => {
      return (
        left.track.name.localeCompare(right.track.name, "zh-CN") ||
        left.kartType.sortOrder - right.kartType.sortOrder
      );
    });
  }

  private buildWhere(filters: RecordFilters) {
    return {
      ...(filters.trackId ? { trackId: filters.trackId } : {}),
      ...(filters.kartTypeId ? { kartTypeId: filters.kartTypeId } : {})
    };
  }

  private async findRecordOrThrow(recordId: string) {
    const record = await this.prisma.record.findUnique({
      where: {
        id: recordId
      },
      include: recordInclude
    });

    if (!record) {
      throw new NotFoundException("Record not found.");
    }

    return record;
  }

  private assertRecordEditable(record: RecordItem) {
    if (record.sourceType !== RecordSourceType.ADMIN) {
      throw new ConflictException(
        "Records created from approved submissions cannot be edited or deleted here."
      );
    }
  }

  private async ensureEntities(args: {
    memberId: string;
    trackId: string;
    kartTypeId: string;
  }) {
    const [member, track, kartType] = await Promise.all([
      this.prisma.user.findFirst({
        where: {
          id: args.memberId,
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
        select: {
          id: true
        }
      }),
      this.prisma.track.findFirst({
        where: {
          id: args.trackId,
          isEnabled: true
        },
        select: {
          id: true
        }
      }),
      this.prisma.kartType.findFirst({
        where: {
          id: args.kartTypeId,
          isEnabled: true
        },
        select: {
          id: true
        }
      })
    ]);

    if (!member) {
      throw new NotFoundException("Member not found or not approved.");
    }

    if (!track) {
      throw new NotFoundException("Track not found.");
    }

    if (!kartType) {
      throw new NotFoundException("Kart type not found.");
    }
  }

  private sortRecords(records: RecordItem[]) {
    return [...records].sort((left, right) => {
      return (
        left.track.name.localeCompare(right.track.name, "zh-CN") ||
        left.kartType.sortOrder - right.kartType.sortOrder ||
        left.lapTimeMs - right.lapTimeMs ||
        left.createdAt.getTime() - right.createdAt.getTime()
      );
    });
  }

  private normalizeOptionalText(value: string | null | undefined) {
    const trimmed = value?.trim();
    return trimmed ? trimmed : null;
  }

  private mapRecord(record: RecordItem) {
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
      member: record.member,
      track: {
        id: record.track.id,
        name: record.track.name,
        location: record.track.location
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
}
