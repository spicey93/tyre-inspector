// controllers/auth.controller.js
import User from "../models/user.model.js";
import bcrypt from "bcrypt";

export const getLogin = (req, res) => {
  res.render("auth/login", { next: req.query.next || "/dashboard" });
};

export const postLogin = async (req, res) => {
  const { email, password } = req.body;
  const nextUrl = req.body.next || req.query.next || "/dashboard";

  const user = await User.findOne({ email }).select("+passwordHash");
  if (!user) return res.status(401).render("auth/login", { error: "Incorrect credentials", next: nextUrl });

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return res.status(401).render("auth/login", { error: "Incorrect credentials", next: nextUrl });

  req.session.regenerate((err) => {
    if (err) return res.status(500).render("auth/login", { error: "Session error", next: nextUrl });
    req.session.userId = user._id;
    req.session.save((err2) => {
      if (err2) return res.status(500).render("auth/login", { error: "Session error", next: nextUrl });
      res.redirect(nextUrl);
    });
  });
};

export const getRegister = (req, res) => {
  res.render("auth/register");
};

export const postRegister = async (req, res) => {
  try {
    const { name, email, password } = req.body;
    // dailyLimit fixed to 5
    const dailyLimit = 5;

    // hash password however you do it
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    const user = await User.create({
      name,
      email,
      passwordHash,
      dailyLimit,
      role: "admin",
      accountStatus: "free",
    });

    req.session.regenerate((err) => {
      if (err) return res.status(500).render("auth/register", { error: "Session error" });
      req.session.userId = user._id;
      req.session.save(() => res.redirect("/dashboard"));
    });
  } catch (e) {
    res.status(400).render("auth/register", { error: "Registration failed" });
  }
};

export const postLogout = (req, res) => {
  req.session.destroy(() => res.redirect("/login"));
};
