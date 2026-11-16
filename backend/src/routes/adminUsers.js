const express = require("express");
const requireAdmin = require("../middleware/requireAdmin");
const { writeAuditLog } = require("../audit");
const { hashPassword } = require("../utils/password");
const httpError = require("../utils/httpError");

const usernamePattern = /^[a-z0-9._-]{3,64}$/;

function parseId(value) {
  if (typeof value !== "string" || !/^[1-9]\d*$/.test(value)) {
    throw httpError(400, "User id must be a positive integer.");
  }
  return BigInt(value);
}

function validatePassword(password) {
  if (typeof password !== "string" || password.length < 8 || password.length > 1024) {
    throw httpError(422, "Password must be at least 8 characters.");
  }
}

function serializeUser(user, now = new Date()) {
  const activeSessions = (user.sessions || []).filter(
    (session) => !session.revokedAt && session.expiresAt > now,
  ).length;
  const role = (user.accountType || "").toUpperCase() === "ADMIN" ? "admin" : "user";
  return {
    id: user.id.toString(),
    username: user.username,
    displayName: user.displayName,
    role,
    accountType: user.accountType,
    teamId: user.teamId?.toString() || null,
    teamName: user.team?.name || null,
    isActive: user.isActive,
    isFrozen: !user.isActive,
    archived: Boolean(user.team && !user.team.isActive),
    activeSessions,
    createdAt: user.createdAt,
  };
}

const userInclude = {
  team: { select: { name: true, isActive: true } },
  sessions: { select: { revokedAt: true, expiresAt: true } },
};

async function revokeSessions(transaction, userId) {
  const result = await transaction.session.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  return result.count;
}

function createAdminUsersRouter(prisma) {
  const router = express.Router();
  router.use(...requireAdmin(prisma));

  router.get("/users", async (req, res, next) => {
    try {
      const includeArchived = req.query.archived === "1";
      const users = await prisma.user.findMany({
        where: {
          accountType: { in: ["ADMIN", "TEAM"] },
          username: { not: null },
          ...(includeArchived ? {} : { OR: [{ teamId: null }, { team: { isActive: true } }] }),
        },
        include: userInclude,
        orderBy: [{ accountType: "asc" }, { id: "asc" }],
      });
      res.set("Cache-Control", "no-store");
      res.json({ items: users.map((user) => serializeUser(user)) });
    } catch (error) {
      next(error);
    }
  });

  router.post("/users", async (req, res, next) => {
    try {
      const { username, password, accountType, teamName, displayName } = req.body || {};
      const normalizedUsername = typeof username === "string" ? username.trim().toLowerCase() : "";
      if (!usernamePattern.test(normalizedUsername)) {
        throw httpError(422, "Username must be 3-64 lowercase letters, digits, or . _ - characters.");
      }
      validatePassword(password);
      const type = String(accountType || "").toUpperCase();
      if (!["ADMIN", "TEAM"].includes(type)) throw httpError(422, "accountType must be ADMIN or TEAM.");
      const name = typeof teamName === "string" ? teamName.trim() : "";
      if (type === "TEAM" && (name.length < 2 || name.length > 80)) {
        throw httpError(422, "A team name between 2 and 80 characters is required.");
      }
      const label =
        typeof displayName === "string" && displayName.trim()
          ? displayName.trim().slice(0, 80)
          : type === "TEAM" ? name : normalizedUsername;

      const passwordHash = await hashPassword(password);
      const user = await prisma.$transaction(async (transaction) => {
        const existing = await transaction.user.findFirst({
          where: { username: { equals: normalizedUsername, mode: "insensitive" } },
          select: { id: true },
        });
        if (existing) throw httpError(409, "Username is already taken.");

        let teamId = null;
        if (type === "TEAM") {
          let team = await transaction.team.findFirst({
            where: { name: { equals: name, mode: "insensitive" }, isActive: true },
            include: { leader: { select: { id: true } } },
          });
          if (team?.leader) throw httpError(409, "This team already has an account.");
          if (!team) team = await transaction.team.create({ data: { name } });
          teamId = team.id;
        }

        const created = await transaction.user.create({
          data: {
            username: normalizedUsername,
            passwordHash,
            accountType: type,
            teamId,
            displayName: label,
          },
          include: userInclude,
        });
        await writeAuditLog(transaction, {
          actorUserId: BigInt(req.user.sub),
          entityType: "user",
          entityId: created.id.toString(),
          action: "USER_CREATED",
          afterData: { username: created.username, accountType: type, teamName: type === "TEAM" ? name : null },
        });
        return created;
      });
      res.status(201).json({ item: serializeUser(user) });
    } catch (error) {
      next(error);
    }
  });

  router.patch("/users/:id/status", async (req, res, next) => {
    try {
      const id = parseId(req.params.id);
      const { isActive } = req.body || {};
      if (typeof isActive !== "boolean") throw httpError(422, "isActive must be a boolean.");
      if (!isActive && id.toString() === req.user.id) {
        throw httpError(409, "You cannot freeze your own account.");
      }
      const user = await prisma.$transaction(async (transaction) => {
        const current = await transaction.user.findUnique({ where: { id } });
        if (!current || !current.username) throw httpError(404, "User not found.");
        const updated = await transaction.user.update({ where: { id }, data: { isActive } });
        // Freezing an account invalidates its sessions immediately (spec §02).
        const revoked = isActive ? 0 : await revokeSessions(transaction, id);
        await writeAuditLog(transaction, {
          actorUserId: BigInt(req.user.sub),
          entityType: "user",
          entityId: id.toString(),
          action: isActive ? "USER_UNFROZEN" : "USER_FROZEN",
          beforeData: { isActive: current.isActive },
          afterData: { isActive: updated.isActive, revokedSessions: revoked },
        });
        return transaction.user.findUnique({ where: { id }, include: userInclude });
      });
      res.json({ item: serializeUser(user) });
    } catch (error) {
      next(error);
    }
  });

  router.post("/users/:id/reset-password", async (req, res, next) => {
    try {
      const id = parseId(req.params.id);
      validatePassword(req.body?.password);
      const passwordHash = await hashPassword(req.body.password);
      const user = await prisma.$transaction(async (transaction) => {
        const current = await transaction.user.findUnique({ where: { id } });
        if (!current || !current.username) throw httpError(404, "User not found.");
        await transaction.user.update({ where: { id }, data: { passwordHash } });
        const revoked = await revokeSessions(transaction, id);
        await writeAuditLog(transaction, {
          actorUserId: BigInt(req.user.sub),
          entityType: "user",
          entityId: id.toString(),
          action: "USER_CREDENTIAL_RESET",
          afterData: { revokedSessions: revoked },
        });
        return transaction.user.findUnique({ where: { id }, include: userInclude });
      });
      res.json({ item: serializeUser(user) });
    } catch (error) {
      next(error);
    }
  });

  // Ends every active session of an account (e.g. a team that closed the
  // browser without logging out and is blocked by the single-session rule).
  router.post("/users/:id/sessions/revoke", async (req, res, next) => {
    try {
      const id = parseId(req.params.id);
      const user = await prisma.$transaction(async (transaction) => {
        const current = await transaction.user.findUnique({ where: { id } });
        if (!current || !current.username) throw httpError(404, "User not found.");
        const revoked = await revokeSessions(transaction, id);
        await writeAuditLog(transaction, {
          actorUserId: BigInt(req.user.sub),
          entityType: "user",
          entityId: id.toString(),
          action: "USER_SESSIONS_REVOKED",
          afterData: { revokedSessions: revoked },
        });
        return transaction.user.findUnique({ where: { id }, include: userInclude });
      });
      res.json({ item: serializeUser(user) });
    } catch (error) {
      next(error);
    }
  });

  return router;
}

module.exports = { createAdminUsersRouter };
