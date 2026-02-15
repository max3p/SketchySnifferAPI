require("dotenv").config();

// Validate required environment variables before loading the app.
const REQUIRED_ENV = ["OPENAI_API_KEY"];

const missing = REQUIRED_ENV.filter((key) => !process.env[key]);
if (missing.length > 0) {
  console.error(`Missing required environment variable(s): ${missing.join(", ")}`);
  process.exit(1);
}

const app = require("./app");

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`SketchySniffer API running on http://localhost:${PORT}`);
});
