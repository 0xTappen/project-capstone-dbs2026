import pool from '../config/db.js';

export const getBudgets = async (req, res) => {
  try {
    const budgets = await pool.query(
      `SELECT b.*, c.name as category_name 
       FROM budgets b
       LEFT JOIN categories c ON b.category_id = c.id
       WHERE b.user_id = $1 
       ORDER BY b.year DESC, b.month DESC`,
      [req.user.id]
    );
    return res.status(200).json(budgets.rows);
  } catch (error) {
    console.error('Get Budgets Error:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
};

export const getBudgetById = async (req, res) => {
  const { id } = req.params;
  try {
    const budget = await pool.query(
      `SELECT b.*, c.name as category_name 
       FROM budgets b
       LEFT JOIN categories c ON b.category_id = c.id
       WHERE b.id = $1 AND b.user_id = $2`,
      [id, req.user.id]
    );

    if (budget.rows.length === 0) {
      return res.status(404).json({ error: 'Budget not found.' });
    }

    return res.status(200).json(budget.rows[0]);
  } catch (error) {
    console.error('Get Budget By ID Error:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
};

export const createBudget = async (req, res) => {
  const { category_id, limit_amount, month, year } = req.body;

  if (!category_id || limit_amount === undefined || !month || !year) {
    return res.status(400).json({ error: 'Category id, limit amount, month, and year are required.' });
  }

  try {
    // Check if category exists
    const catCheck = await pool.query('SELECT * FROM categories WHERE id = $1 AND user_id = $2', [category_id, req.user.id]);
    if (catCheck.rows.length === 0) {
      return res.status(400).json({ error: 'Invalid category or category does not belong to user.' });
    }

    const newBudget = await pool.query(
      `INSERT INTO budgets (user_id, category_id, limit_amount, month, year) 
       VALUES ($1, $2, $3, $4, $5) 
       ON CONFLICT (user_id, category_id, month, year) 
       DO UPDATE SET limit_amount = EXCLUDED.limit_amount
       RETURNING *`,
      [req.user.id, category_id, limit_amount, month, year]
    );
    return res.status(201).json(newBudget.rows[0]);
  } catch (error) {
    console.error('Create Budget Error:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
};

export const updateBudget = async (req, res) => {
  const { id } = req.params;
  const { category_id, limit_amount, month, year } = req.body;

  if (!category_id || limit_amount === undefined || !month || !year) {
    return res.status(400).json({ error: 'Category id, limit amount, month, and year are required.' });
  }

  try {
    // Check if category exists
    const catCheck = await pool.query('SELECT * FROM categories WHERE id = $1 AND user_id = $2', [category_id, req.user.id]);
    if (catCheck.rows.length === 0) {
      return res.status(400).json({ error: 'Invalid category or category does not belong to user.' });
    }

    const updated = await pool.query(
      `UPDATE budgets 
       SET category_id = $1, limit_amount = $2, month = $3, year = $4 
       WHERE id = $5 AND user_id = $6 RETURNING *`,
      [category_id, limit_amount, month, year, id, req.user.id]
    );

    if (updated.rows.length === 0) {
      return res.status(404).json({ error: 'Budget not found or access denied.' });
    }

    return res.status(200).json(updated.rows[0]);
  } catch (error) {
    console.error('Update Budget Error:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
};

export const deleteBudget = async (req, res) => {
  const { id } = req.params;
  try {
    const deleted = await pool.query(
      'DELETE FROM budgets WHERE id = $1 AND user_id = $2 RETURNING *',
      [id, req.user.id]
    );

    if (deleted.rows.length === 0) {
      return res.status(404).json({ error: 'Budget not found or access denied.' });
    }

    return res.status(200).json({ message: 'Budget deleted successfully.' });
  } catch (error) {
    console.error('Delete Budget Error:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
};
