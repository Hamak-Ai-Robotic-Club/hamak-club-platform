const attemptsByAddress = new Map();
const maxAttempts = 10;
const windowMs = 15 * 60 * 1000;

function loginRateLimiter(req, res, next) {
  const now = Date.now();
  const address = req.ip || req.socket.remoteAddress || "unknown";
  let attempts = attemptsByAddress.get(address);
  if (!attempts || attempts.resetAt <= now) {
    attempts = { count: 0, resetAt: now + windowMs };
  }

  if (attempts.count >= maxAttempts) {
    res.set("RateLimit-Limit", String(maxAttempts));
    res.set("RateLimit-Remaining", "0");
    res.set("RateLimit-Reset", String(Math.ceil((attempts.resetAt - now) / 1000)));
    res.status(429).json({ error: "Too many login attempts, please try again later." });
    return;
  }

  req.recordFailedLogin = () => {
    attempts.count += 1;
    attemptsByAddress.set(address, attempts);
    if (attemptsByAddress.size > 2000) {
      for (const [key, entry] of attemptsByAddress) {
        if (entry.resetAt <= now) attemptsByAddress.delete(key);
      }
    }
  };
  res.set("RateLimit-Limit", String(maxAttempts));
  res.set("RateLimit-Remaining", String(Math.max(0, maxAttempts - attempts.count)));
  next();
}

module.exports = loginRateLimiter;
