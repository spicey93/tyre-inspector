// server.js
import app from "./src/app.js";
import { connectDB } from "./src/config/db.config.js";

const PORT = process.env.PORT || 8000;

app.listen(PORT, () => {
  connectDB();
  console.log(`Server up and running on port:${PORT}`);
});
