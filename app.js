import express from "express";
import inspectionRouter from "./routes/inspection.routes.js";

const app = express();

app.use(express.static("public"));
app.set("view engine", "ejs");

app.use(express.urlencoded({ extended: true }));

app.get("/", (req, res) => {
  res.render("index");
});

app.use("/inspections", inspectionRouter);

export default app;
