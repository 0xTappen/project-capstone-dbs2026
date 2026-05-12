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

export const getMonthlyReport = async (req, res) => {
  const userId = req.user.id;
  const { month, year } = req.query;

  if (!month || !year) {
    return res.status(400).json({ error: 'Month and year are required query parameters.' });
  }

  try {
    const transactions = await pool.query(
      `SELECT id, type, amount, description, transaction_date 
       FROM transactions 
       WHERE user_id = $1 
       AND EXTRACT(MONTH FROM transaction_date) = $2 
       AND EXTRACT(YEAR FROM transaction_date) = $3
       ORDER BY transaction_date ASC`,
      [userId, month, year]
    );

    const normalizedTransactions = transactions.rows.map((row) => ({
      ...row,
      type: normalizeTransactionType(row.type),
    }));

    const income = normalizedTransactions
      .filter((t) => t.type === 'income')
      .reduce((sum, t) => sum + parseFloat(t.amount), 0);
    const expense = normalizedTransactions
      .filter((t) => t.type === 'expense')
      .reduce((sum, t) => sum + parseFloat(t.amount), 0);

    return res.status(200).json({
      month: parseInt(month),
      year: parseInt(year),
      income,
      expense,
      net: income - expense,
      transactions: normalizedTransactions
    });
  } catch (error) {
    console.error('Get Monthly Report Error:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
};

export const getCategoryReport = async (req, res) => {
  const userId = req.user.id;
  const { month, year } = req.query;

  if (!month || !year) {
    return res.status(400).json({ error: 'Month and year are required query parameters.' });
  }

  try {
    const categoryQuery = await pool.query(
      `SELECT c.id as category_id, c.name as category_name, c.type, COALESCE(SUM(t.amount), 0) as total
       FROM categories c
       LEFT JOIN transactions t ON c.id = t.category_id 
         AND EXTRACT(MONTH FROM t.transaction_date) = $2 
         AND EXTRACT(YEAR FROM t.transaction_date) = $3
       WHERE c.user_id = $1
       GROUP BY c.id, c.name, c.type
       ORDER BY total DESC`,
      [userId, month, year]
    );

    return res.status(200).json(categoryQuery.rows);
  } catch (error) {
    console.error('Get Category Report Error:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
};
