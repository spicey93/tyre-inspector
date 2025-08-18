// app.js
import express from "express";
import helmet from "helmet";
import vrmRoutes from "./routes/vrm.routes.js";
import inspectionRoutes from "./routes/inspection.routes.js";

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

app.use(express.static("public"));
app.set("view engine", "ejs");
app.use(express.urlencoded({ extended: true }));

app.get("/", (req, res) => res.render("index"));

app.use("/vrm", vrmRoutes);
app.use("/inspections", inspectionRoutes); // mount point

export default app;
