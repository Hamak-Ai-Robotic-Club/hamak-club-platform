const { randomBytes, createHash } = require("node:crypto");
const httpError = require("../../utils/httpError");
const { hashPassword, verifyPassword } = require("../../utils/password");
const { sessionTtlMs } = require("../../config/session");

async function login(prisma, username, password) {
  const user = await prisma.user.findUnique({
    where: { username },
    include: { team: true },
  });
  const passwordMatches = user?.passwordHash
    ? await verifyPassword(password, user.passwordHash)
    : (await hashPassword(password), false);

  if (!user || !passwordMatches) {
    throw httpError(401, "Invalid username or password.");
  }
  if (!user.isActive) throw httpError(403, "Account is frozen.");
  if (!["ADMIN", "TEAM"].includes((user.accountType || "").toUpperCase())) {
    throw httpError(403, "This account cannot log in.");
  }
  if (
    user.accountType.toUpperCase() === "TEAM" &&
    (!user.teamId || !user.team?.isActive)
  ) {
    throw httpError(403, "This account is not assigned to an active team.");
  }

  const token = randomBytes(32).toString("hex");
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const now = new Date();
  const expiresAt = new Date(now.getTime() + sessionTtlMs);

  const session = await prisma.$transaction(async (transaction) => {
    await transaction.$queryRaw`
      SELECT "id" FROM "users" WHERE "id" = ${user.id} FOR UPDATE
    `;

    if (user.accountType.toUpperCase() === "TEAM") {
      const activeSession = await transaction.session.findFirst({
        where: {
          userId: user.id,
          revokedAt: null,
          expiresAt: { gt: now },
        },
        select: { id: true },
      });
      if (activeSession) throw httpError(409, "Account already has an active session.");
    }

    return transaction.session.create({
      data: { userId: user.id, tokenHash, expiresAt },
    });
  });

  return {
    token,
    expiresAt,
    sessionId: session.id,
    user: {
      id: user.id.toString(),
      username: user.username,
      role: user.accountType.toUpperCase() === "ADMIN" ? "admin" : "user",
      teamId: user.teamId?.toString() || null,
      teamName: user.team?.name || null,
    },
  };
}

async function logout(prisma, sessionId) {
  await prisma.session.updateMany({
    where: { id: sessionId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

module.exports = { login, logout };
