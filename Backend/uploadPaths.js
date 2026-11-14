const fs = require("node:fs");
const path = require("node:path");

const componentUploadDirectory = path.resolve(__dirname, "..", "..", "uploads", "components");
fs.mkdirSync(componentUploadDirectory, { recursive: true });

module.exports = { componentUploadDirectory };
