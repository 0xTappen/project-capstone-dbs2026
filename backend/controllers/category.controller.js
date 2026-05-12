import pool from '../config/db.js';

const DEFAULT_CATEGORIES = [
  { name: 'Gaji', type: 'income' },
  { name: 'Bonus', type: 'income' },
  { name: 'Investasi', type: 'income' },
  { name: 'Freelance', type: 'income' },
  { name: 'Makanan', type: 'expense' },
  { name: 'Transportasi', type: 'expense' },
  { name: 'Belanja', type: 'expense' },
  { name: 'Tagihan', type: 'expense' },
  { name: 'Kesehatan', type: 'expense' },
  { name: 'Hiburan', type: 'expense' },
];

export const getCategories = async (req, res) => {
  try {
    let categories = await pool.query(
      'SELECT * FROM categories WHERE user_id = $1 ORDER BY id DESC',
      [req.user.id]
    );

    if (categories.rows.length === 0) {
      for (const category of DEFAULT_CATEGORIES) {
        await pool.query(
          'INSERT INTO categories (user_id, name, type) VALUES ($1, $2, $3)',
          [req.user.id, category.name, category.type]
        );
      }

      categories = await pool.query(
        'SELECT * FROM categories WHERE user_id = $1 ORDER BY id DESC',
        [req.user.id]
      );
    }

    return res.status(200).json(categories.rows);
  } catch (error) {
    console.error('Get Categories Error:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
};

export const createCategory = async (req, res) => {
  const { name, type } = req.body;

  if (!name || !type) {
    return res.status(400).json({ error: 'Name and type are required.' });
  }

  if (!['income', 'expense'].includes(type)) {
    return res.status(400).json({ error: "Type must be either 'income' or 'expense'." });
  }

  try {
    const newCategory = await pool.query(
      'INSERT INTO categories (user_id, name, type) VALUES ($1, $2, $3) RETURNING *',
      [req.user.id, name, type]
    );
    return res.status(201).json(newCategory.rows[0]);
  } catch (error) {
    console.error('Create Category Error:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
};

export const updateCategory = async (req, res) => {
  const { id } = req.params;
  const { name, type } = req.body;

  if (!name || !type) {
    return res.status(400).json({ error: 'Name and type are required.' });
  }

  if (!['income', 'expense'].includes(type)) {
    return res.status(400).json({ error: "Type must be either 'income' or 'expense'." });
  }

  try {
    const updated = await pool.query(
      'UPDATE categories SET name = $1, type = $2 WHERE id = $3 AND user_id = $4 RETURNING *',
      [name, type, id, req.user.id]
    );

    if (updated.rows.length === 0) {
      return res.status(404).json({ error: 'Category not found or access denied.' });
    }

    return res.status(200).json(updated.rows[0]);
  } catch (error) {
    console.error('Update Category Error:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
};

export const deleteCategory = async (req, res) => {
  const { id } = req.params;

  try {
    const deleted = await pool.query(
      'DELETE FROM categories WHERE id = $1 AND user_id = $2 RETURNING *',
      [id, req.user.id]
    );

    if (deleted.rows.length === 0) {
      return res.status(404).json({ error: 'Category not found or access denied.' });
    }

    return res.status(200).json({ message: 'Category deleted successfully.' });
  } catch (error) {
    console.error('Delete Category Error:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
};
