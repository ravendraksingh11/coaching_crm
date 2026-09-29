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

async function getMyFees(req, res) {
  try {
    const student = await pool.query("SELECT id,institute_id FROM students WHERE user_id=$1", [req.user.userId]);
    if (!student.rowCount) return res.status(404).json({ success: false, message: "Student record not found" });
    await generateDueMonthlyFees(pool, student.rows[0].institute_id);
    // Keep fee listing available on installations that have not yet applied
    // migration 005. Payment submission still requires that migration.
    const submissionTable = await pool.query(
      "SELECT to_regclass('student_fee_payment_submissions') IS NOT NULL AS available",
    );
    const hasSubmissionsTable = submissionTable.rows[0].available;
    const balanceExpression = hasSubmissionsTable
      ? "(f.amount-f.paid_amount-COALESCE((SELECT SUM(r.amount) FROM student_fee_payment_submissions r WHERE r.fee_id=f.id AND r.status='PENDING'),0))"
      : "(f.amount-f.paid_amount)";
    const submissionsExpression = hasSubmissionsTable
      ? "COALESCE((SELECT json_agg(json_build_object('amount',r.amount,'payment_method',r.payment_method,'transaction_id',r.transaction_id,'status',r.status,'created_at',r.created_at) ORDER BY r.created_at DESC) FROM student_fee_payment_submissions r WHERE r.fee_id=f.id AND r.student_id=f.student_id),'[]'::json)"
      : "'[]'::json";
    const result = await pool.query(
      `SELECT f.id,f.title,f.amount,f.paid_amount,
         ${balanceExpression} AS balance,f.due_date,
         CASE WHEN f.paid_amount>=f.amount THEN 'PAID' WHEN f.due_date<CURRENT_DATE THEN 'OVERDUE'
              WHEN f.paid_amount>0 THEN 'PARTIAL' ELSE 'PENDING' END AS status,
         f.fee_frequency,f.billing_period_start,f.billing_period_end,
         ${submissionsExpression} AS submissions
       FROM fees f WHERE f.student_id=$1 ORDER BY f.due_date DESC NULLS LAST,f.created_at DESC`,
      [student.rows[0].id],
    );
    return res.json({ success: true, data: result.rows });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ success: false, message: "Could not load your fees" });
  }
}

async function submitMyFeePayment(req, res) {
  const { amount, paymentMethod = "UPI", transactionId } = req.body;
  try {
    const student = await pool.query("SELECT id,institute_id FROM students WHERE user_id=$1", [req.user.userId]);
    if (!student.rowCount) return res.status(404).json({ success: false, message: "Student record not found" });
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const feeResult = await client.query("SELECT * FROM fees WHERE id=$1 AND student_id=$2 FOR UPDATE", [req.params.feeId, student.rows[0].id]);
      if (!feeResult.rowCount) { await client.query("ROLLBACK"); return res.status(404).json({ success: false, message: "Fee record not found" }); }
      const fee = feeResult.rows[0];
      const outstanding = await client.query("SELECT COALESCE(SUM(amount),0) AS total FROM student_fee_payment_submissions WHERE fee_id=$1 AND status='PENDING'", [fee.id]);
      const balance = Number(fee.amount) - Number(fee.paid_amount) - Number(outstanding.rows[0].total);
      const paymentAmount = Number(amount);
      if (!Number.isFinite(paymentAmount) || paymentAmount <= 0 || !Number.isInteger(paymentAmount * 100) || paymentAmount > balance) {
        await client.query("ROLLBACK");
        return res.status(400).json({ success: false, message: `Payment must be greater than zero and no more than ${Math.max(0, balance)}` });
      }
      const inserted = await client.query(
        `INSERT INTO student_fee_payment_submissions (institute_id,fee_id,student_id,student_user_id,amount,payment_method,transaction_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id,status`,
        [student.rows[0].institute_id, fee.id, student.rows[0].id, req.user.userId, paymentAmount, paymentMethod, transactionId || null],
      );
      await client.query("COMMIT");
      return res.status(201).json({ success: true, message: "Payment submitted for institute review", data: inserted.rows[0] });
    } catch (e) { await client.query("ROLLBACK"); throw e; }
    finally { client.release(); }
  } catch (e) {
    console.error(e);
    return res.status(500).json({ success: false, message: "Could not submit payment" });
  }
}

async function getPendingStudentPayments(req, res) {
  try {
    const result = await pool.query(
      `SELECT r.id,r.fee_id,r.amount,r.payment_method,r.transaction_id,r.created_at,
         s.admission_number,u.name AS student_name,f.title AS fee_title
       FROM student_fee_payment_submissions r JOIN students s ON s.id=r.student_id
       JOIN users u ON u.id=s.user_id JOIN fees f ON f.id=r.fee_id
       WHERE r.institute_id=$1 AND r.status='PENDING' ORDER BY r.created_at`,
      [req.user.instituteId],
    );
    return res.json({ success: true, data: result.rows });
  } catch (e) { console.error(e); return res.status(500).json({ success: false, message: "Could not fetch submitted payments" }); }
}

async function approveStudentPayment(req, res) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const submissionResult = await client.query("SELECT * FROM student_fee_payment_submissions WHERE id=$1 AND institute_id=$2 FOR UPDATE", [req.params.submissionId, req.user.instituteId]);
    if (!submissionResult.rowCount) { await client.query("ROLLBACK"); return res.status(404).json({ success: false, message: "Submitted payment not found" }); }
    const submission = submissionResult.rows[0];
    if (submission.status !== "PENDING") { await client.query("ROLLBACK"); return res.status(409).json({ success: false, message: "Payment has already been reviewed" }); }
    const feeResult = await client.query("SELECT * FROM fees WHERE id=$1 FOR UPDATE", [submission.fee_id]);
    const fee = feeResult.rows[0];
    if (Number(submission.amount) > Number(fee.amount) - Number(fee.paid_amount)) { await client.query("ROLLBACK"); return res.status(409).json({ success: false, message: "Submitted amount is greater than the remaining balance" }); }
    await client.query(
      `INSERT INTO payments (institute_id,fee_id,student_id,student_user_id,amount,payment_method,transaction_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [submission.institute_id, submission.fee_id, submission.student_id, submission.student_user_id, submission.amount, submission.payment_method, submission.transaction_id],
    );
    const paidAmount = Number((Number(fee.paid_amount) + Number(submission.amount)).toFixed(2));
    await client.query("UPDATE fees SET paid_amount=$1,status=CASE WHEN $1>=amount THEN 'PAID'::fee_status WHEN due_date<CURRENT_DATE THEN 'OVERDUE'::fee_status ELSE 'PARTIAL'::fee_status END WHERE id=$2", [paidAmount, fee.id]);
    await client.query("UPDATE student_fee_payment_submissions SET status='APPROVED',reviewed_at=CURRENT_TIMESTAMP,reviewed_by=$1 WHERE id=$2", [req.user.userId, submission.id]);
    await client.query("COMMIT");
    return res.json({ success: true, message: "Student payment confirmed" });
  } catch (e) { await client.query("ROLLBACK"); console.error(e); return res.status(500).json({ success: false, message: "Could not confirm submitted payment" }); }
  finally { client.release(); }
}

module.exports = { getPendingFees, getStudentFees, receiveFee, getFeeSummary, getMyFees, submitMyFeePayment, getPendingStudentPayments, approveStudentPayment };
