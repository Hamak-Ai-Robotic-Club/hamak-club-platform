const { createHash } = require("node:crypto");
const httpError = require("../utils/httpError");
const { getSessionCredential } = require("../utils/sessionCookie");

function requestHostOrigins(req) {
  // Same-origin deployments (frontend and API on one Vercel domain) are always
  // allowed: the browser Origin must match the host that served the request.
  const hosts = [req.get("x-forwarded-host"), req.get("host")]
    .filter(Boolean)
    .map((value) => value.split(",")[0].trim());
  const protocol = (req.get("x-forwarded-proto") || req.protocol || "https").split(",")[0].trim();
  return hosts.map((host) => `${protocol}://${host}`);
}

function assertCookieMutationOrigin(req) {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return;
  const configuredOrigin = process.env.FRONTEND_URL;
  const requestOrigin = req.get("origin");
  if (!requestOrigin) {
    throw httpError(403, "A valid frontend origin is required for this request.");
  }
  if (requestHostOrigins(req).includes(requestOrigin)) return;
  if (!configuredOrigin) {
    throw httpError(403, "A valid frontend origin is required for this request.");
  }
  let allowedOrigin;
  try {
    allowedOrigin = new URL(configuredOrigin).origin;
  } catch {
    throw httpError(500, "FRONTEND_URL is invalid.");
  }
  if (requestOrigin !== allowedOrigin) {
    throw httpError(403, "Request origin is not allowed.");
  }
}

function normalizeRole(accountType) {
  const normalized = (accountType || "").toUpperCase();
  if (normalized === "ADMIN") return "admin";
  if (["TEAM", "LEADER", "USER"].includes(normalized)) return "user";
  return null;
}

function authenticate(prisma) {
  return async (req, res, next) => {
    try {
      const credential = getSessionCredential(req);
      if (!credential) throw httpError(401, "A valid session is required.");
      if (credential.source === "cookie") assertCookieMutationOrigin(req);

      const tokenHash = createHash("sha256").update(credential.token).digest("hex");
      const session = await prisma.session.findUnique({
        where: { tokenHash },
        include: { user: { include: { team: true } } },
      });

      if (
        !session ||
        session.revokedAt ||
        session.expiresAt <= new Date() ||
        !session.user.isActive
      ) {
        throw httpError(401, "The session is invalid or expired.");
      }

      const role = normalizeRole(session.user.accountType);
      if (!role) throw httpError(403, "This account cannot access the API.");
      if (role === "user" && (!session.user.teamId || !session.user.team?.isActive)) {
        throw httpError(403, "This account is not assigned to an active team.");
      }

      req.session = session;
      req.user = {
        id: session.user.id.toString(),
        sub: session.user.id.toString(),
        username: session.user.username,
        role,
        accountType: session.user.accountType,
        teamId: session.user.teamId?.toString() || null,
        teamName: session.user.team?.name || null,
      };
      next();
    } catch (error) {
      next(error);
    }
  };
}

module.exports = { authenticate, normalizeRole };
