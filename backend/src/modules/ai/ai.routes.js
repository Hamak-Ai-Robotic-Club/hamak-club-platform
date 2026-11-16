const express = require("express");
const { requireRoles } = require("../../middleware/requireAdmin");
const httpError = require("../../utils/httpError");
const { answer, providerConfig } = require("./ai.service");
const { searchAvailableComponents } = require("./ai.tools");

const usageByUser = new Map();
const maxMessagesPerWindow = 20;
const windowMs = 10 * 60 * 1000;

function chatLimiter(req, res, next) {
  const now = Date.now();
  const key = req.user.id;
  let usage = usageByUser.get(key);
  if (!usage || usage.resetAt <= now) usage = { count: 0, resetAt: now + windowMs };
  usage.count += 1;
  usageByUser.set(key, usage);
  if (usage.count > maxMessagesPerWindow) {
    res.status(429).json({ error: "تم تجاوز حد الرسائل مؤقتاً، حاول بعد دقائق." });
    return;
  }
  next();
}

function parseHistory(body) {
  const messages = body?.messages;
  if (!Array.isArray(messages) || messages.length < 1 || messages.length > 20) {
    throw httpError(422, "messages must contain 1-20 entries.");
  }
  const history = messages.map((message) => {
    if (!message || !["user", "assistant"].includes(message.role) || typeof message.content !== "string") {
      throw httpError(422, "Each message needs a role (user/assistant) and text content.");
    }
    const content = message.content.trim();
    if (!content || content.length > 2000) throw httpError(422, "Message length must be 1-2000 characters.");
    return { role: message.role, content };
  });
  if (history[history.length - 1].role !== "user") {
    throw httpError(422, "The last message must come from the user.");
  }
  return history;
}

// Hackathon assistant (team accounts only). Read-only: it can search the
// inventory but cannot create requests, reserve items, or change stock.
function createChatRouter(prisma) {
  const router = express.Router();
  router.use(...requireRoles(prisma, "user"));

  router.get("/status", (req, res) => {
    res.json({ aiEnabled: Boolean(providerConfig()) });
  });

  router.get("/inventory-search", async (req, res, next) => {
    try {
      const query = String(req.query.q || "").slice(0, 200);
      const items = await searchAvailableComponents(prisma, { keywords: [query], limit: 12 });
      res.json({ items });
    } catch (error) {
      next(error);
    }
  });

  router.post("/messages", chatLimiter, async (req, res, next) => {
    try {
      const history = parseHistory(req.body);
      const result = await answer(prisma, history);
      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  return router;
}

module.exports = { createChatRouter };
