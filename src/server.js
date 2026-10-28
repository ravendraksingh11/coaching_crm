require("dotenv").config();

const express = require("express");
const cors = require("cors");
const rateLimit = require("./middleware/rateLimit");

const app = express();

// Set TRUST_PROXY to the number of trusted reverse-proxy hops in production.
// Do not enable trust proxy for an internet-facing server without a trusted proxy.
if (process.env.TRUST_PROXY && /^\d+$/.test(process.env.TRUST_PROXY)) {
  app.set("trust proxy", Number(process.env.TRUST_PROXY));
}

app.disable("x-powered-by");
// app.use(
//   cors({
//     // origin: "https://shikvanta.ravendraksingh11.workers.dev"
//     origin: process.env.FRONTEND_URL ||
//       "http://localhost:5173",
//   })
// );

app.use(cors({
  origin: [
    "http://institexa.in/",
    "https://institexa.in/",
    "https://www.institexa.in",
  ],
  credentials: true,
}));

app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  if (req.secure) res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  next();
});

// Production routes are mounted at the root (for example, /auth/login and
// /institute/dashboard), so apply the broad API limit without an /api prefix.
// Keep health checks available; sensitive endpoints add a stricter limit below.
const apiRateLimit = rateLimit({ windowMs: 15 * 60 * 1000, max: 300 });
app.use((req, res, next) => {
  if (req.path === "/" || req.path === "/health") return next();
  return apiRateLimit(req, res, next);
});

app.use(express.json({ limit: "2mb" }));


// ==========================================
// HEALTH
// ==========================================

// A simple root response is useful when opening the API URL directly and for
// AWS load balancer checks configured to use `/`.
app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "Shikvanta API is running",
    health: "/health",
  });
});

app.get("/health", (req, res) => {
  res.json({
    success: true,
    message: "Shikvanta API is running",
  });
});


// ==========================================
// ROUTES
// ==========================================

const authRoutes =
  require("./routes/auth.routes");
const enquiriesRoutes = require("./routes/enquiries.routes");

const instituteRoutes =
  require("./routes/institute.routes");

const batchRoutes =
  require("./routes/batch.routes");

const studentRoutes =
  require("./routes/student.routes");

const subscriptionPlanRoutes =
  require("./routes/subscriptionPlan.routes");

const subscriptionRoutes =
  require("./routes/subscription.routes");

const superAdminRoutes =
  require("./routes/superAdmin.routes");

const instituteDashboardRoutes =
  require("./routes/instituteDashboard.routes");

const instituteSettingsRoutes =
  require("./routes/instituteSettings.routes");

const instituteStudentRoutes =
  require("./routes/instituteStudent.routes");


const teacherRoutes =
  require("./routes/teacher.routes");

const courseRoutes =
  require("./routes/course.routes");

const subscriptionsRoutes =
  require("./routes/subscriptions.routes");

const plansRoutes = require("./routes/plans.routes");
const testRoutes = require("./routes/test.routes");
const parentRoutes = require("./routes/parent.routes");
const attendanceRoutes = require("./routes/attendance.routes");
const feesRoutes = require("./routes/fees.routes");
const { generateDueMonthlyFeesForAll } = require("./services/fees.service");

app.use("/plans", plansRoutes);
app.use("/tests", testRoutes);
app.use("/parent", parentRoutes);
app.use("/attendance", attendanceRoutes);
app.use("/fees", feesRoutes);
app.use(
  "/subscriptions",
  subscriptionsRoutes
);

app.use(
  "/institute/courses",
  courseRoutes
);

app.use(
  "/institute/students",
  instituteStudentRoutes
);

app.use(
  "/super-admin",
  superAdminRoutes
);

app.use(
  "/super-admin/institutes",
  instituteRoutes
);

app.use(
  "/institute/batches",
  batchRoutes
);

app.use(
  "/institute/students",
  studentRoutes
);

app.use(
  "/subscription-plans",
  subscriptionPlanRoutes
);

app.use(
  "/subscriptions",
  subscriptionRoutes
);

app.use("/auth", authRoutes);

app.use("/enquiries", enquiriesRoutes);

app.use(
  "/institute/dashboard",
  instituteDashboardRoutes
);

app.use(
  "/institute/settings",
  instituteSettingsRoutes
);

app.use(
  "/institute/teachers",
  teacherRoutes
);

// ==========================================
// SERVER
// ==========================================

const PORT = process.env.PORT || 5010;

app.listen(PORT, () => {
  console.log(
    `Shikvanta API running on http://localhost:${PORT}`
  );
  const runFeeBilling = () => generateDueMonthlyFeesForAll(require("../database/connection"))
    .catch((error) => console.error("Monthly fee generation failed:", error));
  runFeeBilling();
  const feeBillingInterval = setInterval(runFeeBilling, 6 * 60 * 60 * 1000);
  feeBillingInterval.unref();
});
