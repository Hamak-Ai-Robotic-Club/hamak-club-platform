const { createApp } = require("./app");
const prisma = require("./config/prisma");

const port = Number(process.env.PORT || 3000);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error("PORT must be an integer between 1 and 65535.");
}

const server = createApp().listen(port, () => {
  console.info(`Hamak API listening on port ${port}.`);
});

async function shutdown(signal) {
  console.info(`${signal} received; shutting down the API.`);
  server.close(async (error) => {
    if (error) {
      console.error("Failed to close the API server:", error);
      process.exitCode = 1;
    }
    await prisma.$disconnect();
  });
}

process.once("SIGINT", () => shutdown("SIGINT"));
process.once("SIGTERM", () => shutdown("SIGTERM"));
