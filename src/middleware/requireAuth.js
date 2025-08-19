// middleware/requireAuth.js
export default function requireAuth(req, res, next) {
  if (!req.user) {
    const nextUrl = req.originalUrl || "/dashboard";
    return res.redirect(`/login?next=${encodeURIComponent(nextUrl)}`);
  }
  next();
}
