import pool from '../config/db.js';

export const getDashboardSummary = async (req, res) => {
  const userId = req.user.id;
  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();

  try {
    // Total income bulan ini
    const incomeQuery = await pool.query(
      `SELECT COALESCE(SUM(amount), 0) as total 
       FROM transactions 
       WHERE user_id = $1 AND type = 'income' 
       AND EXTRACT(MONTH FROM transaction_date) = $2 
       AND EXTRACT(YEAR FROM transaction_date) = $3`,
      [userId, currentMonth, currentYear]
    );

    // Total expense bulan ini
    const expenseQuery = await pool.query(
      `SELECT COALESCE(SUM(amount), 0) as total 
       FROM transactions 
       WHERE user_id = $1 AND type = 'expense' 
       AND EXTRACT(MONTH FROM transaction_date) = $2 
       AND EXTRACT(YEAR FROM transaction_date) = $3`,
      [userId, currentMonth, currentYear]
    );

    // Total income & expense overall for total balance
    const overallIncome = await pool.query(
      `SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE user_id = $1 AND type = 'income'`,
      [userId]
    );
    const overallExpense = await pool.query(
      `SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE user_id = $1 AND type = 'expense'`,
      [userId]
    );

    const totalIncomeThisMonth = parseFloat(incomeQuery.rows[0].total);
    const totalExpenseThisMonth = parseFloat(expenseQuery.rows[0].total);
    const totalIncomeOverall = parseFloat(overallIncome.rows[0].total);
    const totalExpenseOverall = parseFloat(overallExpense.rows[0].total);
    const balance = totalIncomeOverall - totalExpenseOverall;

    // Jumlah bills unpaid
    const unpaidBillsQuery = await pool.query(
      `SELECT COUNT(*) as count, COALESCE(SUM(amount), 0) as total 
       FROM bills 
       WHERE user_id = $1 AND status = 'unpaid'`,
      [userId]
    );
    const unpaidBillsCount = parseInt(unpaidBillsQuery.rows[0].count);
    const unpaidBillsAmount = parseFloat(unpaidBillsQuery.rows[0].total);

    // Total budget bulan ini
    const budgetQuery = await pool.query(
      `SELECT COALESCE(SUM(limit_amount), 0) as total 
       FROM budgets 
       WHERE user_id = $1 AND month = $2 AND year = $3`,
      [userId, currentMonth, currentYear]
    );
    const totalBudgetThisMonth = parseFloat(budgetQuery.rows[0].total);

    return res.status(200).json({
      summary: {
        totalIncomeThisMonth,
        totalExpenseThisMonth,
        balance,
        unpaidBills: {
          count: unpaidBillsCount,
          amount: unpaidBillsAmount
        },
        totalBudgetThisMonth,
        expenseComparedToBudget: totalBudgetThisMonth > 0 ? (totalExpenseThisMonth / totalBudgetThisMonth) * 100 : 0
      }
    });
  } catch (error) {
    console.error('Get Dashboard Summary Error:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
};
