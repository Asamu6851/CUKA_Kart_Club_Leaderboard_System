import { PrismaClient } from "@prisma/client";

async function main() {
  const prisma = new PrismaClient();

  try {
    await prisma.$connect();

    const before = await collectCounts(prisma);

    await prisma.submissionAttachment.deleteMany();
    await prisma.record.deleteMany();
    await prisma.submission.deleteMany();
    await prisma.memberProfile.deleteMany();
    await prisma.refreshToken.deleteMany();
    await prisma.auditLog.deleteMany();
    await prisma.userRole.deleteMany();
    await prisma.user.deleteMany();
    await prisma.track.deleteMany();

    const after = await collectCounts(prisma);

    console.log("");
    console.log("Business data reset completed.");
    console.log("Before:");
    printCounts(before);
    console.log("After:");
    printCounts(after);
  } finally {
    await prisma.$disconnect();
  }
}

async function collectCounts(prisma: PrismaClient) {
  const [
    users,
    userRoles,
    memberProfiles,
    tracks,
    submissions,
    attachments,
    records,
    refreshTokens,
    auditLogs
  ] = await Promise.all([
    prisma.user.count(),
    prisma.userRole.count(),
    prisma.memberProfile.count(),
    prisma.track.count(),
    prisma.submission.count(),
    prisma.submissionAttachment.count(),
    prisma.record.count(),
    prisma.refreshToken.count(),
    prisma.auditLog.count()
  ]);

  return {
    users,
    userRoles,
    memberProfiles,
    tracks,
    submissions,
    attachments,
    records,
    refreshTokens,
    auditLogs
  };
}

function printCounts(counts: Awaited<ReturnType<typeof collectCounts>>) {
  console.log(`  users: ${counts.users}`);
  console.log(`  userRoles: ${counts.userRoles}`);
  console.log(`  memberProfiles: ${counts.memberProfiles}`);
  console.log(`  tracks: ${counts.tracks}`);
  console.log(`  submissions: ${counts.submissions}`);
  console.log(`  attachments: ${counts.attachments}`);
  console.log(`  records: ${counts.records}`);
  console.log(`  refreshTokens: ${counts.refreshTokens}`);
  console.log(`  auditLogs: ${counts.auditLogs}`);
}

main().catch((error) => {
  console.error("Business data reset failed.");
  console.error(error);
  process.exitCode = 1;
});
