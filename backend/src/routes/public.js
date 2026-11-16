const express = require("express");

const requestAttempts = new Map();
const requestLimit = 8;
const requestWindowMs = 15 * 60 * 1000;

function requestLimiter(req, res, next) {
  const now = Date.now();
  const key = req.ip || req.socket.remoteAddress || "unknown";
  let attempt = requestAttempts.get(key);
  if (!attempt || attempt.resetAt <= now) {
    attempt = { count: 0, resetAt: now + requestWindowMs };
  }
  attempt.count += 1;
  requestAttempts.set(key, attempt);

  if (requestAttempts.size > 2000) {
    for (const [address, entry] of requestAttempts) {
      if (entry.resetAt <= now) requestAttempts.delete(address);
    }
  }
  res.set("RateLimit-Limit", String(requestLimit));
  res.set("RateLimit-Remaining", String(Math.max(0, requestLimit - attempt.count)));
  res.set("RateLimit-Reset", String(Math.ceil((attempt.resetAt - now) / 1000)));
  if (attempt.count > requestLimit) {
    res.status(429).json({ error: "Too many requests. Please try again later." });
    return;
  }
  next();
}

function createPublicRouter() {
  const router = express.Router();
  router.get("/config", (req, res) => {
    res.set("Cache-Control", "no-store");
    res.json({ eventEndsAt: process.env.HACKATHON_END_AT || null });
  });
  return router;
}

module.exports = { createPublicRouter, requestLimiter };
