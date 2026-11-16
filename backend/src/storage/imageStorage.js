const fs = require("node:fs/promises");
const path = require("node:path");
const { componentUploadDirectory } = require("../config/uploadPaths");

/**
 * Component image storage.
 *
 * - Production (Vercel + Supabase): images are uploaded to a public Supabase
 *   Storage bucket and only the public URL is saved in components.image_reference.
 * - Local development: images are written to backend/uploads/components and
 *   served by Express under /uploads/components.
 *
 * The database never stores the image bytes (per the MVP specification).
 */

function supabaseConfig() {
  const url = (process.env.SUPABASE_URL || "").replace(/\/+$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  const bucket = process.env.SUPABASE_STORAGE_BUCKET || "component-images";
  if (!url || !key) return null;
  return { url, key, bucket };
}

function usesRemoteStorage() {
  return Boolean(supabaseConfig());
}

async function saveComponentImage(buffer, filename, contentType = "image/webp") {
  const remote = supabaseConfig();
  if (remote) {
    const objectPath = `components/${filename}`;
    const response = await fetch(
      `${remote.url}/storage/v1/object/${encodeURIComponent(remote.bucket)}/${objectPath}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${remote.key}`,
          apikey: remote.key,
          "Content-Type": contentType,
          "Cache-Control": "31536000",
          "x-upsert": "false",
        },
        body: buffer,
      },
    );
    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      const error = new Error("Image storage upload failed.");
      error.statusCode = 502;
      console.error("Supabase Storage upload failed:", response.status, detail.slice(0, 300));
      throw error;
    }
    return `${remote.url}/storage/v1/object/public/${encodeURIComponent(remote.bucket)}/${objectPath}`;
  }

  await fs.mkdir(componentUploadDirectory, { recursive: true });
  await fs.writeFile(path.join(componentUploadDirectory, filename), buffer);
  return `/uploads/components/${filename}`;
}

async function removeComponentImage(imageReference) {
  if (!imageReference) return;
  try {
    const remote = supabaseConfig();
    const publicPrefix = remote
      ? `${remote.url}/storage/v1/object/public/${encodeURIComponent(remote.bucket)}/`
      : null;
    if (publicPrefix && imageReference.startsWith(publicPrefix)) {
      const objectPath = imageReference.slice(publicPrefix.length);
      await fetch(`${remote.url}/storage/v1/object/${encodeURIComponent(remote.bucket)}/${objectPath}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${remote.key}`, apikey: remote.key },
      });
      return;
    }
    if (imageReference.startsWith("/uploads/components/")) {
      await fs.unlink(path.join(componentUploadDirectory, path.basename(imageReference)));
    }
    // Built-in catalogue images (/components/*.webp) are part of the frontend
    // bundle and are never deleted.
  } catch (error) {
    if (error.code !== "ENOENT") console.error("Failed to remove replaced component image:", error);
  }
}

module.exports = { saveComponentImage, removeComponentImage, usesRemoteStorage };
