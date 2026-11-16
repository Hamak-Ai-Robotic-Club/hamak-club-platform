const express = require("express");
const { authenticate } = require("../middleware/authenticate");
const loginRateLimiter = require("../middleware/loginRateLimiter");
const { clearSessionCookie, serializeSessionCookie } = require("../config/session");
const httpError = require("../utils/httpError");
const authService = require("../modules/auth/auth.service");
const { hashPassword } = require("../utils/password");

// First-run bootstrap for serverless deployments (no shell on the host):
// if BOOTSTRAP_ADMIN_USERNAME / BOOTSTRAP_ADMIN_PASSWORD are set and the
// database has no admin account yet, the first login with exactly those
// credentials creates the admin. Once any admin exists this does nothing;
// remove the variables after the first login.
async function bootstrapFirstAdmin(prisma, username, password) {
  const bootstrapUser = (process.env.BOOTSTRAP_ADMIN_USERNAME || "").trim().toLowerCase();
  const bootstrapPassword = process.env.BOOTSTRAP_ADMIN_PASSWORD || "";
  if (!bootstrapUser || bootstrapPassword.length < 12) return;
  if (username !== bootstrapUser || password !== bootstrapPassword) return;
  if (!/^[a-z0-9._-]{3,64}$/.test(bootstrapUser)) return;
  const admins = await prisma.user.count({ where: { accountType: "ADMIN", username: { not: null } } });
  if (admins > 0) return;
  const passwordHash = await hashPassword(password);
  try {
    await prisma.user.create({
      data: { username: bootstrapUser, passwordHash, accountType: "ADMIN", displayName: bootstrapUser },
    });
    console.info("Bootstrap admin account created.");
  } catch (error) {
    if (error.code !== "P2002") throw error;
  }
}

function createAuthRouter(prisma) {
  const router = express.Router();
  const requireSession = authenticate(prisma);

  router.post("/login", loginRateLimiter, async (req, res, next) => {
    try {
      const { username, password } = req.body || {};
      if (
        typeof username !== "string" ||
        username.trim().length < 3 ||
        username.trim().length > 64 ||
        typeof password !== "string" ||
        password.length < 1 ||
        password.length > 1024
      ) {
        throw httpError(422, "A valid username and password are required.");
      }

      try {
        await bootstrapFirstAdmin(prisma, username.trim().toLowerCase(), password);
        const result = await authService.login(prisma, username.trim().toLowerCase(), password);
        res.set("Set-Cookie", serializeSessionCookie(result.token, result.expiresAt));
        res.status(200).json({ user: result.user });
      } catch (error) {
        if (error.statusCode === 401) req.recordFailedLogin?.();
        throw error;
      }
    } catch (error) {
      next(error);
    }
  });

  router.post("/logout", requireSession, async (req, res, next) => {
    try {
      await authService.logout(prisma, req.session.id);
      res.set("Set-Cookie", clearSessionCookie());
      res.json({ message: "Logged out" });
    } catch (error) {
      next(error);
    }
  });

  router.get("/me", requireSession, (req, res) => {
    const { id, username, role, teamId, teamName } = req.user;
    res.json({ user: { id, username, role, teamId, teamName } });
  });

  return router;
}

module.exports = { createAuthRouter };
