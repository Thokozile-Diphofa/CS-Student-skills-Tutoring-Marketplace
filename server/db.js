const { Pool } = require("pg");
require("dotenv").config();

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.warn("⚠️ DATABASE_URL environment variable is not set. Database operations will fail until configured.");
}

const pool = new Pool({
  connectionString: connectionString,
  ssl: connectionString && connectionString.includes("neon.tech") ? { rejectUnauthorized: false } : false
});

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool
};
