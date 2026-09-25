require("dotenv").config();

const express = require("express");
const cors = require("cors");

const app = express();

app.use(
  cors({
    origin:
      process.env.FRONTEND_URL ||
      "http://localhost:5173",
  })
);

app.use(express.json());


// ==========================================
// HEALTH
// ==========================================

app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    message: "Coaching SaaS API is running",
  });
});


// ==========================================
// ROUTES
// ==========================================

const authRoutes =
  require("./routes/auth.routes");

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

const instituteStudentRoutes =
  require("./routes/instituteStudent.routes");


const teacherRoutes =
  require("./routes/teacher.routes");

const courseRoutes =
  require("./routes/course.routes");

const subscriptionsRoutes =
  require("./routes/subscriptions.routes");

const plansRoutes = require("./routes/plans.routes");

app.use("/api/plans", plansRoutes);
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

app.use(
  "/api/institute/dashboard",
  instituteDashboardRoutes
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
    `Coaching SaaS API running on http://localhost:${PORT}`
  );
});