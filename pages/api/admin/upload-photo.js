// POST /api/admin/upload-photo — admin-only. Send the raw file as the
// request body with Content-Type set to the file's mime type, and an
// x-filename header. Returns { url } to store as the member's photo_url.
import { put } from "@vercel/blob";
import { verifyAdminToken } from "../../../lib/auth";

export const config = {
  api: {
    bodyParser: false, // we read the raw file body ourselves, below
  },
};

function readRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

export default async function handler(req, res) {
  const payload = verifyAdminToken(req.cookies?.admin_token);
  if (!payload) return res.status(401).json({ error: "Unauthorized" });

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
    // @vercel/blob's put() wants a Buffer/Blob/Web-stream — the raw Node
    // request stream isn't one of those, so we buffer it first. This was
    // the bug: passing `req` straight to put() silently failed.
    const buffer = await readRawBody(req);

    if (!buffer.length) {
      return res.status(400).json({ error: "Empty upload" });
    }

    const blob = await put(filename, buffer, {
      access: "public",
      contentType,
      addRandomSuffix: true,
    });

    return res.status(200).json({ url: blob.url });
  } catch (err) {
    console.error("upload-photo error", err);
    return res.status(500).json({
      error: "Upload failed",
      // Remove this in a later cleanup pass — useful while wiring Blob up,
      // but no need to expose internals once it's stable.
      detail: err.message,
    });
  }
}
