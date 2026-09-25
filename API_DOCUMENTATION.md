# Coaching SaaS API

Base URL: `/api`. Send `Authorization: Bearer <token>` to every endpoint except health and login. All requests and responses use JSON. Login at `POST /auth/login` with `email` and `password`.

## Super-admin

| Method | Path | Purpose / body |
|---|---|---|
| GET | `/super-admin/dashboard` | Platform totals |
| GET | `/super-admin/institutes` | List institutes |
| POST | `/super-admin/institutes` | Create institute and admin: `name, adminName, adminEmail, adminPassword` (optional contact/address fields) |
| PUT | `/super-admin/institutes/:id` | Edit institute contact/address fields |
| PATCH | `/super-admin/institutes/:id/status` | Block/unblock: `{ "status": "SUSPENDED" }`; use `ACTIVE` or `TRIAL` to restore |
| DELETE | `/super-admin/institutes/:id` | Delete an institute and tenant-owned data |
| GET | `/super-admin/plans` | List subscription plans |
| POST | `/super-admin/plans` | Create: `name, studentLimit, durationMonths, price`; optional `teacherLimit, description, features` |
| PUT | `/super-admin/plans/:id` | Edit plan fields, including `isActive` |
| DELETE | `/super-admin/plans/:id` | Deletes only if it has no active/trial subscription |
| POST | `/subscriptions/institutes/:instituteId` | Assign legacy subscription plan: `{ "planId", "startDate" }` |

Blocked/expired institutes are rejected by authentication on subsequent protected requests.

## Institute admin

| Method | Path | Purpose / body |
|---|---|---|
| GET/POST | `/institute/courses` | List/create course; create needs `name`, optional `description` |
| PUT/DELETE | `/institute/courses/:id` | Edit/delete own course |
| GET/POST | `/institute/batches` | List/create: `name`, optional `courseId,startDate,endDate,startTime,endTime,roomNumber` |
| PUT/DELETE | `/institute/batches/:id` | Edit/delete own batch |
| GET | `/institute/students` | List students |
| POST | `/institute/students` | Add student: `name,email,password,admissionNumber`, optional parent/profile fields and `batchId` |
| PUT/DELETE | `/institute/students/:id` | Edit/delete student |
| POST | `/tests` | Create and assign a test. Needs `title,totalMarks,questions` (exactly 50), and `batchId` and/or `studentId`; optional `description,durationMinutes,testDate,dueDate`. Each question: `question,optionA,optionB,optionC,optionD,correctOption,marks`. |
| GET | `/tests/toppers/latest` | Toppers for the latest available test results (maximum 5) |
| PATCH | `/tests/:id/deactivate` | Close a test and create missed-test notifications |

## Student

| Method | Path | Purpose |
|---|---|---|
| GET | `/tests/my` | Assigned active tests plus own results/submission state |
| GET | `/tests/:id` | Load assigned test questions (correct answers are never returned) |
| POST | `/tests/:id/submit` | Submit once: `{ "answers": { "question-uuid": "A" } }`; returns marks and percentage |

## Parent

| Method | Path | Purpose |
|---|---|---|
| GET | `/parent/performance` | Results of linked children |
| GET | `/parent/notifications` | Institute notifications, including missed-test notices |

Parents must have a `users` record with role `PARENT`, a `parents` record, and a `parent_students` link to each child. The current API does not yet expose parent onboarding; create those relationships through an admin migration/seed until an onboarding UI is added.

## Database setup

For a new database, run `database/schema.sql`. For an existing database, also run [001_test_module.sql](database/migrations/001_test_module.sql) once before using test APIs. Configure `DATABASE_URL`, `JWT_SECRET`, and optionally `FRONTEND_URL`, then start with `npm run dev`.
