async function generateDueMonthlyFees(db, instituteId) {
  await db.query(
    `INSERT INTO fees (
       institute_id,student_id,title,amount,paid_amount,due_date,status,
       fee_frequency,billing_period_start,billing_period_end
     )
     SELECT s.institute_id,s.id,'Monthly tuition fee',s.fee_amount,0,d.period_start,'PENDING',
       'MONTHLY',d.period_start,d.period_end
     FROM students s
     JOIN batches b ON b.id=s.fee_batch_id AND b.institute_id=s.institute_id
     CROSS JOIN LATERAL (
       SELECT generate_series(0,LEAST(1200,GREATEST(0,
         (EXTRACT(YEAR FROM age(LEAST(CURRENT_DATE,b.end_date),s.fee_start_date))*12
          + EXTRACT(MONTH FROM age(LEAST(CURRENT_DATE,b.end_date),s.fee_start_date)))::int + 1
       ))) AS month_index
     ) months
     CROSS JOIN LATERAL (
       SELECT (s.fee_start_date + make_interval(months=>months.month_index))::date AS period_start,
         ((s.fee_start_date + make_interval(months=>months.month_index+1))::date - 1) AS period_end
     ) d
     WHERE s.institute_id=$1 AND s.fee_applicable=TRUE AND s.fee_frequency='MONTHLY'
       AND s.fee_start_date IS NOT NULL AND b.end_date IS NOT NULL
       AND d.period_start <= CURRENT_DATE AND d.period_start <= b.end_date
     ON CONFLICT DO NOTHING`,
    [instituteId],
  );
  await db.query(
    `UPDATE fees SET status='OVERDUE'
     WHERE institute_id=$1 AND fee_frequency IN ('ONE_TIME','MONTHLY')
       AND status IN ('PENDING','PARTIAL') AND due_date < CURRENT_DATE
       AND paid_amount < amount`,
    [instituteId],
  );
}

async function generateDueMonthlyFeesForAll(db) {
  const institutes = await db.query(
    "SELECT DISTINCT institute_id FROM students WHERE fee_applicable=TRUE AND fee_frequency='MONTHLY'",
  );
  for (const row of institutes.rows) {
    await generateDueMonthlyFees(db, row.institute_id);
  }
}

function validateFeePlan({ feePaying, feeFrequency, feeAmount, batchEndDate, batchIsActive }) {
  if (!feePaying) return null;
  if (!['ONE_TIME', 'MONTHLY'].includes(feeFrequency)) return "Choose one-time or monthly fee frequency";
  if (!Number.isFinite(Number(feeAmount)) || Number(feeAmount) <= 0) return "Fee amount must be greater than zero";
  if (feeFrequency === 'MONTHLY' && (!batchEndDate || !batchIsActive)) return "Monthly fees require a batch whose end date has not passed";
  return null;
}

async function createInitialFee(db, { instituteId, studentId, feePaying, feeFrequency, feeAmount, feeStartDate }) {
  if (!feePaying) return;
  if (feeFrequency === 'ONE_TIME') {
    await db.query(
      `INSERT INTO fees (institute_id,student_id,title,amount,paid_amount,due_date,status,fee_frequency,billing_period_start,billing_period_end)
       VALUES ($1,$2,'One-time tuition fee',$3,0,$4,'PENDING','ONE_TIME',$4,$4)`,
      [instituteId, studentId, feeAmount, feeStartDate],
    );
    return;
  }
  await generateDueMonthlyFees(db, instituteId);
}

module.exports = { generateDueMonthlyFees, generateDueMonthlyFeesForAll, validateFeePlan, createInitialFee };
