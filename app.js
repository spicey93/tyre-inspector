// app.js
import express from "express";
import helmet from "helmet";
import authRoutes from "./routes/auth.routes.js";
import vrmRoutes from "./routes/vrm.routes.js";
import inspectionRoutes from "./routes/inspection.routes.js";
import technicianRoutes from "./routes/technician.routes.js";
import session from "express-session";
import MongoStore from "connect-mongo";
import User from "./models/user.model.js";
import { dashboard } from "./controllers/dashboard.controller.js";
import requireAuth from "./middleware/requireAuth.js";
import requireAdmin from "./middleware/requireAdmin.js";

const app = express();
const isProd = process.env.NODE_ENV === "production";

// trust proxy for secure cookies behind Nginx/Heroku/etc.
app.set("trust proxy", 1);

// Security headers
app.use(
  helmet({
    crossOriginEmbedderPolicy: false,
  })
);
app.use(
  helmet.contentSecurityPolicy({
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: [
        "'self'",
        "https://cdn.tailwindcss.com",
        "https://cdn.jsdelivr.net",
        "'unsafe-inline'",
      ],
      styleSrc: ["'self'", "https://cdn.tailwindcss.com", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:"],
      connectSrc: ["'self'"],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: [],
    },
  })
);

app.use(
  session({
    name: "ti.sid",
    secret: process.env.SESSION_SECRET || "changeme",
    resave: false,
    saveUninitialized: false,
    proxy: true,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: isProd,
      maxAge: 1000 * 60 * 60 * 24 * 14,
    },
    store: MongoStore.create({ mongoUrl: process.env.DB_URL }),
  })
);

// attach user from session
app.use(async (req, _res, next) => {
  if (req.session.userId) {
    try {
      req.user = await User.findById(req.session.userId).lean();
    } catch {
      req.user = null;
    }
  }
  next();
});
app.use((req, res, next) => {
  res.locals.user = req.user || null;
  next();
});

app.use(express.static("public"));
app.set("view engine", "ejs");
app.use(express.urlencoded({ extended: true }));

// routes
app.get("/", (req, res) => {
  if (req.user) return res.redirect("/dashboard");
  res.render("index", { title: "Tyre Inspector — Find report" });
});

app.use("/", authRoutes);
app.get("/dashboard", requireAuth, dashboard);
app.use("/vrm", vrmRoutes);
app.use("/inspections", inspectionRoutes);
app.use("/technicians", requireAuth, requireAdmin, technicianRoutes);

export default app;
