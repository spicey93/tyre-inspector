// server.js
import app from "./app.js";
const PORT = process.env.PORT || 8000;
import { connectDB } from "./config/db.config.js";

app.listen(PORT, () => {
  connectDB();
  console.log(`Server up and running on port:${PORT}`);
});
