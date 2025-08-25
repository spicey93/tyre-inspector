// middleware/redirectIfAuthenticated.js
export default function redirectIfAuthenticated(req, res, next) {
  if (req.user) {
    return res.redirect("/dashboard");
  }
  next();
}
