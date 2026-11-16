const path = require("node:path");
const multer = require("multer");

// Images are kept in memory and then handed to the storage layer
// (Supabase Storage in production, local disk in development).
// The frontend converts any picked image to WEBP before uploading, so the
// server keeps the original rule: WEBP only, validated by extension, MIME type
// and file signature. 4 MB keeps uploads under Vercel's request-body limit.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 4 * 1024 * 1024, files: 1 },
  fileFilter: (req, file, callback) => {
    const extension = path.extname(file.originalname).toLowerCase();
    if (file.mimetype !== "image/webp" || extension !== ".webp") {
      const error = new Error("Only WEBP images are allowed.");
      error.statusCode = 400;
      callback(error);
      return;
    }
    callback(null, true);
  },
});

module.exports = (req, res, next) => {
  upload.single("image")(req, res, (uploadError) => {
    if (uploadError) {
      if (uploadError.code === "LIMIT_FILE_SIZE" || uploadError.code === "LIMIT_FILE_COUNT") {
        uploadError.statusCode = 400;
      }
      next(uploadError);
      return;
    }
    if (!req.file) {
      next();
      return;
    }

    const header = req.file.buffer.subarray(0, 12);
    const isWebp =
      header.length === 12 &&
      header.toString("ascii", 0, 4) === "RIFF" &&
      header.toString("ascii", 8, 12) === "WEBP";
    if (!isWebp) {
      const error = new Error("The uploaded file is not a valid WEBP image.");
      error.statusCode = 400;
      next(error);
      return;
    }
    req.file.filename = `component-${req.params.id}-${Date.now()}-${Math.round(Math.random() * 1e9)}.webp`;
    next();
  });
};
