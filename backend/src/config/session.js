const cookieName = "sid";
const ttlHours = Number(process.env.SESSION_TTL_HOURS || 8);
const sameSite = (process.env.SESSION_COOKIE_SAME_SITE || "lax").toLowerCase();

if (!Number.isInteger(ttlHours) || ttlHours < 1 || ttlHours > 720) {
  throw new Error("SESSION_TTL_HOURS must be an integer between 1 and 720.");
}
if (!["lax", "strict", "none"].includes(sameSite)) {
  throw new Error("SESSION_COOKIE_SAME_SITE must be lax, strict, or none.");
}
if (sameSite === "none" && process.env.NODE_ENV !== "production") {
  throw new Error("SESSION_COOKIE_SAME_SITE=none requires NODE_ENV=production.");
}

const sessionTtlMs = ttlHours * 60 * 60 * 1000;

function serializeSessionCookie(token, expiresAt) {
  const maxAge = Math.max(0, Math.floor((expiresAt.getTime() - Date.now()) / 1000));
  const attributes = [
    `${cookieName}=${token}`,
    "Path=/",
    "HttpOnly",
    `SameSite=${sameSite[0].toUpperCase()}${sameSite.slice(1)}`,
    `Max-Age=${maxAge}`,
    `Expires=${expiresAt.toUTCString()}`,
  ];
  if (process.env.NODE_ENV === "production") attributes.push("Secure");
  return attributes.join("; ");
}

function clearSessionCookie() {
  const attributes = [
    `${cookieName}=`,
    "Path=/",
    "HttpOnly",
    `SameSite=${sameSite[0].toUpperCase()}${sameSite.slice(1)}`,
    "Max-Age=0",
    "Expires=Thu, 01 Jan 1970 00:00:00 GMT",
  ];
  if (process.env.NODE_ENV === "production") attributes.push("Secure");
  return attributes.join("; ");
}

module.exports = {
  cookieName,
  sessionTtlMs,
  serializeSessionCookie,
  clearSessionCookie,
};
