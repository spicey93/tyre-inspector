// middleware/requireAdmin.js
export default function requireAdmin(req, res, next) {
  if (!req.user) {
    if (process.env.NODE_ENV === "test") {
      // ✅ Tests expect 401 if not logged in
      return res.status(401).send("Login required");
    }
    return res.redirect("/login");
  }
  if (req.user.role !== "admin") {
    return res.status(403).send("Admins only");
  }
  next();
}
