const pool = require("../../database/connection");

async function createEnquiry(req, res) {
  const body = req.body && typeof req.body === "object" ? req.body : {};
  const fullName = typeof body.fullName === "string" ? body.fullName.trim() : "";
  const mobile = typeof body.mobile === "string" ? body.mobile.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const enquiry = typeof body.enquiry === "string" ? body.enquiry.trim() : "";
  const mobileDigits = mobile.replace(/\D/g, "");

  if (
    !fullName ||
    fullName.length > 120 ||
    !/^[+()\-\s\d]{7,20}$/.test(mobile) ||
    mobileDigits.length < 7 ||
    email.length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
    enquiry.length < 5 ||
    enquiry.length > 2000
  ) {
    return res.status(400).json({
      success: false,
      message: "Please provide a valid name, mobile number, email, and enquiry.",
    });
  }

  try {
    const result = await pool.query(
      `INSERT INTO product_enquiries (full_name, mobile, email, enquiry)
       VALUES ($1, $2, $3, $4)
       RETURNING id, full_name, mobile, email, enquiry, contacted, created_at`,
      [fullName, mobile, email, enquiry]
    );

    return res.status(201).json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error("Failed to save product enquiry:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to submit your enquiry. Please try again.",
    });
  }
}

async function getEnquiries(req, res) {
  try {
    const result = await pool.query(
      `SELECT id, full_name, mobile, email, enquiry, contacted, created_at
       FROM product_enquiries
       ORDER BY created_at DESC
       LIMIT 500`
    );

    return res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error("Failed to load product enquiries:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to load enquiries",
    });
  }
}

async function updateEnquiryContacted(req, res) {
  const contacted = req.body?.contacted;

  if (typeof contacted !== "boolean") {
    return res.status(400).json({
      success: false,
      message: "Contacted must be true or false.",
    });
  }

  try {
    const result = await pool.query(
      `UPDATE product_enquiries
       SET contacted = $1
       WHERE id = $2
       RETURNING id, full_name, mobile, email, enquiry, contacted, created_at`,
      [contacted, req.params.id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: "Enquiry not found",
      });
    }

    return res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error("Failed to update enquiry status:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update enquiry status",
    });
  }
}

module.exports = {
  createEnquiry,
  getEnquiries,
  updateEnquiryContacted,
};
