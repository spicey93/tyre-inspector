// controllers/auth.controller.js
import User from "../models/user.model.js";

export const getLogin = (_req, res) => res.render("auth/login");
export const getRegister = (_req, res) => res.render("auth/register");

export const postRegister = async (req, res) => {
  try {
    const { name, email, password, dailyLimit } = req.body;
    const exists = await User.findOne({ email: email.toLowerCase().trim() }).lean();
    if (exists) return res.status(400).render("auth/register", { error: "Email already in use." });

    const u = new User({ name, email, dailyLimit: dailyLimit ? Number(dailyLimit) : undefined });
    await u.setPassword(password);
    await u.save();
    req.session.userId = u._id;
    res.redirect("/dashboard");
  } catch (e) {
    console.error(e);
    res.status(500).render("auth/register", { error: "Registration failed." });
  }
};

export const postLogin = async (req, res) => {
  try {
    const { email, password } = req.body;
    const u = await User.findOne({ email: email.toLowerCase().trim() });
    if (!u || !(await u.verifyPassword(password))) {
      return res.status(400).render("auth/login", { error: "Invalid credentials." });
    }
    req.session.userId = u._id;
    const nextUrl = req.query.next && /^\/[A-Za-z0-9/_-]*$/.test(req.query.next) ? req.query.next : "/dashboard";
    res.redirect(nextUrl);
  } catch (e) {
    console.error(e);
    res.status(500).render("auth/login", { error: "Login failed." });
  }
};

export const postLogout = (req, res) => {
  req.session.destroy(() => res.redirect("/"));
};
