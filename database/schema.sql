CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TYPE user_role AS ENUM (
    'SUPER_ADMIN',
    'INSTITUTE_ADMIN',
    'TEACHER',
    'STUDENT',
    'PARENT'
);

CREATE TYPE user_status AS ENUM (
    'ACTIVE',
    'INACTIVE',
    'BLOCKED'
);

CREATE TYPE institute_status AS ENUM (
    'TRIAL',
    'ACTIVE',
    'SUSPENDED',
    'EXPIRED'
);

CREATE TABLE institutes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    phone VARCHAR(20),
    address TEXT,
    city VARCHAR(100),
    state VARCHAR(100),
    status institute_status NOT NULL DEFAULT 'TRIAL',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    institute_id UUID REFERENCES institutes(id)
        ON DELETE SET NULL,

    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    phone VARCHAR(20),
    password_hash TEXT NOT NULL,

    role user_role NOT NULL,
    status user_status NOT NULL DEFAULT 'ACTIVE',

    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_users_institute
ON users(institute_id);

CREATE INDEX idx_users_role
ON users(role);

==========================================
SUBSCRIPTION PLANS
==========================================

CREATE TABLE subscription_plans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    name VARCHAR(100) NOT NULL,
    description TEXT,

    price NUMERIC(10,2) NOT NULL DEFAULT 0,
    duration_months INTEGER NOT NULL DEFAULT 1,

    student_limit INTEGER NOT NULL,
    teacher_limit INTEGER NOT NULL DEFAULT 10,

    features JSONB NOT NULL DEFAULT '{}'::jsonb,

    is_active BOOLEAN NOT NULL DEFAULT TRUE,

    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);


-- ==========================================
-- SUBSCRIPTIONS
-- ==========================================

CREATE TYPE subscription_status AS ENUM (
    'TRIAL',
    'ACTIVE',
    'EXPIRED',
    'CANCELLED'
);

CREATE TABLE subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    institute_id UUID NOT NULL
        REFERENCES institutes(id)
        ON DELETE CASCADE,

    plan_id UUID NOT NULL
        REFERENCES subscription_plans(id),

    status subscription_status NOT NULL DEFAULT 'TRIAL',

    start_date DATE NOT NULL,
    end_date DATE NOT NULL,

    amount NUMERIC(10,2) NOT NULL DEFAULT 0,

    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_subscriptions_institute
ON subscriptions(institute_id);


-- ==========================================
-- COURSES
-- ==========================================

CREATE TABLE courses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    institute_id UUID NOT NULL
        REFERENCES institutes(id)
        ON DELETE CASCADE,

    name VARCHAR(255) NOT NULL,
    description TEXT,

    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);


-- ==========================================
-- BATCHES
-- ==========================================

CREATE TABLE batches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    institute_id UUID NOT NULL
        REFERENCES institutes(id)
        ON DELETE CASCADE,

    course_id UUID
        REFERENCES courses(id)
        ON DELETE SET NULL,

    name VARCHAR(255) NOT NULL,

    start_date DATE,
    end_date DATE,

    start_time TIME,
    end_time TIME,

    room_number VARCHAR(50),

    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_batches_institute
ON batches(institute_id);


-- ==========================================
-- STUDENTS
-- ==========================================

CREATE TABLE students (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    institute_id UUID NOT NULL
        REFERENCES institutes(id)
        ON DELETE CASCADE,

    user_id UUID
        REFERENCES users(id)
        ON DELETE CASCADE,

    admission_number VARCHAR(100) NOT NULL,

    father_name VARCHAR(255),
    mother_name VARCHAR(255),

    date_of_birth DATE,

    address TEXT,
    city VARCHAR(100),
    state VARCHAR(100),

    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(institute_id, admission_number)
);


-- ==========================================
-- BATCH ENROLLMENT
-- ==========================================

CREATE TABLE enrollments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    institute_id UUID NOT NULL
        REFERENCES institutes(id)
        ON DELETE CASCADE,

    student_id UUID NOT NULL
        REFERENCES students(id)
        ON DELETE CASCADE,

    batch_id UUID NOT NULL
        REFERENCES batches(id)
        ON DELETE CASCADE,

    joined_at DATE NOT NULL DEFAULT CURRENT_DATE,

    status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',

    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(student_id, batch_id)
);

CREATE INDEX idx_enrollments_batch
ON enrollments(batch_id);

CREATE INDEX idx_enrollments_student
ON enrollments(student_id);

CREATE TABLE parents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    institute_id UUID NOT NULL
        REFERENCES institutes(id)
        ON DELETE CASCADE,

    user_id UUID NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,

    occupation VARCHAR(255),

    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(user_id)
);

CREATE TABLE parent_students (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    institute_id UUID NOT NULL
        REFERENCES institutes(id)
        ON DELETE CASCADE,

    parent_id UUID NOT NULL
        REFERENCES parents(id)
        ON DELETE CASCADE,

    student_id UUID NOT NULL
        REFERENCES students(id)
        ON DELETE CASCADE,

    relationship VARCHAR(50) DEFAULT 'FATHER',

    UNIQUE(parent_id, student_id)
);

CREATE TABLE teachers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    institute_id UUID NOT NULL
        REFERENCES institutes(id)
        ON DELETE CASCADE,

    user_id UUID NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,

    qualification VARCHAR(255),
    specialization VARCHAR(255),

    joining_date DATE,

    salary NUMERIC(10,2),

    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(user_id)
);

CREATE TYPE fee_status AS ENUM (
    'PENDING',
    'PARTIAL',
    'PAID',
    'OVERDUE'
);

CREATE TABLE fees (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    institute_id UUID NOT NULL
        REFERENCES institutes(id)
        ON DELETE CASCADE,

    student_id UUID NOT NULL
        REFERENCES students(id)
        ON DELETE CASCADE,

    title VARCHAR(255) NOT NULL,

    amount NUMERIC(10,2) NOT NULL,

    paid_amount NUMERIC(10,2)
        NOT NULL DEFAULT 0,

    due_date DATE,

    status fee_status
        NOT NULL DEFAULT 'PENDING',

    created_at TIMESTAMP
        NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    institute_id UUID NOT NULL
        REFERENCES institutes(id)
        ON DELETE CASCADE,

    fee_id UUID
        REFERENCES fees(id)
        ON DELETE SET NULL,

    student_id UUID NOT NULL
        REFERENCES students(id)
        ON DELETE CASCADE,

    student_user_id UUID NOT NULL
        REFERENCES users(id),

    amount NUMERIC(10,2) NOT NULL,

    payment_method VARCHAR(50)
        DEFAULT 'CASH',

    transaction_id VARCHAR(255),

    payment_date DATE
        NOT NULL DEFAULT CURRENT_DATE,

    created_at TIMESTAMP
        NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TYPE attendance_status AS ENUM (
    'PRESENT',
    'ABSENT',
    'LATE'
);

CREATE TABLE attendance (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    institute_id UUID NOT NULL
        REFERENCES institutes(id)
        ON DELETE CASCADE,

    student_id UUID NOT NULL
        REFERENCES students(id)
        ON DELETE CASCADE,

    batch_id UUID NOT NULL
        REFERENCES batches(id)
        ON DELETE CASCADE,

    date DATE NOT NULL,

    status attendance_status NOT NULL,

    marked_by UUID
        REFERENCES users(id),

    created_at TIMESTAMP
        NOT NULL DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(student_id, batch_id, date)
);

CREATE INDEX idx_attendance_institute
ON attendance(institute_id);

CREATE TABLE tests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    institute_id UUID NOT NULL
        REFERENCES institutes(id)
        ON DELETE CASCADE,

    batch_id UUID
        REFERENCES batches(id)
        ON DELETE SET NULL,

    title VARCHAR(255) NOT NULL,

    description TEXT,

    total_marks INTEGER NOT NULL,

    duration_minutes INTEGER,

    test_date DATE,

    created_by UUID
        REFERENCES users(id),

    created_at TIMESTAMP
        DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE questions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    test_id UUID NOT NULL
        REFERENCES tests(id)
        ON DELETE CASCADE,

    question TEXT NOT NULL,

    option_a TEXT,
    option_b TEXT,
    option_c TEXT,
    option_d TEXT,

    correct_option VARCHAR(1),

    marks INTEGER DEFAULT 1,

    created_at TIMESTAMP
        DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE test_results (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    institute_id UUID NOT NULL
        REFERENCES institutes(id)
        ON DELETE CASCADE,

    test_id UUID NOT NULL
        REFERENCES tests(id)
        ON DELETE CASCADE,

    student_id UUID NOT NULL
        REFERENCES students(id)
        ON DELETE CASCADE,

    marks_obtained NUMERIC(10,2) NOT NULL,

    percentage NUMERIC(5,2),

    rank INTEGER,

    submitted_at TIMESTAMP
        DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(test_id, student_id)
);

CREATE TABLE materials (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    institute_id UUID NOT NULL
        REFERENCES institutes(id)
        ON DELETE CASCADE,

    batch_id UUID
        REFERENCES batches(id)
        ON DELETE SET NULL,

    title VARCHAR(255) NOT NULL,

    description TEXT,

    file_url TEXT,

    material_type VARCHAR(50),

    uploaded_by UUID
        REFERENCES users(id),

    created_at TIMESTAMP
        DEFAULT CURRENT_TIMESTAMP
);

CREATE TYPE notification_type AS ENUM (
    'GENERAL',
    'FEE',
    'TEST',
    'RESULT',
    'ATTENDANCE',
    'BATCH'
);

CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    institute_id UUID NOT NULL
        REFERENCES institutes(id)
        ON DELETE CASCADE,

    title VARCHAR(255) NOT NULL,

    message TEXT NOT NULL,

    type notification_type
        DEFAULT 'GENERAL',

    created_by UUID
        REFERENCES users(id),

    created_at TIMESTAMP
        DEFAULT CURRENT_TIMESTAMP
);