import type { Prisma } from "@prisma/client";

export const authUserInclude = {
  roles: {
    include: {
      role: true
    }
  },
  memberProfile: true
} satisfies Prisma.UserInclude;

export type DatabaseAuthUser = Prisma.UserGetPayload<{
  include: typeof authUserInclude;
}>;

export type AuthRole = "super_admin" | "admin" | "member";

export interface AuthUserResponse {
  id: string;
  username: string;
  nickname: string;
  role: AuthRole;
}

export interface AuthTokenPayload {
  sub: string;
  username: string;
  role: AuthRole;
  type: "access" | "refresh";
  iat?: number;
  exp?: number;
}

export interface AuthenticatedRequestUser {
  user: AuthUserResponse;
  payload: AuthTokenPayload;
}

export interface RegisteredMemberResponse extends AuthUserResponse {
  status: string;
  approvalStatus: string;
}
