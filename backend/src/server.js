const app = require("./app");
const env = require("./config/env");
const pool = require("./config/database");

async function startServer() {
  try {
    const connection = await pool.getConnection();

    console.log("Database connection successful.");

    connection.release();

    app.listen(env.port, () => {
      console.log(
        `SafeLayer API running on http://localhost:${env.port}`
      );
    });
  } catch (error) {
    console.error("Failed to connect to database:");
    console.error(error.message);

    process.exit(1);
  }
}

startServer();