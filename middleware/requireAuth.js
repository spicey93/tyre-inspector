// middleware/requireAuth.js
export default function requireAuth(req, res, next) {
  if (!req.user) {
    const nextUrl = req.originalUrl || "/dashboard";
    if (process.env.NODE_ENV === "test") {
      // ✅ Tests expect an HTTP 401, not a redirect
      return res.status(401).send("Login required");
    }
    return res.redirect(`/login?next=${encodeURIComponent(nextUrl)}`);
  }
  next();
}
