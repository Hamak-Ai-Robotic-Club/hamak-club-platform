const fs = require("node:fs");
const path = require("node:path");

// Local disk storage is only used in development. On serverless hosts (Vercel)
// the project directory is read-only, so a writable temp directory is used and
// production uploads go to Supabase Storage instead (see storage/imageStorage.js).
const componentUploadDirectory = process.env.VERCEL
  ? path.join("/tmp", "uploads", "components")
  : path.resolve(__dirname, "..", "..", "uploads", "components");

try {
  fs.mkdirSync(componentUploadDirectory, { recursive: true });
} catch (error) {
  console.warn("Component upload directory is not writable:", error.message);
}

module.exports = { componentUploadDirectory };
