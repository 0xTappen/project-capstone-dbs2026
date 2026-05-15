import pool from '../config/db.js';

let ensured = false;

export default async function ensureUserProfileColumns() {
  if (ensured) {
    return;
  }

  await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR(20)');
  await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS address VARCHAR(255)');

  ensured = true;
}
