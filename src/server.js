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
//     origin: "https://shikvanta.ravendraksingh11.workers.dev"
//     // process.env.FRONTEND_URL ||
//     // "http://localhost:5173",
//   })
// );

app.use(cors({
  origin: [
    "https://shikvanta.com",
    "https://www.shikvanta.com",
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

// Broad protection for API endpoints; sensitive endpoints add a stricter limit below.
app.use("/api", rateLimit({ windowMs: 15 * 60 * 1000, max: 300 }));

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
    health: "/api/health",
  });
});

app.get("/api/health", (req, res) => {
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

app.use("/api/plans", plansRoutes);
app.use("/api/tests", testRoutes);
app.use("/api/parent", parentRoutes);
app.use("/api/attendance", attendanceRoutes);
app.use("/api/fees", feesRoutes);
app.use(
  "/api/subscriptions",
  subscriptionsRoutes
);

app.use(
  "/api/institute/courses",
  courseRoutes
);

app.use(
  "/api/institute/students",
  instituteStudentRoutes
);

app.use(
  "/api/super-admin",
  superAdminRoutes
);

app.use(
  "/api/super-admin/institutes",
  instituteRoutes
);

app.use(
  "/api/institute/batches",
  batchRoutes
);

app.use(
  "/api/institute/students",
  studentRoutes
);

app.use(
  "/api/subscription-plans",
  subscriptionPlanRoutes
);

app.use(
  "/api/subscriptions",
  subscriptionRoutes
);

app.use(
  "/api/auth",
  authRoutes
);

app.use("/api/enquiries", enquiriesRoutes);

app.use(
  "/api/institute/dashboard",
  instituteDashboardRoutes
);

app.use(
  "/api/institute/settings",
  instituteSettingsRoutes
);

app.use(
  "/api/institute/teachers",
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
