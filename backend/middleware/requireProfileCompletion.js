import pool from '../config/db.js';
import ensureUserProfileColumns from '../utils/ensureUserProfileColumns.js';

function isProfileComplete(user) {
  return Boolean(user?.phone && String(user.phone).trim() && user?.address && String(user.address).trim());
}

export default async function requireProfileCompletion(req, res, next) {
  try {
    await ensureUserProfileColumns();

    const result = await pool.query('SELECT phone, address FROM users WHERE id = $1', [req.user.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found.' });
    }

    if (!isProfileComplete(result.rows[0])) {
      return res.status(403).json({
        error: 'Lengkapi profil Anda (telepon dan alamat) sebelum menggunakan fitur ini.',
        code: 'PROFILE_INCOMPLETE',
      });
    }

    return next();
  } catch (error) {
    console.error('Profile Completion Middleware Error:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
}
