const pool = require("../../database/connection");
const { generateDueMonthlyFees } = require("../services/fees.service");

async function getPendingFees(req, res) {
  const frequency = req.query.frequency;
  if (frequency && !["ONE_TIME", "MONTHLY"].includes(frequency)) {
    return res.status(400).json({ success: false, message: "Invalid fee frequency" });
  }
  try {
    await generateDueMonthlyFees(pool, req.user.instituteId);
    const params = [req.user.instituteId];
    const frequencyFilter = frequency ? `AND f.fee_frequency=$${params.push(frequency)}` : "";
    const result = await pool.query(
      `SELECT f.id AS fee_id,f.title,f.fee_frequency,f.amount,f.paid_amount,
         (f.amount-f.paid_amount) AS balance,f.due_date,f.status AS stored_status,
         CASE WHEN f.paid_amount>=f.amount THEN 'PAID'
              WHEN f.due_date<CURRENT_DATE THEN 'OVERDUE'
              WHEN f.paid_amount>0 THEN 'PARTIAL' ELSE 'PENDING' END AS status,
         f.billing_period_start,f.billing_period_end,s.id AS student_id,s.admission_number,
         u.name AS student_name,u.phone,b.name AS batch_name
       FROM fees f JOIN students s ON s.id=f.student_id JOIN users u ON u.id=s.user_id
       LEFT JOIN batches b ON b.id=s.fee_batch_id
       WHERE f.institute_id=$1 AND f.paid_amount<f.amount ${frequencyFilter}
       ORDER BY f.due_date ASC NULLS LAST,u.name`,
      params,
    );
    return res.json({ success: true, data: result.rows });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ success: false, message: "Could not fetch pending fees" });
  }
}

async function getStudentFees(req, res) {
  try {
    await generateDueMonthlyFees(pool, req.user.instituteId);
    const result = await pool.query(
      `SELECT f.*,s.admission_number,u.name AS student_name
       FROM fees f JOIN students s ON s.id=f.student_id JOIN users u ON u.id=s.user_id
       WHERE f.institute_id=$1 AND f.student_id=$2 ORDER BY f.due_date DESC NULLS LAST,f.created_at DESC`,
      [req.user.instituteId, req.params.studentId],
    );
    return res.json({ success: true, data: result.rows });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ success: false, message: "Could not fetch student fees" });
  }
}

async function receiveFee(req, res) {
  const { amount, paymentMethod = "CASH", transactionId, paymentDate } = req.body;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const feeResult = await client.query(
      `SELECT f.*,s.user_id FROM fees f JOIN students s ON s.id=f.student_id
       WHERE f.id=$1 AND f.institute_id=$2 FOR UPDATE`,
      [req.params.feeId, req.user.instituteId],
    );
    if (!feeResult.rowCount) {
      await client.query("ROLLBACK");
      return res.status(404).json({ success: false, message: "Fee record not found" });
    }
    const fee = feeResult.rows[0];
    const balance = Number(fee.amount) - Number(fee.paid_amount);
    const received = amount == null ? balance : Number(amount);
    if (!Number.isFinite(received) || received <= 0 || !Number.isInteger(received * 100) || received > balance) {
      await client.query("ROLLBACK");
      return res.status(400).json({ success: false, message: `Payment must be greater than zero and no more than ${balance}` });
    }
    await client.query(
      `INSERT INTO payments (institute_id,fee_id,student_id,student_user_id,amount,payment_method,transaction_id,payment_date)
       VALUES ($1,$2,$3,$4,$5,$6,$7,COALESCE($8::date,CURRENT_DATE))`,
      [req.user.instituteId, fee.id, fee.student_id, fee.user_id, received, paymentMethod, transactionId || null, paymentDate || null],
    );
    const paidAmount = Number((Number(fee.paid_amount) + received).toFixed(2));
    const updated = await client.query(
      `UPDATE fees SET paid_amount=$1,
         status=CASE WHEN $1>=amount THEN 'PAID'::fee_status
                     WHEN due_date<CURRENT_DATE THEN 'OVERDUE'::fee_status
                     ELSE 'PARTIAL'::fee_status END
       WHERE id=$2 RETURNING *`,
      [paidAmount, fee.id],
    );
    const newStatus = updated.rows[0].status;
    await client.query("COMMIT");
    return res.json({ success: true, message: newStatus === "PAID" ? "Fee received in full" : "Partial payment received", data: updated.rows[0] });
  } catch (e) {
    await client.query("ROLLBACK");
    console.error(e);
    return res.status(500).json({ success: false, message: "Could not record fee payment" });
  } finally {
    client.release();
  }
}

async function getFeeSummary(req, res) {
  try {
    await generateDueMonthlyFees(pool, req.user.instituteId);
    const result = await pool.query(
      `SELECT fee_frequency,
         COUNT(*) FILTER (WHERE paid_amount<amount)::int AS pending_count,
         COALESCE(SUM(amount-paid_amount) FILTER (WHERE paid_amount<amount),0)::numeric AS pending_amount,
         COALESCE(SUM(paid_amount),0)::numeric AS received_amount,
         COUNT(*) FILTER (WHERE due_date<CURRENT_DATE AND paid_amount<amount)::int AS overdue_count
       FROM fees WHERE institute_id=$1 GROUP BY fee_frequency`,
      [req.user.instituteId],
    );
    const summary = {
      ONE_TIME: { pendingCount: 0, pendingAmount: 0, receivedAmount: 0, overdueCount: 0 },
      MONTHLY: { pendingCount: 0, pendingAmount: 0, receivedAmount: 0, overdueCount: 0 },
    };
    for (const row of result.rows) summary[row.fee_frequency] = {
      pendingCount: row.pending_count,
      pendingAmount: Number(row.pending_amount),
      receivedAmount: Number(row.received_amount),
      overdueCount: row.overdue_count,
    };
    return res.json({ success: true, data: summary });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ success: false, message: "Could not fetch fee summary" });
  }
}

module.exports = { getPendingFees, getStudentFees, receiveFee, getFeeSummary };
