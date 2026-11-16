// Vercel Serverless Function: the whole Express API is served under /api/*.
// vercel.json rewrites every /api/... request here; Express receives the
// original URL, so the same routes work locally (backend/src/server.js) and
// on Vercel.
const { createApp } = require("../backend/src/app");

module.exports = createApp();
