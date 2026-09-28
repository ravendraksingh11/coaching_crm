CREATE TABLE IF NOT EXISTS attendance_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  institute_id UUID NOT NULL REFERENCES institutes(id) ON DELETE CASCADE,
  batch_id UUID NOT NULL REFERENCES batches(id) ON DELETE CASCADE,
  teacher_id UUID REFERENCES users(id) ON DELETE SET NULL,
  session_date DATE NOT NULL,
  start_time TIME,
  end_time TIME,
  status VARCHAR(20) NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN','COMPLETED','CANCELLED')),
  remarks TEXT,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_attendance_sessions_institute_date
  ON attendance_sessions(institute_id,session_date DESC);
CREATE INDEX IF NOT EXISTS idx_attendance_sessions_batch_date
  ON attendance_sessions(batch_id,session_date DESC);
CREATE UNIQUE INDEX IF NOT EXISTS uq_attendance_sessions_batch_date_start
  ON attendance_sessions(batch_id,session_date,(COALESCE(start_time,TIME '00:00')));

CREATE TABLE IF NOT EXISTS attendance_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  attendance_session_id UUID NOT NULL REFERENCES attendance_sessions(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  status VARCHAR(20) NOT NULL DEFAULT 'ABSENT' CHECK (status IN ('PRESENT','ABSENT','LATE','LEAVE')),
  marked_at TIMESTAMP,
  marked_by UUID REFERENCES users(id) ON DELETE SET NULL,
  remarks TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(attendance_session_id,student_id)
);

CREATE INDEX IF NOT EXISTS idx_attendance_records_student ON attendance_records(student_id);

CREATE TABLE IF NOT EXISTS attendance_audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  attendance_record_id UUID NOT NULL REFERENCES attendance_records(id) ON DELETE CASCADE,
  old_status VARCHAR(20) NOT NULL,
  new_status VARCHAR(20) NOT NULL,
  changed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  reason TEXT,
  changed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Preserve existing daily attendance by mapping each batch/date pair to one completed session.
INSERT INTO attendance_sessions (institute_id,batch_id,session_date,teacher_id,status,remarks,created_at,updated_at)
SELECT a.institute_id,a.batch_id,a.date,
  (array_agg(a.marked_by ORDER BY a.created_at) FILTER (WHERE a.marked_by IS NOT NULL))[1],
  'COMPLETED','Migrated from daily attendance',MIN(a.created_at),MAX(a.created_at)
FROM attendance a
GROUP BY a.institute_id,a.batch_id,a.date
ON CONFLICT DO NOTHING;
-- The source table already permits one attendance per student/batch/date.

INSERT INTO attendance_records (attendance_session_id,student_id,status,marked_at,marked_by,created_at,updated_at)
SELECT s.id,a.student_id,a.status::text,a.created_at,a.marked_by,a.created_at,a.created_at
FROM attendance a
JOIN attendance_sessions s ON s.batch_id=a.batch_id AND s.session_date=a.date
ON CONFLICT (attendance_session_id,student_id) DO NOTHING;
