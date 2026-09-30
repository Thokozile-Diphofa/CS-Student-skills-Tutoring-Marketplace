const db = require("../db");

let schemaInitialized = false;

async function ensureTutorApplicationSchema() {
  if (schemaInitialized) return;

  await db.query(`
    CREATE TABLE IF NOT EXISTS tutor_profiles (
      user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      headline VARCHAR(255) DEFAULT 'Computer Science & Mathematics Peer Tutor',
      bio TEXT DEFAULT 'Experienced computer science student tutor passionate about helping peers master programming algorithms, web development, and course concepts.',
      hourly_rate NUMERIC(10, 2) NOT NULL DEFAULT 180.00,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS tutor_skills (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      skill_name VARCHAR(100) NOT NULL,
      UNIQUE(user_id, skill_name)
    );
  `);

  await db.query(`
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
  `);

  await db.query(`
    INSERT INTO tutor_applications (user_id, subjects, proposed_hourly_rate, application_source)
    SELECT
      ur.user_id,
      COALESCE(
        ARRAY_AGG(DISTINCT ts.skill_name) FILTER (WHERE ts.skill_name IS NOT NULL),
        '{}'
      ),
      tp.hourly_rate,
      'LEGACY'
    FROM user_roles ur
    LEFT JOIN tutor_profiles tp ON tp.user_id = ur.user_id
    LEFT JOIN tutor_skills ts ON ts.user_id = ur.user_id
    WHERE ur.role = 'TUTOR'
      AND NOT EXISTS (
        SELECT 1 FROM tutor_applications ta WHERE ta.user_id = ur.user_id
      )
    GROUP BY ur.user_id, tp.hourly_rate
    ON CONFLICT (user_id) DO NOTHING;
  `);

  await db.query(`
    DELETE FROM user_roles ur
    USING tutor_applications ta
    WHERE ta.user_id = ur.user_id
      AND ur.role = 'TUTOR'
      AND ta.status <> 'APPROVED';
  `);

  schemaInitialized = true;
}

async function getEffectiveRoles(userId) {
  await ensureTutorApplicationSchema();
  const result = await db.query(`
    SELECT ur.role
    FROM user_roles ur
    WHERE ur.user_id = $1
      AND (
        ur.role <> 'TUTOR'
        OR EXISTS (
          SELECT 1
          FROM tutor_applications ta
          WHERE ta.user_id = ur.user_id
            AND ta.status = 'APPROVED'
            AND ta.email_verified_at IS NOT NULL
        )
      )
    ORDER BY ur.role ASC
  `, [userId]);
  return result.rows.map((row) => row.role);
}

module.exports = {
  ensureTutorApplicationSchema,
  getEffectiveRoles
};