const bcrypt = require("bcryptjs");
const pool = require("../../database/connection");

async function createInstitute(req, res) {
  const client = await pool.connect();
  try {
    const {
      name,
      email,
      phone,
      address,
      city,
      state,
      adminName,
      adminEmail,
      adminPassword,
      adminPhone,
    } = req.body;
    if (!name || !adminName || !adminEmail || !adminPassword) {
      return res
        .status(400)
        .json({
          success: false,
          message: "Institute and admin details are required",
        });
    }
    await client.query("BEGIN");
    const duplicate = await client.query(
      "SELECT id FROM users WHERE email = $1",
      [adminEmail],
    );
    if (duplicate.rowCount) {
      await client.query("ROLLBACK");
      return res
        .status(409)
        .json({ success: false, message: "Admin email already exists" });
    }
    const institute = await client.query(
      `INSERT INTO institutes (name,email,phone,address,city,state,status)
       VALUES ($1,$2,$3,$4,$5,$6,'TRIAL') RETURNING *`,
      [
        name,
        email || null,
        phone || null,
        address || null,
        city || null,
        state || null,
      ],
    );
    const passwordHash = await bcrypt.hash(adminPassword, 10);
    const admin = await client.query(
      `INSERT INTO users (institute_id,name,email,phone,password_hash,role,status)
       VALUES ($1,$2,$3,$4,$5,'INSTITUTE_ADMIN','ACTIVE')
       RETURNING id,institute_id,name,email,phone,role,status`,
      [
        institute.rows[0].id,
        adminName,
        adminEmail,
        adminPhone || null,
        passwordHash,
      ],
    );
    await client.query("COMMIT");
    return res
      .status(201)
      .json({
        success: true,
        data: { institute: institute.rows[0], admin: admin.rows[0] },
      });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error(error);
    return res
      .status(500)
      .json({ success: false, message: "Failed to create institute" });
  } finally {
    client.release();
  }
}

async function updateInstitute(req, res) {
  try {
    const { name, email, phone, address, city, state } = req.body;
    const result = await pool.query(
      `UPDATE institutes SET name=COALESCE($1,name), email=COALESCE($2,email), phone=COALESCE($3,phone),
       address=COALESCE($4,address), city=COALESCE($5,city), state=COALESCE($6,state), updated_at=CURRENT_TIMESTAMP
       WHERE id=$7 RETURNING *`,
      [name, email, phone, address, city, state, req.params.id],
    );
    if (!result.rowCount)
      return res
        .status(404)
        .json({ success: false, message: "Institute not found" });
    return res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .json({ success: false, message: "Failed to update institute" });
  }
}

async function setInstituteStatus(req, res) {
  const { status } = req.body;
  if (!["TRIAL", "ACTIVE", "SUSPENDED", "EXPIRED"].includes(status))
    return res
      .status(400)
      .json({ success: false, message: "Invalid institute status" });
  try {
    const result = await pool.query(
      "UPDATE institutes SET status=$1, updated_at=CURRENT_TIMESTAMP WHERE id=$2 RETURNING *",
      [status, req.params.id],
    );
    if (!result.rowCount)
      return res
        .status(404)
        .json({ success: false, message: "Institute not found" });
    return res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .json({ success: false, message: "Failed to change institute status" });
  }
}

async function deleteInstitute(req, res) {
  try {
    const result = await pool.query(
      "DELETE FROM institutes WHERE id=$1 RETURNING id",
      [req.params.id],
    );
    if (!result.rowCount)
      return res
        .status(404)
        .json({ success: false, message: "Institute not found" });
    return res.json({ success: true, message: "Institute deleted" });
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .json({ success: false, message: "Failed to delete institute" });
  }
}

async function createPlan(req, res) {
  const {
    name,
    description,
    price,
    durationMonths,
    studentLimit,
    teacherLimit,
    features,
  } = req.body;
  if (
    !name ||
    !Number.isInteger(Number(studentLimit)) ||
    Number(studentLimit) < 1 ||
    !Number.isInteger(Number(durationMonths)) ||
    Number(durationMonths) < 1
  ) {
    return res
      .status(400)
      .json({
        success: false,
        message: "Name, positive studentLimit and durationMonths are required",
      });
  }
  try {
    const result = await pool.query(
      `INSERT INTO subscription_plans (name,description,price,duration_months,student_limit,teacher_limit,features)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [
        name,
        description || null,
        price || 0,
        durationMonths,
        studentLimit,
        teacherLimit || 10,
        features || {},
      ],
    );
    return res.status(201).json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .json({ success: false, message: "Failed to create plan" });
  }
}

async function updatePlan(req, res) {
  const {
    name,
    description,
    price,
    durationMonths,
    studentLimit,
    teacherLimit,
    features,
    isActive,
  } = req.body;
  try {
    const result = await pool.query(
      `UPDATE subscription_plans SET name=COALESCE($1,name), description=COALESCE($2,description), price=COALESCE($3,price),
       duration_months=COALESCE($4,duration_months), student_limit=COALESCE($5,student_limit), teacher_limit=COALESCE($6,teacher_limit),
       features=COALESCE($7,features), is_active=COALESCE($8,is_active), updated_at=CURRENT_TIMESTAMP WHERE id=$9 RETURNING *`,
      [
        name,
        description,
        price,
        durationMonths,
        studentLimit,
        teacherLimit,
        features,
        isActive,
        req.params.id,
      ],
    );
    if (!result.rowCount)
      return res
        .status(404)
        .json({ success: false, message: "Plan not found" });
    return res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .json({ success: false, message: "Failed to update plan" });
  }
}

async function deletePlan(req, res) {
  try {
    const active = await pool.query(
      "SELECT id FROM subscriptions WHERE plan_id=$1 AND status IN ('TRIAL','ACTIVE') LIMIT 1",
      [req.params.id],
    );
    if (active.rowCount)
      return res
        .status(409)
        .json({
          success: false,
          message: "Plan has an active subscription and cannot be deleted",
        });
    const result = await pool.query(
      "DELETE FROM subscription_plans WHERE id=$1 RETURNING id",
      [req.params.id],
    );
    if (!result.rowCount)
      return res
        .status(404)
        .json({ success: false, message: "Plan not found" });
    return res.json({ success: true, message: "Plan deleted" });
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .json({ success: false, message: "Failed to delete plan" });
  }
}

module.exports = {
  createInstitute,
  updateInstitute,
  setInstituteStatus,
  deleteInstitute,
  createPlan,
  updatePlan,
  deletePlan,
};
