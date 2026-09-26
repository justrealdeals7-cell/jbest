// POST /api/admin/upload-photo — admin-only. Send the raw file as the
// request body with Content-Type set to the file's mime type, and an
// x-filename header. Returns { url } to store as the member's photo_url.
import { put } from "@vercel/blob";
import { verifyAdminToken } from "../../../lib/auth";

export const config = {
  api: {
    bodyParser: false, // we stream the raw file body straight to Blob
  },
};

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
    const blob = await put(filename, req, {
      access: "public",
      contentType,
      addRandomSuffix: true,
    });
    return res.status(200).json({ url: blob.url });
  } catch (err) {
    console.error("upload-photo error", err);
    return res.status(500).json({ error: "Upload failed" });
  }
}
