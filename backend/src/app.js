const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const cookieParser = require("cookie-parser");

const env = require("./config/env");

const requestLogger = require("./middleware/requestLogger");
const errorHandler = require("./middleware/errorHandler");
const createOriginGuard = require("./middleware/originGuard");

const authRoutes = require("./routes/authRoutes");
const activityRoutes = require("./routes/activityRoutes");
const evidenceRoutes = require("./routes/evidenceRoutes");
const routeProofRoutes = require("./routes/routeProofRoutes");
const organizationRoutes = require("./routes/organizationRoutes");
const dashboardRoutes = require("./routes/dashboardRoutes");
const reportsRoutes = require("./routes/reportsRoutes");
const userManagementRoutes = require("./routes/userManagementRoutes");
const fieldLedgerRoutes = require("./routes/fieldLedgerRoutes");
const invoiceRoutes = require("./routes/invoiceRoutes");
const auditRoutes = require("./routes/auditRoutes");
const trustRoutes = require("./routes/trustRoutes");
const reviewRoutes = require("./routes/reviewRoutes");
const notificationRoutes = require("./routes/notificationRoutes");
const searchRoutes = require("./routes/searchRoutes");
const complianceRoutes = require("./routes/complianceRoutes");
const app = express();

app.set("trust proxy", 1);

app.use(
  cors({
    origin: env.frontendUrl,
    credentials: true,
  })
);

// Check browser origins on state-changing requests to mitigate CSRF.
app.use(createOriginGuard(env.frontendUrl));

app.use(helmet());

app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "100kb" }));

// IMPORTANT: cookieParser must run before authenticated routes.
app.use(cookieParser());

app.use(requestLogger);

app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    message: "SafeLayer API is healthy",
  });
});

app.use("/api/auth", authRoutes);
app.use("/api/activities", activityRoutes);
app.use("/api/evidence", evidenceRoutes);
app.use("/api/route-proof", routeProofRoutes);
app.use("/api/organization", organizationRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/reports", reportsRoutes);
app.use("/api/users", userManagementRoutes);
app.use("/api/field-ledger", fieldLedgerRoutes);
app.use("/api/invoices", invoiceRoutes);
app.use("/api/audit-events", auditRoutes);
app.use("/api/trust", trustRoutes);
app.use("/api/reviews", reviewRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/search", searchRoutes);
app.use("/api/compliance", complianceRoutes);
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found",
  });
});

app.use(errorHandler);

module.exports = app;
