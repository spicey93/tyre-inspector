// app.js
import express from "express";
import helmet from "helmet";
import vrmRoutes from "./routes/vrm.routes.js";
import inspectionRoutes from "./routes/inspection.routes.js";
import session from "express-session";
import MongoStore from "connect-mongo";
import User from "./models/user.model.js";

const app = express();

// Security headers
app.use(
  helmet({
    crossOriginEmbedderPolicy: false, // disable this for CDN compatibility
  })
);

// Custom CSP to allow Tailwind + HTMX CDNs
app.use(
  helmet.contentSecurityPolicy({
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: [
        "'self'",
        "https://cdn.tailwindcss.com",
        "https://cdn.jsdelivr.net", // for HTMX
        "'unsafe-inline'", // needed for inline scripts in EJS templates
      ],
      styleSrc: ["'self'", "https://cdn.tailwindcss.com", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:"],
      connectSrc: ["'self'"], // restrict XHR/HTMX requests to your own server
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
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 1000 * 60 * 60 * 24 * 14, // 14 days
    },
    store: MongoStore.create({ mongoUrl: process.env.DB_URL }),
  })
);

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
  res.locals.user = req.user || null; // available in EJS
  next();
});

app.use(express.static("public"));
app.set("view engine", "ejs");
app.use(express.urlencoded({ extended: true }));

// routes
import * as auth from "./controllers/auth.controller.js";
import requireAuth from "./middleware/requireAuth.js";
import { dashboard } from "./controllers/dashboard.controller.js";

app.get("/login", auth.getLogin);
app.post("/login", auth.postLogin);
app.get("/register", auth.getRegister);
app.post("/register", auth.postRegister);
app.get("/logout", auth.postLogout);

app.get("/dashboard", requireAuth, dashboard);

app.get("/", (req, res) => {
  res.render("index", { title: "Tyre Inspector — Find report" });
});

app.use("/vrm", vrmRoutes);
app.use("/inspections", inspectionRoutes); // mount point

export default app;
