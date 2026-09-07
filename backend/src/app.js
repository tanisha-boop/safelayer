const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const cookieParser = require("cookie-parser");
const requestLogger = require("./middleware/requestLogger");
const env = require("./config/env");
const authRoutes = require("./routes/authRoutes");
const errorHandler = require("./middleware/errorHandler");

const app = express();

app.set("trust proxy", 1);

app.use(
  cors({
    origin: env.frontendUrl,
    credentials: true,
  })
);

app.use(helmet());

app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(requestLogger);

app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    message: "SafeLayer API is healthy",
  });
});

app.use("/api/auth", authRoutes);

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found",
  });
});

app.use(errorHandler);

module.exports = app;