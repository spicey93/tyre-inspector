// middleware/requireAdmin.js
export default function requireAdmin(req, res, next) {
  if (!req.user) return res.redirect("/login");
  if (req.user.role !== "admin") return res.status(403).send("Admins only");
  next();
}
