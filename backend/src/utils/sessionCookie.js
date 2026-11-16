const { cookieName } = require("../config/session");

function readSessionCookie(header) {
  if (typeof header !== "string") return null;
  for (const part of header.split(";")) {
    const separator = part.indexOf("=");
    if (separator < 0 || part.slice(0, separator).trim() !== cookieName) continue;
    const value = part.slice(separator + 1).trim();
    return /^[a-f0-9]{64}$/i.test(value) ? value : null;
  }
  return null;
}

function getSessionCredential(req) {
  const authorization = req.get("authorization") || "";
  const match = /^Bearer ([^\s]+)$/i.exec(authorization);
  if (match) return { token: match[1], source: "bearer" };
  const cookieToken = readSessionCookie(req.headers.cookie);
  return cookieToken ? { token: cookieToken, source: "cookie" } : null;
}

module.exports = { getSessionCredential };
