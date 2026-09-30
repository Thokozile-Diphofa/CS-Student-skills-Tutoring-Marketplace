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
