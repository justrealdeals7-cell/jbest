// POST /api/public/upload-photo — used by the public self-registration form.
// No admin auth (this is meant to be called by anyone registering), but
// still validated: image types only, 5MB cap. If this gets abused in
// practice, add rate limiting (e.g. Vercel's built-in or a simple IP-based
// counter in Neon) before anything else.
import { put } from "@vercel/blob";

export const config = {
  api: {
    bodyParser: false,
  },
};

const MAX_BYTES = 5 * 1024 * 1024; // 5MB

function readRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > MAX_BYTES) {
        reject(new Error("File too large (max 5MB)"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).end();
  }

  const filename = req.headers["x-filename"] || `photo-${Date.now()}.jpg`;
  const contentType = req.headers["content-type"] || "application/octet-stream";

  if (!contentType.startsWith("image/")) {
    return res.status(400).json({ error: "Only image uploads are allowed" });
  }

  try {
    const buffer = await readRawBody(req);
    if (!buffer.length) {
      return res.status(400).json({ error: "Empty upload" });
    }

    const blob = await put(`self-reg/${filename}`, buffer, {
      access: "public",
      contentType,
      addRandomSuffix: true,
    });

    return res.status(200).json({ url: blob.url });
  } catch (err) {
    console.error("public upload-photo error", err);
    const status = err.message?.includes("too large") ? 413 : 500;
    return res.status(status).json({ error: err.message || "Upload failed" });
  }
}
