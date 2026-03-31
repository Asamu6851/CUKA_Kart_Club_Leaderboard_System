import { existsSync } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import * as path from "node:path";

import {
  ApprovalStatus,
  PrismaClient,
  RecordSourceType,
  RoleCode,
  SubmissionStatus,
  UserStatus
} from "@prisma/client";
import { Client as MinioClient } from "minio";

interface LegacyStore {
  version?: number;
  users?: LegacyUser[];
  tracks?: LegacyTrack[];
  submissions?: LegacySubmission[];
  records?: LegacyRecord[];
}

interface LegacyUser {
  id: string;
  username: string;
  nickname?: string;
  role?: string;
  approvalStatus?: string;
  passwordSalt: string;
  passwordHash: string;
  createdAt?: string;
  reviewNote?: string;
  reviewedById?: string;
  reviewedAt?: string;
}

interface LegacyTrack {
  id: string;
  name: string;
  location?: string;
  length?: number;
  layout?: string;
  note?: string;
  createdAt?: string;
}

interface LegacySubmission {
  id: string;
  memberId: string;
  trackId: string;
  lapTime?: string;
  lapTimeMs?: number;
  date?: string;
  ranking?: string | number;
  kartType?: string;
  kartNo?: string;
  weather?: string;
  note?: string;
  screenshotUrl?: string;
  status?: string;
  reviewNote?: string;
  reviewedById?: string;
  reviewedAt?: string;
  createdAt?: string;
  approvedRecordId?: string;
}

interface LegacyRecord {
  id: string;
  source?: string;
  submissionId?: string;
  memberId: string;
  trackId: string;
  lapTime?: string;
  lapTimeMs?: number;
  date?: string;
  ranking?: string | number;
  kartType?: string;
  kartNo?: string;
  weather?: string;
  note?: string;
  screenshotUrl?: string;
  approvedById?: string;
  approvedAt?: string;
  createdAt?: string;
}

interface MigrationSummary {
  usersCreated: number;
  usersUpdated: number;
  memberProfilesCreated: number;
  memberProfilesUpdated: number;
  tracksCreated: number;
  tracksUpdated: number;
  submissionsCreated: number;
  submissionsUpdated: number;
  recordsCreated: number;
  recordsUpdated: number;
  attachmentsCreated: number;
  attachmentsSkippedMissingFile: number;
}

const defaultSummary: MigrationSummary = {
  usersCreated: 0,
  usersUpdated: 0,
  memberProfilesCreated: 0,
  memberProfilesUpdated: 0,
  tracksCreated: 0,
  tracksUpdated: 0,
  submissionsCreated: 0,
  submissionsUpdated: 0,
  recordsCreated: 0,
  recordsUpdated: 0,
  attachmentsCreated: 0,
  attachmentsSkippedMissingFile: 0
};

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
    name: "Super 4T(200)",
    sortOrder: 30
  },
  {
    code: "super4t206",
    name: "Super 4T(206)",
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

async function main() {
  const prisma = new PrismaClient();
  const summary = { ...defaultSummary };

  const storePath = resolveStorePath();
  const uploadsRoot = resolveUploadsRoot(storePath);
  const store = await readLegacyStore(storePath);

  const minio = createMinioContext();

  const userIdMap = new Map<string, string>();
  const trackIdMap = new Map<string, string>();

  try {
    await prisma.$connect();
    await ensureRoles(prisma);
    await ensureKartTypes(prisma);

    const roleMap = await loadRoleMap(prisma);
    const kartTypeIdMap = await loadKartTypeIdMap(prisma);

    await migrateUsers(prisma, store.users ?? [], roleMap, userIdMap, summary);
    await migrateMemberProfiles(prisma, store.users ?? [], userIdMap, summary);
    await migrateTracks(prisma, store.tracks ?? [], trackIdMap, summary);
    await migrateSubmissions(
      prisma,
      store.submissions ?? [],
      userIdMap,
      trackIdMap,
      kartTypeIdMap,
      summary
    );
    await migrateRecords(
      prisma,
      store.records ?? [],
      userIdMap,
      trackIdMap,
      kartTypeIdMap,
      summary
    );
    await backfillMissingSubmissionRecords(
      prisma,
      store.submissions ?? [],
      userIdMap,
      trackIdMap,
      kartTypeIdMap,
      summary
    );
    await migrateAttachments(
      prisma,
      store.submissions ?? [],
      uploadsRoot,
      minio,
      summary
    );

    printSummary(storePath, uploadsRoot, summary);
  } finally {
    await prisma.$disconnect();
  }
}

function resolveStorePath() {
  const candidate = process.argv[2] || process.env.LEGACY_STORE_PATH;
  if (!candidate) {
    throw new Error(
      "Missing store path. Usage: npm run migrate:store-json -- <path-to-store.json> [path-to-uploads]"
    );
  }

  return path.resolve(candidate);
}

function resolveUploadsRoot(storePath: string) {
  const explicit = process.argv[3] || process.env.LEGACY_UPLOADS_PATH;
  if (explicit) {
    return path.resolve(explicit);
  }

  return path.resolve(path.dirname(storePath), "uploads");
}

async function readLegacyStore(storePath: string) {
  if (!existsSync(storePath)) {
    throw new Error(`Legacy store file does not exist: ${storePath}`);
  }

  const raw = await readFile(storePath, "utf8");
  return JSON.parse(raw.replace(/^\uFEFF/, "")) as LegacyStore;
}

async function ensureRoles(prisma: PrismaClient) {
  for (const role of defaultRoles) {
    await prisma.role.upsert({
      where: {
        code: role.code
      },
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

async function ensureKartTypes(prisma: PrismaClient) {
  for (const kartType of defaultKartTypes) {
    await prisma.kartType.upsert({
      where: {
        code: kartType.code
      },
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

async function loadRoleMap(prisma: PrismaClient) {
  const roles = await prisma.role.findMany();
  return new Map(roles.map((role) => [role.code, role.id]));
}

async function loadKartTypeIdMap(prisma: PrismaClient) {
  const kartTypes = await prisma.kartType.findMany({
    where: {
      isEnabled: true
    }
  });

  return new Map(kartTypes.map((kartType) => [kartType.code, kartType.id]));
}

async function migrateUsers(
  prisma: PrismaClient,
  legacyUsers: LegacyUser[],
  roleMap: Map<RoleCode, string>,
  userIdMap: Map<string, string>,
  summary: MigrationSummary
) {
  for (const legacyUser of legacyUsers) {
    const username = normalizeUsername(legacyUser.username);
    const roleCode = mapLegacyRole(legacyUser.role);
    const roleId = roleMap.get(roleCode);

    if (!roleId) {
      throw new Error(`Role is not initialized: ${roleCode}`);
    }

    const existingById = await prisma.user.findUnique({
      where: {
        id: legacyUser.id
      }
    });
    const existingByUsername =
      existingById ??
      (await prisma.user.findUnique({
        where: {
          username
        }
      }));

    const userData = {
      username,
      nickname: normalizeOptionalText(legacyUser.nickname) || username,
      passwordSalt: legacyUser.passwordSalt,
      passwordHash: legacyUser.passwordHash,
      status: mapLegacyUserStatus(roleCode, legacyUser.approvalStatus),
      lastLoginAt: null,
      createdAt: parseDateTime(legacyUser.createdAt) ?? new Date()
    };

    const targetUser = existingByUsername
      ? await prisma.user.update({
          where: {
            id: existingByUsername.id
          },
          data: {
            username: userData.username,
            nickname: userData.nickname,
            passwordSalt: userData.passwordSalt,
            passwordHash: userData.passwordHash,
            status: userData.status
          }
        })
      : await prisma.user.create({
          data: {
            id: legacyUser.id,
            username: userData.username,
            nickname: userData.nickname,
            passwordSalt: userData.passwordSalt,
            passwordHash: userData.passwordHash,
            status: userData.status,
            createdAt: userData.createdAt
          }
        });

    userIdMap.set(legacyUser.id, targetUser.id);

    await prisma.userRole.upsert({
      where: {
        userId_roleId: {
          userId: targetUser.id,
          roleId
        }
      },
      update: {},
      create: {
        userId: targetUser.id,
        roleId
      }
    });

    if (existingByUsername) {
      summary.usersUpdated += 1;
    } else {
      summary.usersCreated += 1;
    }
  }
}

async function migrateMemberProfiles(
  prisma: PrismaClient,
  legacyUsers: LegacyUser[],
  userIdMap: Map<string, string>,
  summary: MigrationSummary
) {
  for (const legacyUser of legacyUsers) {
    if (mapLegacyRole(legacyUser.role) !== RoleCode.MEMBER) {
      continue;
    }

    const userId = userIdMap.get(legacyUser.id);
    if (!userId) {
      throw new Error(`Member user mapping is missing: ${legacyUser.id}`);
    }

    const reviewedById = legacyUser.reviewedById
      ? userIdMap.get(legacyUser.reviewedById) ?? null
      : null;
    const approvalStatus = mapLegacyApprovalStatus(legacyUser.approvalStatus);

    const existingProfile = await prisma.memberProfile.findUnique({
      where: {
        userId
      }
    });

    if (existingProfile) {
      await prisma.memberProfile.update({
        where: {
          userId
        },
        data: {
          approvalStatus,
          reviewNote: normalizeOptionalText(legacyUser.reviewNote),
          reviewedById,
          reviewedAt: parseDateTime(legacyUser.reviewedAt)
        }
      });
      summary.memberProfilesUpdated += 1;
      continue;
    }

    await prisma.memberProfile.create({
      data: {
        userId,
        approvalStatus,
        reviewNote: normalizeOptionalText(legacyUser.reviewNote),
        reviewedById,
        reviewedAt: parseDateTime(legacyUser.reviewedAt),
        createdAt: parseDateTime(legacyUser.createdAt) ?? new Date()
      }
    });
    summary.memberProfilesCreated += 1;
  }
}

async function migrateTracks(
  prisma: PrismaClient,
  legacyTracks: LegacyTrack[],
  trackIdMap: Map<string, string>,
  summary: MigrationSummary
) {
  for (const legacyTrack of legacyTracks) {
    const existingById = await prisma.track.findUnique({
      where: {
        id: legacyTrack.id
      }
    });
    const existingByName =
      existingById ??
      (await prisma.track.findFirst({
        where: {
          name: legacyTrack.name.trim(),
          location: normalizeOptionalText(legacyTrack.location)
        }
      }));

    const targetTrack = existingByName
      ? await prisma.track.update({
          where: {
            id: existingByName.id
          },
          data: {
            name: legacyTrack.name.trim(),
            location: normalizeOptionalText(legacyTrack.location),
            lengthMeters: normalizeOptionalNumber(legacyTrack.length),
            layout: normalizeOptionalText(legacyTrack.layout),
            note: normalizeOptionalText(legacyTrack.note),
            isEnabled: true
          }
        })
      : await prisma.track.create({
          data: {
            id: legacyTrack.id,
            name: legacyTrack.name.trim(),
            location: normalizeOptionalText(legacyTrack.location),
            lengthMeters: normalizeOptionalNumber(legacyTrack.length),
            layout: normalizeOptionalText(legacyTrack.layout),
            note: normalizeOptionalText(legacyTrack.note),
            isEnabled: true,
            createdAt: parseDateTime(legacyTrack.createdAt) ?? new Date()
          }
        });

    trackIdMap.set(legacyTrack.id, targetTrack.id);

    if (existingByName) {
      summary.tracksUpdated += 1;
    } else {
      summary.tracksCreated += 1;
    }
  }
}

async function migrateSubmissions(
  prisma: PrismaClient,
  legacySubmissions: LegacySubmission[],
  userIdMap: Map<string, string>,
  trackIdMap: Map<string, string>,
  kartTypeIdMap: Map<string, string>,
  summary: MigrationSummary
) {
  for (const legacySubmission of legacySubmissions) {
    const memberId = resolveMappedId(userIdMap, legacySubmission.memberId, "user");
    const trackId = resolveMappedId(trackIdMap, legacySubmission.trackId, "track");
    const kartTypeId = resolveKartTypeId(legacySubmission.kartType, kartTypeIdMap);
    const reviewedById = legacySubmission.reviewedById
      ? userIdMap.get(legacySubmission.reviewedById) ?? null
      : null;

    const existingSubmission = await prisma.submission.findUnique({
      where: {
        id: legacySubmission.id
      }
    });

    const submissionData = {
      memberId,
      trackId,
      kartTypeId,
      lapTimeMs: resolveLapTimeMs(legacySubmission.lapTimeMs, legacySubmission.lapTime),
      lapTimeText: normalizeLapTimeText(legacySubmission.lapTime),
      raceDate: parseDateOnly(legacySubmission.date),
      finalRanking: normalizeRanking(legacySubmission.ranking),
      kartNo: normalizeOptionalText(legacySubmission.kartNo),
      weather: normalizeOptionalText(legacySubmission.weather),
      note: normalizeOptionalText(legacySubmission.note),
      status: mapLegacySubmissionStatus(legacySubmission.status),
      reviewNote: normalizeOptionalText(legacySubmission.reviewNote),
      reviewedById,
      reviewedAt: parseDateTime(legacySubmission.reviewedAt),
      createdAt: parseDateTime(legacySubmission.createdAt) ?? new Date()
    };

    if (existingSubmission) {
      await prisma.submission.update({
        where: {
          id: existingSubmission.id
        },
        data: {
          memberId: submissionData.memberId,
          trackId: submissionData.trackId,
          kartTypeId: submissionData.kartTypeId,
          lapTimeMs: submissionData.lapTimeMs,
          lapTimeText: submissionData.lapTimeText,
          raceDate: submissionData.raceDate,
          finalRanking: submissionData.finalRanking,
          kartNo: submissionData.kartNo,
          weather: submissionData.weather,
          note: submissionData.note,
          status: submissionData.status,
          reviewNote: submissionData.reviewNote,
          reviewedById: submissionData.reviewedById,
          reviewedAt: submissionData.reviewedAt
        }
      });
      summary.submissionsUpdated += 1;
      continue;
    }

    await prisma.submission.create({
      data: {
        id: legacySubmission.id,
        memberId: submissionData.memberId,
        trackId: submissionData.trackId,
        kartTypeId: submissionData.kartTypeId,
        lapTimeMs: submissionData.lapTimeMs,
        lapTimeText: submissionData.lapTimeText,
        raceDate: submissionData.raceDate,
        finalRanking: submissionData.finalRanking,
        kartNo: submissionData.kartNo,
        weather: submissionData.weather,
        note: submissionData.note,
        status: submissionData.status,
        reviewNote: submissionData.reviewNote,
        reviewedById: submissionData.reviewedById,
        reviewedAt: submissionData.reviewedAt,
        createdAt: submissionData.createdAt
      }
    });
    summary.submissionsCreated += 1;
  }
}

async function migrateRecords(
  prisma: PrismaClient,
  legacyRecords: LegacyRecord[],
  userIdMap: Map<string, string>,
  trackIdMap: Map<string, string>,
  kartTypeIdMap: Map<string, string>,
  summary: MigrationSummary
) {
  for (const legacyRecord of legacyRecords) {
    const memberId = resolveMappedId(userIdMap, legacyRecord.memberId, "user");
    const trackId = resolveMappedId(trackIdMap, legacyRecord.trackId, "track");
    const kartTypeId = resolveKartTypeId(legacyRecord.kartType, kartTypeIdMap);
    const approvedById = legacyRecord.approvedById
      ? userIdMap.get(legacyRecord.approvedById) ?? null
      : null;
    const sourceSubmissionId = normalizeOptionalText(legacyRecord.submissionId);

    const existingRecord =
      (await prisma.record.findUnique({
        where: {
          id: legacyRecord.id
        }
      })) ||
      (sourceSubmissionId
        ? await prisma.record.findUnique({
            where: {
              sourceSubmissionId
            }
          })
        : null);

    const recordData = {
      memberId,
      trackId,
      kartTypeId,
      sourceType: mapLegacySourceType(legacyRecord.source),
      sourceSubmissionId,
      lapTimeMs: resolveLapTimeMs(legacyRecord.lapTimeMs, legacyRecord.lapTime),
      lapTimeText: normalizeLapTimeText(legacyRecord.lapTime),
      raceDate: parseDateOnly(legacyRecord.date),
      finalRanking: normalizeRanking(legacyRecord.ranking),
      kartNo: normalizeOptionalText(legacyRecord.kartNo),
      weather: normalizeOptionalText(legacyRecord.weather),
      note: normalizeOptionalText(legacyRecord.note),
      approvedById,
      approvedAt: parseDateTime(legacyRecord.approvedAt),
      createdAt: parseDateTime(legacyRecord.createdAt) ?? new Date()
    };

    if (existingRecord) {
      await prisma.record.update({
        where: {
          id: existingRecord.id
        },
        data: {
          memberId: recordData.memberId,
          trackId: recordData.trackId,
          kartTypeId: recordData.kartTypeId,
          sourceType: recordData.sourceType,
          sourceSubmissionId: recordData.sourceSubmissionId,
          lapTimeMs: recordData.lapTimeMs,
          lapTimeText: recordData.lapTimeText,
          raceDate: recordData.raceDate,
          finalRanking: recordData.finalRanking,
          kartNo: recordData.kartNo,
          weather: recordData.weather,
          note: recordData.note,
          approvedById: recordData.approvedById,
          approvedAt: recordData.approvedAt
        }
      });
      summary.recordsUpdated += 1;
      continue;
    }

    await prisma.record.create({
      data: {
        id: legacyRecord.id,
        memberId: recordData.memberId,
        trackId: recordData.trackId,
        kartTypeId: recordData.kartTypeId,
        sourceType: recordData.sourceType,
        sourceSubmissionId: recordData.sourceSubmissionId,
        lapTimeMs: recordData.lapTimeMs,
        lapTimeText: recordData.lapTimeText,
        raceDate: recordData.raceDate,
        finalRanking: recordData.finalRanking,
        kartNo: recordData.kartNo,
        weather: recordData.weather,
        note: recordData.note,
        approvedById: recordData.approvedById,
        approvedAt: recordData.approvedAt,
        createdAt: recordData.createdAt
      }
    });
    summary.recordsCreated += 1;
  }
}

async function backfillMissingSubmissionRecords(
  prisma: PrismaClient,
  legacySubmissions: LegacySubmission[],
  userIdMap: Map<string, string>,
  trackIdMap: Map<string, string>,
  kartTypeIdMap: Map<string, string>,
  summary: MigrationSummary
) {
  for (const legacySubmission of legacySubmissions) {
    if (mapLegacySubmissionStatus(legacySubmission.status) !== SubmissionStatus.APPROVED) {
      continue;
    }

    const existingRecord = await prisma.record.findUnique({
      where: {
        sourceSubmissionId: legacySubmission.id
      }
    });

    if (existingRecord) {
      continue;
    }

    const memberId = resolveMappedId(userIdMap, legacySubmission.memberId, "user");
    const trackId = resolveMappedId(trackIdMap, legacySubmission.trackId, "track");
    const kartTypeId = resolveKartTypeId(legacySubmission.kartType, kartTypeIdMap);
    const approvedById = legacySubmission.reviewedById
      ? userIdMap.get(legacySubmission.reviewedById) ?? null
      : null;

    await prisma.record.create({
      data: {
        memberId,
        trackId,
        kartTypeId,
        sourceType: RecordSourceType.SUBMISSION,
        sourceSubmissionId: legacySubmission.id,
        lapTimeMs: resolveLapTimeMs(legacySubmission.lapTimeMs, legacySubmission.lapTime),
        lapTimeText: normalizeLapTimeText(legacySubmission.lapTime),
        raceDate: parseDateOnly(legacySubmission.date),
        finalRanking: normalizeRanking(legacySubmission.ranking),
        kartNo: normalizeOptionalText(legacySubmission.kartNo),
        weather: normalizeOptionalText(legacySubmission.weather),
        note: normalizeOptionalText(legacySubmission.note),
        approvedById,
        approvedAt: parseDateTime(legacySubmission.reviewedAt)
      }
    });

    summary.recordsCreated += 1;
  }
}

async function migrateAttachments(
  prisma: PrismaClient,
  legacySubmissions: LegacySubmission[],
  uploadsRoot: string,
  minio: MinioContext | null,
  summary: MigrationSummary
) {
  if (!existsSync(uploadsRoot) || !minio) {
    const submissionsWithScreenshot = legacySubmissions.filter((item) =>
      normalizeOptionalText(item.screenshotUrl)
    );
    summary.attachmentsSkippedMissingFile += submissionsWithScreenshot.length;
    return;
  }

  await ensureBucketReady(minio);

  for (const legacySubmission of legacySubmissions) {
    const screenshotUrl = normalizeOptionalText(legacySubmission.screenshotUrl);
    if (!screenshotUrl) {
      continue;
    }

    const sourceFilePath = resolveLegacyAttachmentPath(uploadsRoot, screenshotUrl);
    if (!sourceFilePath || !existsSync(sourceFilePath)) {
      summary.attachmentsSkippedMissingFile += 1;
      continue;
    }

    const existingAttachment = await prisma.submissionAttachment.findFirst({
      where: {
        submissionId: legacySubmission.id,
        fileName: path.basename(sourceFilePath)
      }
    });

    if (existingAttachment) {
      continue;
    }

    const fileBuffer = await readFile(sourceFilePath);
    const fileStat = await stat(sourceFilePath);
    const fileName = path.basename(sourceFilePath);
    const mimeType = inferMimeType(fileName);
    const objectKey = buildAttachmentObjectKey(legacySubmission.id, fileName);

    await minio.client.putObject(minio.bucketName, objectKey, fileBuffer, fileBuffer.length, {
      "Content-Type": mimeType
    });

    await prisma.submissionAttachment.create({
      data: {
        submissionId: legacySubmission.id,
        bucket: minio.bucketName,
        objectKey,
        fileName,
        mimeType,
        fileSize: Number(fileStat.size)
      }
    });
    summary.attachmentsCreated += 1;
  }
}

function resolveMappedId(
  idMap: Map<string, string>,
  legacyId: string,
  label: string
) {
  const mappedId = idMap.get(legacyId);
  if (!mappedId) {
    throw new Error(`Missing ${label} mapping for legacy id: ${legacyId}`);
  }

  return mappedId;
}

function mapLegacyRole(value?: string) {
  const normalized = (value || "member").trim().toLowerCase();
  if (normalized === "admin" || normalized === "super_admin") {
    return RoleCode.ADMIN;
  }

  return RoleCode.MEMBER;
}

function mapLegacyApprovalStatus(value?: string) {
  const normalized = (value || "pending").trim().toLowerCase();

  switch (normalized) {
    case "approved":
      return ApprovalStatus.APPROVED;
    case "rejected":
      return ApprovalStatus.REJECTED;
    default:
      return ApprovalStatus.PENDING;
  }
}

function mapLegacyUserStatus(roleCode: RoleCode, approvalStatus?: string) {
  if (roleCode === RoleCode.ADMIN || roleCode === RoleCode.SUPER_ADMIN) {
    return UserStatus.ACTIVE;
  }

  switch (mapLegacyApprovalStatus(approvalStatus)) {
    case ApprovalStatus.APPROVED:
      return UserStatus.ACTIVE;
    case ApprovalStatus.REJECTED:
      return UserStatus.REJECTED;
    default:
      return UserStatus.PENDING;
  }
}

function mapLegacySubmissionStatus(value?: string) {
  const normalized = (value || "pending").trim().toLowerCase();

  switch (normalized) {
    case "approved":
      return SubmissionStatus.APPROVED;
    case "rejected":
      return SubmissionStatus.REJECTED;
    case "cancelled":
    case "canceled":
      return SubmissionStatus.CANCELLED;
    default:
      return SubmissionStatus.PENDING;
  }
}

function mapLegacySourceType(value?: string) {
  const normalized = (value || "submission").trim().toLowerCase();
  return normalized === "admin" ? RecordSourceType.ADMIN : RecordSourceType.SUBMISSION;
}

function resolveKartTypeId(
  legacyKartType: string | undefined,
  kartTypeIdMap: Map<string, string>
) {
  const code = mapLegacyKartTypeToCode(legacyKartType);
  const kartTypeId = kartTypeIdMap.get(code);

  if (!kartTypeId) {
    throw new Error(`Kart type is not initialized: ${legacyKartType ?? "<empty>"}`);
  }

  return kartTypeId;
}

function mapLegacyKartTypeToCode(value?: string) {
  const normalized = normalizeKartTypeKey(value);
  const mapping: Record<string, string> = {
    "200cc": "200cc",
    "270cc": "270cc",
    "super4t200": "super4t200",
    "super4t206": "super4t206",
    "gpmax": "gpmax",
    "x30": "x30",
    "超级4t200": "super4t200",
    "超级4t206": "super4t206",
    "瓒呯骇4t200": "super4t200",
    "瓒呯骇4t206": "super4t206"
  };

  const code = mapping[normalized];
  if (!code) {
    throw new Error(`Unsupported kart type value: ${value ?? "<empty>"}`);
  }

  return code;
}

function normalizeKartTypeKey(value?: string) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[\-_]/g, "")
    .replace(/[()]/g, "");
}

function normalizeUsername(value: string) {
  return value.trim().toLowerCase();
}

function normalizeOptionalText(value?: string | null) {
  const text = String(value ?? "").trim();
  return text ? text : null;
}

function normalizeOptionalNumber(value?: number | null) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function normalizeRanking(value?: string | number | null) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  const text = String(value ?? "").trim();
  if (!text) {
    return null;
  }

  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : null;
}

function resolveLapTimeMs(lapTimeMs?: number, lapTimeText?: string) {
  if (typeof lapTimeMs === "number" && Number.isFinite(lapTimeMs)) {
    return lapTimeMs;
  }

  return parseLapTimeToMs(normalizeLapTimeText(lapTimeText));
}

function normalizeLapTimeText(value?: string) {
  const normalized = String(value ?? "").trim().replace(/\s+/g, "");
  if (!normalized) {
    throw new Error("Lap time text is missing.");
  }

  return normalized;
}

function parseLapTimeToMs(rawValue: string) {
  if (/^\d+$/.test(rawValue)) {
    return Number(rawValue);
  }

  const minuteSecondMatch = rawValue.match(/^(\d+):(\d{1,2})\.(\d{1,3})$/);
  if (minuteSecondMatch) {
    const minutes = Number(minuteSecondMatch[1]);
    const seconds = Number(minuteSecondMatch[2]);
    const milliseconds = normalizeMilliseconds(minuteSecondMatch[3]);
    return minutes * 60 * 1000 + seconds * 1000 + milliseconds;
  }

  const secondMatch = rawValue.match(/^(\d+)\.(\d{1,3})$/);
  if (secondMatch) {
    const seconds = Number(secondMatch[1]);
    const milliseconds = normalizeMilliseconds(secondMatch[2]);
    return seconds * 1000 + milliseconds;
  }

  throw new Error(`Invalid lap time format: ${rawValue}`);
}

function normalizeMilliseconds(value: string) {
  if (value.length === 3) {
    return Number(value);
  }

  if (value.length === 2) {
    return Number(`${value}0`);
  }

  return Number(`${value}00`);
}

function parseDateTime(value?: string | null) {
  const text = String(value ?? "").trim();
  if (!text) {
    return null;
  }

  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function parseDateOnly(value?: string | null) {
  const text = String(value ?? "").trim();
  if (!text) {
    throw new Error("Race date is missing.");
  }

  return new Date(`${text}T00:00:00.000Z`);
}

interface MinioContext {
  client: MinioClient;
  bucketName: string;
}

function createMinioContext(): MinioContext | null {
  const endPoint = process.env.MINIO_ENDPOINT;
  const accessKey = process.env.MINIO_ACCESS_KEY;
  const secretKey = process.env.MINIO_SECRET_KEY;

  if (!endPoint || !accessKey || !secretKey) {
    return null;
  }

  return {
    bucketName: process.env.MINIO_BUCKET || "cuka-records",
    client: new MinioClient({
      endPoint,
      port: Number(process.env.MINIO_PORT || 9000),
      useSSL: String(process.env.MINIO_USE_SSL || "false").toLowerCase() === "true",
      accessKey,
      secretKey
    })
  };
}

async function ensureBucketReady(minio: MinioContext) {
  const exists = await minio.client.bucketExists(minio.bucketName).catch(() => false);
  if (!exists) {
    await minio.client.makeBucket(minio.bucketName, "us-east-1").catch(() => undefined);
  }
}

function resolveLegacyAttachmentPath(uploadsRoot: string, screenshotUrl: string) {
  const cleaned = screenshotUrl.replace(/\\/g, "/");
  const fileName = path.basename(cleaned);
  if (!fileName) {
    return null;
  }

  return path.join(uploadsRoot, fileName);
}

function buildAttachmentObjectKey(submissionId: string, fileName: string) {
  return [
    "submissions",
    submissionId,
    `${Date.now()}-${Math.random().toString(36).slice(2, 10)}-${sanitizeFileName(fileName)}`
  ].join("/");
}

function sanitizeFileName(fileName: string) {
  const cleaned = fileName
    .trim()
    .replace(/[^\w.-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  return cleaned || "attachment";
}

function inferMimeType(fileName: string) {
  const ext = path.extname(fileName).toLowerCase();

  switch (ext) {
    case ".png":
      return "image/png";
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".webp":
      return "image/webp";
    case ".gif":
      return "image/gif";
    default:
      return "application/octet-stream";
  }
}

function printSummary(
  storePath: string,
  uploadsRoot: string,
  summary: MigrationSummary
) {
  console.log("");
  console.log("Legacy JSON migration completed.");
  console.log(`Store file: ${storePath}`);
  console.log(`Uploads root: ${uploadsRoot}`);
  console.log("");
  console.log("Users:");
  console.log(`  created: ${summary.usersCreated}`);
  console.log(`  updated: ${summary.usersUpdated}`);
  console.log("Member profiles:");
  console.log(`  created: ${summary.memberProfilesCreated}`);
  console.log(`  updated: ${summary.memberProfilesUpdated}`);
  console.log("Tracks:");
  console.log(`  created: ${summary.tracksCreated}`);
  console.log(`  updated: ${summary.tracksUpdated}`);
  console.log("Submissions:");
  console.log(`  created: ${summary.submissionsCreated}`);
  console.log(`  updated: ${summary.submissionsUpdated}`);
  console.log("Records:");
  console.log(`  created: ${summary.recordsCreated}`);
  console.log(`  updated: ${summary.recordsUpdated}`);
  console.log("Attachments:");
  console.log(`  created: ${summary.attachmentsCreated}`);
  console.log(`  skipped_missing_file: ${summary.attachmentsSkippedMissingFile}`);
}

main().catch((error) => {
  console.error("Legacy JSON migration failed.");
  console.error(error);
  process.exitCode = 1;
});
