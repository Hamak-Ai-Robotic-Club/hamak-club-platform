const httpError = require("../utils/httpError");
const { authenticate, normalizeRole } = require("./authenticate");

function requireRoles(prisma, ...roles) {
  const authenticateRequest = authenticate(prisma);
  return [
    authenticateRequest,
    (req, res, next) => {
      if (!roles.includes(req.user.role)) {
        next(httpError(403, "You do not have permission to perform this action."));
        return;
      }
      next();
    },
  ];
}

function requireAdmin(prisma) {
  return requireRoles(prisma, "admin");
}

module.exports = requireAdmin;
module.exports.requireRoles = requireRoles;
module.exports.normalizeRole = normalizeRole;
