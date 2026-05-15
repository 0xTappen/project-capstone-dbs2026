import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import pool from '../config/db.js';
import ensureUserProfileColumns from '../utils/ensureUserProfileColumns.js';

const PHONE_REGEX = /^\+?[0-9()\-\s]{7,20}$/;
const MAX_AVATAR_URL_LENGTH = 1800000;

function normalizeOptionalField(value) {
  if (value === undefined) {
    return undefined;
  }

  const normalized = String(value).trim();
  return normalized || null;
}

function normalizeAvatarUrl(value) {
  if (value === undefined) {
    return { value: undefined };
  }

  if (value === null) {
    return { value: null };
  }

  const normalized = String(value).trim();
  if (!normalized) {
    return { value: null };
  }

  const isDataImage = normalized.startsWith('data:image/') && normalized.includes(';base64,');
  const isRemoteUrl = /^https?:\/\//i.test(normalized);

  if (!isDataImage && !isRemoteUrl) {
    return { error: 'Avatar must be a valid image URL or data URL.' };
  }

  if (normalized.length > MAX_AVATAR_URL_LENGTH) {
    return { error: 'Avatar image is too large.' };
  }

  return { value: normalized };
}

export const register = async (req, res) => {
  const { name, email, password } = req.body;
  const normalizedName = String(name || '').trim();
  const normalizedEmail = String(email || '').trim().toLowerCase();
  const normalizedPassword = String(password || '');
  const normalizedPhone = normalizeOptionalField(req.body?.phone);
  const normalizedAddress = normalizeOptionalField(req.body?.address);
  const normalizedAvatar = normalizeAvatarUrl(req.body?.avatar_url);

  if (!normalizedName || !normalizedEmail || !normalizedPassword) {
    return res.status(400).json({ error: 'Name, email, and password are required.' });
  }

  if (normalizedPassword.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters long.' });
  }

  if (normalizedPhone && !PHONE_REGEX.test(normalizedPhone)) {
    return res.status(400).json({ error: 'Phone number format is invalid.' });
  }

  if (normalizedPhone && normalizedPhone.length > 20) {
    return res.status(400).json({ error: 'Phone number is too long.' });
  }

  if (normalizedAddress && normalizedAddress.length > 255) {
    return res.status(400).json({ error: 'Address is too long.' });
  }

  if (normalizedAvatar.error) {
    return res.status(400).json({ error: normalizedAvatar.error });
  }

  const client = await pool.connect();

  try {
    await ensureUserProfileColumns();
    await client.query('BEGIN');

    const userCheck = await client.query('SELECT id FROM users WHERE email = $1', [normalizedEmail]);
    if (userCheck.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Email already registered.' });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(normalizedPassword, salt);

    const newUser = await client.query(
      'INSERT INTO users (name, email, password_hash, phone, address, avatar_url) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, name, email, phone, address, avatar_url, created_at',
      [normalizedName, normalizedEmail, passwordHash, normalizedPhone, normalizedAddress, normalizedAvatar.value ?? null]
    );

    await client.query(
      'INSERT INTO user_settings (user_id, currency, theme) VALUES ($1, $2, $3)',
      [newUser.rows[0].id, 'IDR', 'system']
    );

    await client.query('COMMIT');

    return res.status(201).json({
      message: 'Registration successful.',
      user: newUser.rows[0],
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Register Error:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  } finally {
    client.release();
  }
};

export const login = async (req, res) => {
  const { email, password } = req.body;
  const normalizedEmail = String(email || '').trim().toLowerCase();
  const normalizedPassword = String(password || '');
  const jwtSecret = process.env.JWT_SECRET;

  if (!normalizedEmail || !normalizedPassword) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  if (!jwtSecret) {
    return res.status(500).json({ error: 'Server auth configuration is invalid.' });
  }

  try {
    await ensureUserProfileColumns();
    const userResult = await pool.query('SELECT * FROM users WHERE email = $1', [normalizedEmail]);
    if (userResult.rows.length === 0) {
      return res.status(400).json({ error: 'Invalid email or password.' });
    }

    const user = userResult.rows[0];
    const isMatch = await bcrypt.compare(normalizedPassword, user.password_hash);
    if (!isMatch) {
      return res.status(400).json({ error: 'Invalid email or password.' });
    }

    const token = jwt.sign({ id: user.id, email: user.email }, jwtSecret, { expiresIn: '7d' });

    return res.status(200).json({
      message: 'Login successful.',
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        address: user.address,
        avatar_url: user.avatar_url,
        created_at: user.created_at,
      },
    });
  } catch (error) {
    console.error('Login Error:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
};

export const getMe = async (req, res) => {
  try {
    await ensureUserProfileColumns();
    const userResult = await pool.query(
      'SELECT id, name, email, phone, address, avatar_url, created_at FROM users WHERE id = $1',
      [req.user.id]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found.' });
    }

    return res.status(200).json({ user: userResult.rows[0] });
  } catch (error) {
    console.error('Get Me Error:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
};

export const updateMe = async (req, res) => {
  const userId = req.user.id;
  const rawName = req.body?.name;
  const rawEmail = req.body?.email;
  const rawPhone = req.body?.phone;
  const rawAddress = req.body?.address;
  const rawAvatarUrl = req.body?.avatar_url;

  const hasAnyField = [rawName, rawEmail, rawPhone, rawAddress, rawAvatarUrl].some((value) => value !== undefined);
  if (!hasAnyField) {
    return res.status(400).json({ error: 'At least one field (name, email, phone, address, or avatar_url) is required.' });
  }

  const updates = {};

  if (rawName !== undefined) {
    updates.name = String(rawName).trim();
    if (updates.name.length < 2) {
      return res.status(400).json({ error: 'Name must be at least 2 characters long.' });
    }
  }

  if (rawEmail !== undefined) {
    updates.email = String(rawEmail).trim().toLowerCase();
    if (!updates.email.includes('@')) {
      return res.status(400).json({ error: 'Invalid email format.' });
    }
  }

  if (rawPhone !== undefined) {
    updates.phone = normalizeOptionalField(rawPhone);

    if (updates.phone && !PHONE_REGEX.test(updates.phone)) {
      return res.status(400).json({ error: 'Phone number format is invalid.' });
    }

    if (updates.phone && updates.phone.length > 20) {
      return res.status(400).json({ error: 'Phone number is too long.' });
    }
  }

  if (rawAddress !== undefined) {
    updates.address = normalizeOptionalField(rawAddress);

    if (updates.address && updates.address.length > 255) {
      return res.status(400).json({ error: 'Address is too long.' });
    }
  }

  if (rawAvatarUrl !== undefined) {
    const normalizedAvatar = normalizeAvatarUrl(rawAvatarUrl);
    if (normalizedAvatar.error) {
      return res.status(400).json({ error: normalizedAvatar.error });
    }
    updates.avatar_url = normalizedAvatar.value;
  }

  try {
    await ensureUserProfileColumns();

    if (updates.email !== undefined) {
      const duplicateEmail = await pool.query(
        'SELECT id FROM users WHERE email = $1 AND id <> $2',
        [updates.email, userId]
      );
      if (duplicateEmail.rows.length > 0) {
        return res.status(400).json({ error: 'Email already registered.' });
      }
    }

    const currentUser = await pool.query('SELECT id, name, email, phone, address, avatar_url FROM users WHERE id = $1', [userId]);
    if (currentUser.rows.length === 0) {
      return res.status(404).json({ error: 'User not found.' });
    }

    const finalName = updates.name ?? currentUser.rows[0].name;
    const finalEmail = updates.email ?? currentUser.rows[0].email;
    const finalPhone = updates.phone !== undefined ? updates.phone : currentUser.rows[0].phone;
    const finalAddress = updates.address !== undefined ? updates.address : currentUser.rows[0].address;
    const finalAvatarUrl = updates.avatar_url !== undefined ? updates.avatar_url : currentUser.rows[0].avatar_url;

    const updatedUser = await pool.query(
      'UPDATE users SET name = $1, email = $2, phone = $3, address = $4, avatar_url = $5 WHERE id = $6 RETURNING id, name, email, phone, address, avatar_url, created_at',
      [finalName, finalEmail, finalPhone, finalAddress, finalAvatarUrl, userId]
    );

    return res.status(200).json({
      message: 'Profile updated successfully.',
      user: updatedUser.rows[0],
    });
  } catch (error) {
    console.error('Update Me Error:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
};

export const changePassword = async (req, res) => {
  const userId = req.user.id;
  const currentPassword = String(req.body?.currentPassword || '');
  const newPassword = String(req.body?.newPassword || '');

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'Current password and new password are required.' });
  }

  if (newPassword.length < 8) {
    return res.status(400).json({ error: 'New password must be at least 8 characters long.' });
  }

  try {
    await ensureUserProfileColumns();
    const userResult = await pool.query('SELECT id, password_hash FROM users WHERE id = $1', [userId]);
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found.' });
    }

    const user = userResult.rows[0];
    const isCurrentValid = await bcrypt.compare(currentPassword, user.password_hash);
    if (!isCurrentValid) {
      return res.status(400).json({ error: 'Current password is incorrect.' });
    }

    const isSamePassword = await bcrypt.compare(newPassword, user.password_hash);
    if (isSamePassword) {
      return res.status(400).json({ error: 'New password must be different from current password.' });
    }

    const newHash = await bcrypt.hash(newPassword, 10);
    await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [newHash, userId]);

    return res.status(200).json({ message: 'Password updated successfully.' });
  } catch (error) {
    console.error('Change Password Error:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
};
