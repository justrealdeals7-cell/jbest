import { verifyAdminToken } from "../../../lib/auth";

export default function handler(req, res) {
  const payload = verifyAdminToken(req.cookies?.admin_token);
  if (!payload) return res.status(401).json({ error: "Unauthorized" });
  return res.status(200).json({ admin: payload });
}
