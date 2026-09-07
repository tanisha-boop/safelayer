require("dotenv").config();

const app = require("./app");
const pool = require("./config/database");

const PORT = process.env.PORT || 5000;

async function startServer() {
  try {
    const connection = await pool.getConnection();

    console.log("Database connection successful.");

    connection.release();

    app.listen(PORT, () => {
      console.log(`SafeLayer API running on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error("Failed to start SafeLayer:", error);
    process.exit(1);
  }
}

startServer();