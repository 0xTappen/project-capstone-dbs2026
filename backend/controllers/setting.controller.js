import pool from '../config/db.js';

export const getSettings = async (req, res) => {
  const userId = req.user.id;

  try {
    let settings = await pool.query(
      'SELECT id, user_id, currency, theme FROM user_settings WHERE user_id = $1',
      [userId]
    );

    if (settings.rows.length === 0) {
      // Create default settings if they don't exist
      const defaultSettings = await pool.query(
        'INSERT INTO user_settings (user_id, currency, theme) VALUES ($1, $2, $3) RETURNING id, user_id, currency, theme',
        [userId, 'IDR', 'system']
      );
      return res.status(200).json(defaultSettings.rows[0]);
    }

    return res.status(200).json(settings.rows[0]);
  } catch (error) {
    console.error('Get Settings Error:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
};

export const updateSettings = async (req, res) => {
  const userId = req.user.id;
  const { currency, theme } = req.body;
  const normalizedTheme = theme ? String(theme).trim().toLowerCase() : undefined;
  const normalizedCurrency = currency ? String(currency).trim().toUpperCase() : undefined;

  if (normalizedTheme !== undefined && !['light', 'dark', 'system'].includes(normalizedTheme)) {
    return res.status(400).json({ error: "Theme must be either 'light', 'dark', or 'system'." });
  }

  try {
    const updated = await pool.query(
      `INSERT INTO user_settings (user_id, currency, theme) 
       VALUES ($1, $2, $3) 
       ON CONFLICT (user_id) 
       DO UPDATE SET currency = COALESCE(EXCLUDED.currency, user_settings.currency), 
                     theme = COALESCE(EXCLUDED.theme, user_settings.theme)
       RETURNING id, user_id, currency, theme`,
      [userId, normalizedCurrency, normalizedTheme]
    );

    return res.status(200).json(updated.rows[0]);
  } catch (error) {
    console.error('Update Settings Error:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
};
