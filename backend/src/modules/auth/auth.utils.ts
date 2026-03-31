import {
  ForbiddenException,
  UnauthorizedException
} from "@nestjs/common";
import { ApprovalStatus, RoleCode, UserStatus } from "@prisma/client";
import {
  createHash,
  pbkdf2Sync,
  randomBytes,
  timingSafeEqual
} from "node:crypto";

import type {
  AuthRole,
  AuthenticatedRequestUser,
  AuthUserResponse,
  DatabaseAuthUser
} from "./auth.types";

export function normalizeUsername(value: string) {
  return value.trim().toLowerCase();
}

export function createPasswordRecord(password: string) {
  const passwordSalt = randomBytes(16).toString("base64");
  const passwordHash = hashPassword(password, passwordSalt);

  return {
    passwordSalt,
    passwordHash
  };
}

export function hashPassword(password: string, passwordSalt: string) {
  return pbkdf2Sync(
    password,
    Buffer.from(passwordSalt, "base64"),
    100000,
    32,
    "sha1"
  ).toString("base64");
}

export function verifyPassword(
  password: string,
  passwordSalt: string,
  expectedHash: string
) {
  try {
    const actualHash = hashPassword(password, passwordSalt);
    const actualBuffer = Buffer.from(actualHash, "utf8");
    const expectedBuffer = Buffer.from(expectedHash, "utf8");

    if (actualBuffer.length !== expectedBuffer.length) {
      return false;
    }

    return timingSafeEqual(actualBuffer, expectedBuffer);
  } catch {
    return false;
  }
}

export function hashRefreshToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function getPrimaryRole(user: DatabaseAuthUser): AuthRole {
  const roleCodes = user.roles.map((item) => item.role.code);

  if (roleCodes.includes(RoleCode.SUPER_ADMIN)) {
    return "super_admin";
  }

  if (roleCodes.includes(RoleCode.ADMIN)) {
    return "admin";
  }

  return "member";
}

export function buildAuthUserResponse(user: DatabaseAuthUser): AuthUserResponse {
  return {
    id: user.id,
    username: user.username,
    nickname: user.nickname,
    role: getPrimaryRole(user)
  };
}

export function isAdminRole(role: AuthRole) {
  return role === "admin" || role === "super_admin";
}

export function assertAdminUser(currentUser: AuthenticatedRequestUser) {
  if (!isAdminRole(currentUser.user.role)) {
    throw new ForbiddenException("需要管理员权限。");
  }
}

export function assertMemberUser(currentUser: AuthenticatedRequestUser) {
  if (currentUser.user.role !== "member") {
    throw new ForbiddenException("需要会员权限。");
  }
}

export function assertUserCanLogin(user: DatabaseAuthUser) {
  if (user.status === UserStatus.PENDING) {
    throw new ForbiddenException("账号仍在审核中。");
  }

  if (user.status === UserStatus.REJECTED) {
    throw new ForbiddenException("账号审核未通过。");
  }

  if (user.status === UserStatus.DISABLED) {
    throw new ForbiddenException("账号已被停用。");
  }

  if (getPrimaryRole(user) !== "member" || !user.memberProfile) {
    return;
  }

  if (user.memberProfile.approvalStatus === ApprovalStatus.PENDING) {
    throw new ForbiddenException("会员账号仍在等待审核。");
  }

  if (user.memberProfile.approvalStatus === ApprovalStatus.REJECTED) {
    throw new UnauthorizedException("会员账号审核未通过。");
  }
}
