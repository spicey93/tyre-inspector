import express from "express";
import vrmRoutes from "./routes/vrm.routes.js";
import inspectionRoutes from "./routes/inspection.routes.js";

const app = express();

app.use(express.static("public"));
app.set("view engine", "ejs");
app.use(express.urlencoded({ extended: true }));

app.get("/", (req, res) => res.render("index"));

app.use("/vrm", vrmRoutes);
app.use("/inspections", inspectionRoutes); // mount point

export default app;
