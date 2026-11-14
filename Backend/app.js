const express = require("express");
const prisma = require("./config/prisma");
const { componentUploadDirectory } = require("./config/uploadPaths");
const { createComponentsRouter } = require("./routes/components");
const { createInventoryOperationsRouter } = require("./routes/inventoryOperations");
const { createPublicRouter } = require("./routes/public");
const httpError = require("./utils/httpError");

function getFrontendOrigin() {
  const configuredUrl = process.env.FRONTEND_URL;
  if (!configuredUrl) return null;

  const url = new URL(configuredUrl);
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash
  ) {
    throw new Error("FRONTEND_URL must be an HTTP(S) origin without a path.");
  }
  return url.origin;
}

function createApp(database = prisma) {
  const app = express();
  const frontendOrigin = getFrontendOrigin();
  app.disable("x-powered-by");
  app.use((req, res, next) => {
    res.set({
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY",
      "Referrer-Policy": "strict-origin-when-cross-origin",
      "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
    });
    next();
  });
  app.use((req, res, next) => {
    if (!frontendOrigin || req.get("origin") !== frontendOrigin) {
      next();
      return;
    }

    res.set("Access-Control-Allow-Origin", frontendOrigin);
    res.vary("Origin");
    if (req.method === "OPTIONS") {
      res.set("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS");
      res.set("Access-Control-Allow-Headers", "Authorization, Content-Type");
      res.status(204).end();
      return;
    }
    next();
  });
  app.use(express.json({ limit: "1mb" }));
  app.use("/uploads/components", express.static(componentUploadDirectory, { fallthrough: false }));
  app.use("/api", createPublicRouter(database));
  app.get("/api/health", async (req, res, next) => {
    try {
      await database.$queryRaw`SELECT 1`;
      res.json({ status: "ok" });
    } catch (error) {
      next(error);
    }
  });
  app.use("/api", createComponentsRouter(database));
  app.use("/api", createInventoryOperationsRouter(database));
  app.use((req, res, next) => next(httpError(404, "Route not found.")));
  app.use((error, req, res, next) => {
    if (res.headersSent) {
      next(error);
      return;
    }

    const databaseConstraint =
      ["P2002", "P2003", "P2004"].includes(error.code) ||
      ["23503", "23505", "23514"].includes(error.code);
    const statusCode =
      databaseConstraint
        ? 409
        : error.code === "P2025"
          ? 404
          : error.statusCode || error.status || 500;
    if (statusCode >= 500) console.error("API request failed:", error);
    res.status(statusCode).json({
      error: statusCode >= 500 ? "Internal server error." : error.message,
    });
  });

  return app;
}

module.exports = { createApp };
