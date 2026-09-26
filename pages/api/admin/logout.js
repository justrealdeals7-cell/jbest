import { serialize } from "cookie";

export default function handler(req, res) {
  res.setHeader(
    "Set-Cookie",
    serialize("admin_token", "", { httpOnly: true, path: "/", maxAge: 0 })
  );
  return res.status(200).json({ ok: true });
}
