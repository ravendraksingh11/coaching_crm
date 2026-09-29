ALTER TABLE students
  ADD COLUMN IF NOT EXISTS fee_applicable BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS fee_frequency VARCHAR(20),
  ADD COLUMN IF NOT EXISTS fee_amount NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS fee_batch_id UUID REFERENCES batches(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS fee_start_date DATE;

ALTER TABLE students DROP CONSTRAINT IF EXISTS students_fee_plan_check;
ALTER TABLE students ADD CONSTRAINT students_fee_plan_check CHECK (
  (fee_applicable=FALSE AND fee_frequency IS NULL AND fee_amount IS NULL AND fee_batch_id IS NULL AND fee_start_date IS NULL)
  OR
  (fee_applicable=TRUE AND fee_frequency IN ('ONE_TIME','MONTHLY') AND fee_amount>0 AND fee_start_date IS NOT NULL
    AND (fee_frequency<>'MONTHLY' OR fee_batch_id IS NOT NULL))
);

ALTER TABLE fees
  ADD COLUMN IF NOT EXISTS fee_frequency VARCHAR(20) NOT NULL DEFAULT 'ONE_TIME',
  ADD COLUMN IF NOT EXISTS billing_period_start DATE,
  ADD COLUMN IF NOT EXISTS billing_period_end DATE;

UPDATE fees SET billing_period_start=COALESCE(billing_period_start,due_date,created_at::date),
  billing_period_end=COALESCE(billing_period_end,due_date,created_at::date)
WHERE billing_period_start IS NULL OR billing_period_end IS NULL;

ALTER TABLE fees DROP CONSTRAINT IF EXISTS fees_frequency_check;
ALTER TABLE fees ADD CONSTRAINT fees_frequency_check CHECK (fee_frequency IN ('ONE_TIME','MONTHLY'));
CREATE UNIQUE INDEX IF NOT EXISTS uq_fees_student_monthly_period
  ON fees(student_id,billing_period_start) WHERE fee_frequency='MONTHLY';
CREATE INDEX IF NOT EXISTS idx_fees_institute_frequency_status
  ON fees(institute_id,fee_frequency,status,due_date);
