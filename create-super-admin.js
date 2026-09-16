require("dotenv").config();

const bcrypt = require("bcryptjs");
const pool = require("./database/connection");

async function createSuperAdmin() {
  try {
    const passwordHash =
      await bcrypt.hash(
        "Admin@123",
        10
      );

    await pool.query(
      `
      INSERT INTO users
      (
        name,
        email,
        password_hash,
        role,
        status
      )
      VALUES
      (
        $1,
        $2,
        $3,
        'SUPER_ADMIN',
        'ACTIVE'
      )
      ON CONFLICT (email)
      DO NOTHING
      `,
      [
        "Super Admin",
        "superadmin@example.com",
        passwordHash,
      ]
    );

    console.log(
      "Super Admin created"
    );

    console.log(
      "Email: superadmin@example.com"
    );

    console.log(
      "Password: Admin@123"
    );

    process.exit(0);
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
}

createSuperAdmin();