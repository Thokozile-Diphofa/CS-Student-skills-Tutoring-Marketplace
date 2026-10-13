const db = require("../db");

let schemaInitializationPromise = null;

async function initializeReportSchema() {
  await db.query(`
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
    )
  `);
  await db.query(`
    CREATE INDEX IF NOT EXISTS reports_reporter_created_idx
    ON reports (reporter_id, created_at DESC, id DESC)
  `);
  await db.query(`
    CREATE INDEX IF NOT EXISTS reports_status_category_created_idx
    ON reports (status, category, created_at DESC, id DESC)
  `);
}

function ensureReportSchema() {
  if (!schemaInitializationPromise) {
    schemaInitializationPromise = initializeReportSchema().catch((error) => {
      schemaInitializationPromise = null;
      throw error;
    });
  }
  return schemaInitializationPromise;
}

module.exports = { ensureReportSchema };
