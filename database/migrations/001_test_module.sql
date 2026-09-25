-- Run once on databases created before the test module was added.
ALTER TABLE tests ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE'
  CHECK (status IN ('DRAFT', 'ACTIVE', 'INACTIVE'));
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS recipient_user_id UUID REFERENCES users(id) ON DELETE CASCADE;

CREATE TABLE IF NOT EXISTS test_assignments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  test_id UUID NOT NULL REFERENCES tests(id) ON DELETE CASCADE,
  institute_id UUID NOT NULL REFERENCES institutes(id) ON DELETE CASCADE,
  batch_id UUID REFERENCES batches(id) ON DELETE CASCADE,
  student_id UUID REFERENCES students(id) ON DELETE CASCADE,
  due_date TIMESTAMP,
  status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE')),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (batch_id IS NOT NULL OR student_id IS NOT NULL),
  UNIQUE(test_id, batch_id, student_id)
);

CREATE TABLE IF NOT EXISTS test_submissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  test_id UUID NOT NULL REFERENCES tests(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  answers JSONB NOT NULL DEFAULT '{}'::jsonb,
  submitted_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(test_id, student_id)
);

CREATE INDEX IF NOT EXISTS idx_test_assignments_student ON test_assignments(student_id);
CREATE INDEX IF NOT EXISTS idx_test_assignments_batch ON test_assignments(batch_id);
