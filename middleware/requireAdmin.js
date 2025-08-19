// middleware/requireAdmin.js
export default function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== "admin") {
    return res.status(403).send("Forbidden");
  }
  next();
}
