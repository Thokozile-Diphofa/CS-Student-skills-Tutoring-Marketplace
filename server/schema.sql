-- User & Multi-Role Schema for EasyLearning CS Student Skills Tutoring Marketplace

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  university VARCHAR(150) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS user_roles (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role VARCHAR(20) NOT NULL CHECK (role IN ('STUDENT', 'TUTOR', 'ADMIN')),
  PRIMARY KEY (user_id, role)
);

CREATE TABLE IF NOT EXISTS tutor_profiles (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  headline VARCHAR(255) DEFAULT 'Computer Science & Mathematics Peer Tutor',
  bio TEXT DEFAULT 'Experienced computer science student tutor passionate about helping peers master programming algorithms, web development, and course concepts.',
  hourly_rate NUMERIC(10, 2) NOT NULL DEFAULT 180.00,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS tutor_skills (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  skill_name VARCHAR(100) NOT NULL,
  UNIQUE(user_id, skill_name)
);

CREATE TABLE IF NOT EXISTS tutor_applications (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  student_number VARCHAR(80),
  programme VARCHAR(200),
  year_of_study SMALLINT CHECK (year_of_study BETWEEN 1 AND 12),
  motivation TEXT,
  experience TEXT,
  skills_description TEXT,
  subjects TEXT[] NOT NULL DEFAULT '{}',
  proposed_hourly_rate NUMERIC(10, 2) CHECK (proposed_hourly_rate > 0),
  status VARCHAR(20) NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
  application_source VARCHAR(20) NOT NULL DEFAULT 'USER'
    CHECK (application_source IN ('USER', 'LEGACY')),
  email_verified_at TIMESTAMP WITH TIME ZONE,
  submitted_at TIMESTAMP WITH TIME ZONE,
  reviewed_at TIMESTAMP WITH TIME ZONE,
  reviewed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  rejection_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE tutor_applications
  ADD COLUMN IF NOT EXISTS university_name VARCHAR(200);

CREATE TABLE IF NOT EXISTS tutor_application_documents (
  id SERIAL PRIMARY KEY,
  application_id INTEGER NOT NULL REFERENCES tutor_applications(id) ON DELETE CASCADE,
  document_type VARCHAR(30) NOT NULL
    CHECK (document_type IN ('registration', 'academicRecord')),
  storage_key VARCHAR(255) NOT NULL UNIQUE,
  original_name VARCHAR(255) NOT NULL,
  mime_type VARCHAR(100) NOT NULL
    CHECK (mime_type IN ('application/pdf', 'image/jpeg', 'image/png')),
  size_bytes INTEGER NOT NULL CHECK (size_bytes > 0 AND size_bytes <= 5242880),
  status VARCHAR(20) NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING', 'VERIFIED', 'REJECTED')),
  rejection_reason TEXT,
  uploaded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  reviewed_at TIMESTAMP WITH TIME ZONE,
  reviewed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  UNIQUE(application_id, document_type)
);

CREATE TABLE IF NOT EXISTS reports (
  id SERIAL PRIMARY KEY,
  reporter_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reporter_roles VARCHAR(20)[] NOT NULL
    CHECK (
      CARDINALITY(reporter_roles) > 0
      AND reporter_roles <@ ARRAY['STUDENT', 'TUTOR', 'ADMIN']::VARCHAR[]
    ),
  category VARCHAR(80) NOT NULL CHECK (category IN (
    'Technical issue',
    'Login or account problem',
    'Tutor application problem',
    'Payment problem',
    'Incorrect or inappropriate content',
    'Suspicious activity or safety concern',
    'Other'
  )),
  subject VARCHAR(160) NOT NULL CHECK (CHAR_LENGTH(BTRIM(subject)) > 0),
  description VARCHAR(5000) NOT NULL CHECK (CHAR_LENGTH(BTRIM(description)) > 0),
  attachment_storage_key VARCHAR(255) UNIQUE,
  attachment_original_name VARCHAR(255),
  attachment_mime_type VARCHAR(100)
    CHECK (attachment_mime_type IN ('application/pdf', 'image/jpeg', 'image/png')),
  attachment_size_bytes INTEGER
    CHECK (attachment_size_bytes BETWEEN 1 AND 5242880),
  status VARCHAR(20) NOT NULL DEFAULT 'OPEN'
    CHECK (status IN ('OPEN', 'IN_REVIEW', 'RESOLVED', 'CLOSED')),
  admin_response TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (
    (attachment_storage_key IS NULL AND attachment_original_name IS NULL
      AND attachment_mime_type IS NULL AND attachment_size_bytes IS NULL)
    OR
    (attachment_storage_key IS NOT NULL AND attachment_original_name IS NOT NULL
      AND attachment_mime_type IS NOT NULL AND attachment_size_bytes IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS reports_reporter_created_idx
  ON reports (reporter_id, created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS reports_status_category_created_idx
  ON reports (status, category, created_at DESC, id DESC);
