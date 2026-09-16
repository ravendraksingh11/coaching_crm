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
      adminPhone,
      adminPassword,
    } = req.body;

    if (!name) {
      return res.status(400).json({
        success: false,
        message: "Institute name is required",
      });
    }

    if (!adminName || !adminEmail || !adminPassword) {
      return res.status(400).json({
        success: false,
        message:
          "Admin name, email and password are required",
      });
    }

    await client.query("BEGIN");

    // Check admin email
    const existingUser = await client.query(
      `
      SELECT id
      FROM users
      WHERE email = $1
      `,
      [adminEmail]
    );

    if (existingUser.rows.length > 0) {
      await client.query("ROLLBACK");

      return res.status(409).json({
        success: false,
        message: "Admin email already exists",
      });
    }

    // Create institute
    const instituteResult = await client.query(
      `
      INSERT INTO institutes
      (
        name,
        email,
        phone,
        address,
        city,
        state,
        status
      )
      VALUES ($1,$2,$3,$4,$5,$6,'TRIAL')
      RETURNING *
      `,
      [
        name,
        email || null,
        phone || null,
        address || null,
        city || null,
        state || null,
      ]
    );

    const institute = instituteResult.rows[0];

    // Hash password
    const passwordHash = await bcrypt.hash(
      adminPassword,
      10
    );

    // Create admin user
    const adminResult = await client.query(
      `
      INSERT INTO users
      (
        institute_id,
        name,
        email,
        phone,
        password_hash,
        role,
        status
      )
      VALUES
      (
        $1,$2,$3,$4,$5,
        'INSTITUTE_ADMIN',
        'ACTIVE'
      )
      RETURNING
        id,
        institute_id,
        name,
        email,
        phone,
        role,
        status
      `,
      [
        institute.id,
        adminName,
        adminEmail,
        adminPhone || null,
        passwordHash,
      ]
    );

    await client.query("COMMIT");

    return res.status(201).json({
      success: true,
      message: "Institute created successfully",
      data: {
        institute,
        admin: adminResult.rows[0],
      },
    });
  } catch (error) {
    await client.query("ROLLBACK");

    console.error(error);

    return res.status(500).json({
      success: false,
      message: "Failed to create institute",
    });
  } finally {
    client.release();
  }
}

module.exports = {
  createInstitute,
};