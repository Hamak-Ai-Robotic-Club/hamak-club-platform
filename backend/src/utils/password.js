const { promisify } = require("node:util");
const { randomBytes, scrypt: scryptCallback, timingSafeEqual } = require("node:crypto");

const scrypt = promisify(scryptCallback);
const keyLength = 64;

async function hashPassword(password) {
  const salt = randomBytes(16);
  const derivedKey = await scrypt(password, salt, keyLength);
  return `scrypt$${salt.toString("base64url")}$${derivedKey.toString("base64url")}`;
}

async function verifyPassword(password, passwordHash) {
  if (typeof passwordHash !== "string") return false;
  const [algorithm, saltValue, keyValue, extra] = passwordHash.split("$");
  if (algorithm !== "scrypt" || !saltValue || !keyValue || extra !== undefined) {
    return false;
  }

  let salt;
  let expected;
  try {
    salt = Buffer.from(saltValue, "base64url");
    expected = Buffer.from(keyValue, "base64url");
  } catch {
    return false;
  }
  if (salt.length !== 16 || expected.length !== keyLength) return false;

  const actual = await scrypt(password, salt, keyLength);
  return timingSafeEqual(actual, expected);
}

module.exports = { hashPassword, verifyPassword };
