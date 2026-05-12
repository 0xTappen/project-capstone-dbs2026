import pool from '../config/db.js';

function normalizeTransactionType(type) {
  const normalized = String(type || '').toLowerCase();
  if (['income', 'pemasukan', 'masuk'].includes(normalized)) {
    return 'income';
  }
  if (['expense', 'pengeluaran', 'keluar'].includes(normalized)) {
    return 'expense';
  }
  return normalized;
}

function normalizeTransactionDate(value) {
  if (!value) {
    return null;
  }

  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return date.toISOString().slice(0, 10);
}

export const getTransactions = async (req, res) => {
  try {
    const transactions = await pool.query(
      `SELECT 
         t.id,
         t.user_id,
         t.category_id,
         CASE
           WHEN LOWER(t.type) IN ('income', 'pemasukan', 'masuk') THEN 'income'
           WHEN LOWER(t.type) IN ('expense', 'pengeluaran', 'keluar') THEN 'expense'
           ELSE LOWER(t.type)
         END AS type,
         t.amount,
         t.description,
         t.transaction_date::date AS transaction_date,
         t.created_at,
         c.name as category_name 
       FROM transactions t 
       LEFT JOIN categories c ON t.category_id = c.id 
       WHERE t.user_id = $1 
       ORDER BY t.transaction_date DESC, t.id DESC`,
      [req.user.id]
    );
    return res.status(200).json(transactions.rows);
  } catch (error) {
    console.error('Get Transactions Error:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
};

export const getTransactionById = async (req, res) => {
  const { id } = req.params;
  try {
    const transaction = await pool.query(
      `SELECT
         t.id,
         t.user_id,
         t.category_id,
         CASE
           WHEN LOWER(t.type) IN ('income', 'pemasukan', 'masuk') THEN 'income'
           WHEN LOWER(t.type) IN ('expense', 'pengeluaran', 'keluar') THEN 'expense'
           ELSE LOWER(t.type)
         END AS type,
         t.amount,
         t.description,
         t.transaction_date::date AS transaction_date,
         t.created_at,
         c.name as category_name 
       FROM transactions t 
       LEFT JOIN categories c ON t.category_id = c.id 
       WHERE t.id = $1 AND t.user_id = $2`,
      [id, req.user.id]
    );

    if (transaction.rows.length === 0) {
      return res.status(404).json({ error: 'Transaction not found.' });
    }

    return res.status(200).json(transaction.rows[0]);
  } catch (error) {
    console.error('Get Transaction By ID Error:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
};

export const createTransaction = async (req, res) => {
  const { category_id, type, amount, description, transaction_date } = req.body;

  if (!type || amount === undefined) {
    return res.status(400).json({ error: 'Type and amount are required.' });
  }

  if (!['income', 'expense'].includes(type)) {
    return res.status(400).json({ error: "Type must be either 'income' or 'expense'." });
  }

  try {
    const dateToUse = transaction_date ? transaction_date : new Date().toISOString().split('T')[0];

    const newTransaction = await pool.query(
      `INSERT INTO transactions (user_id, category_id, type, amount, description, transaction_date) 
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [req.user.id, category_id || null, type, amount, description || '', dateToUse]
    );
    const row = newTransaction.rows[0];
    return res.status(201).json({
      ...row,
      type: normalizeTransactionType(row.type),
      transaction_date: normalizeTransactionDate(row.transaction_date),
    });
  } catch (error) {
    console.error('Create Transaction Error:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
};

export const updateTransaction = async (req, res) => {
  const { id } = req.params;
  const { category_id, type, amount, description, transaction_date } = req.body;

  if (!type || amount === undefined) {
    return res.status(400).json({ error: 'Type and amount are required.' });
  }

  if (!['income', 'expense'].includes(type)) {
    return res.status(400).json({ error: "Type must be either 'income' or 'expense'." });
  }

  try {
    const dateToUse = transaction_date ? transaction_date : new Date().toISOString().split('T')[0];

    const updated = await pool.query(
      `UPDATE transactions 
       SET category_id = $1, type = $2, amount = $3, description = $4, transaction_date = $5 
       WHERE id = $6 AND user_id = $7 RETURNING *`,
      [category_id || null, type, amount, description || '', dateToUse, id, req.user.id]
    );

    if (updated.rows.length === 0) {
      return res.status(404).json({ error: 'Transaction not found or access denied.' });
    }

    const row = updated.rows[0];
    return res.status(200).json({
      ...row,
      type: normalizeTransactionType(row.type),
      transaction_date: normalizeTransactionDate(row.transaction_date),
    });
  } catch (error) {
    console.error('Update Transaction Error:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
};

export const deleteTransaction = async (req, res) => {
  const { id } = req.params;
  try {
    const deleted = await pool.query(
      'DELETE FROM transactions WHERE id = $1 AND user_id = $2 RETURNING *',
      [id, req.user.id]
    );

    if (deleted.rows.length === 0) {
      return res.status(404).json({ error: 'Transaction not found or access denied.' });
    }

    return res.status(200).json({ message: 'Transaction deleted successfully.' });
  } catch (error) {
    console.error('Delete Transaction Error:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
};
