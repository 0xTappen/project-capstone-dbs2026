import pool from '../config/db.js';

let billPaymentColumnReady = false;

async function ensureBillPaymentColumn() {
  if (billPaymentColumnReady) {
    return;
  }

  await pool.query(
    `ALTER TABLE bills
     ADD COLUMN IF NOT EXISTS paid_transaction_id INTEGER REFERENCES transactions(id) ON DELETE SET NULL`
  );

  billPaymentColumnReady = true;
}

async function findOrCreateBillCategory(client, userId) {
  const existing = await client.query(
    `SELECT id
     FROM categories
     WHERE user_id = $1 AND type = 'expense' AND LOWER(name) = 'tagihan'
     LIMIT 1`,
    [userId]
  );

  if (existing.rows.length > 0) {
    return existing.rows[0].id;
  }

  const created = await client.query(
    `INSERT INTO categories (user_id, name, type)
     VALUES ($1, 'Tagihan', 'expense')
     RETURNING id`,
    [userId]
  );

  return created.rows[0].id;
}

async function createBillPaymentTransaction(client, bill, userId) {
  const billCategoryId = await findOrCreateBillCategory(client, userId);

  const inserted = await client.query(
    `INSERT INTO transactions (user_id, category_id, type, amount, description, transaction_date)
     VALUES ($1, $2, 'expense', $3, $4, CURRENT_DATE)
     RETURNING id`,
    [
      userId,
      billCategoryId,
      bill.amount,
      `Pembayaran tagihan: ${bill.title}`,
    ]
  );

  return inserted.rows[0].id;
}

async function deleteLinkedPaymentTransaction(client, userId, transactionId) {
  if (!transactionId) {
    return;
  }

  await client.query(
    'DELETE FROM transactions WHERE id = $1 AND user_id = $2',
    [transactionId, userId]
  );
}

async function syncPaymentTransactionWhenBillPaid(client, userId, title, amount, paidTransactionId) {
  if (!paidTransactionId) {
    const newPaymentId = await createBillPaymentTransaction(client, { title, amount }, userId);
    return newPaymentId;
  }

  const updatedTransaction = await client.query(
    `UPDATE transactions
     SET amount = $1,
         description = $2
     WHERE id = $3 AND user_id = $4`,
    [amount, `Pembayaran tagihan: ${title}`, paidTransactionId, userId]
  );

  if (updatedTransaction.rowCount === 0) {
    const newPaymentId = await createBillPaymentTransaction(client, { title, amount }, userId);
    return newPaymentId;
  }

  return paidTransactionId;
}

export const getBills = async (req, res) => {
  try {
    await ensureBillPaymentColumn();

    const bills = await pool.query(
      'SELECT * FROM bills WHERE user_id = $1 ORDER BY due_date ASC',
      [req.user.id]
    );
    return res.status(200).json(bills.rows);
  } catch (error) {
    console.error('Get Bills Error:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
};

export const getBillById = async (req, res) => {
  const { id } = req.params;
  try {
    await ensureBillPaymentColumn();

    const bill = await pool.query(
      'SELECT * FROM bills WHERE id = $1 AND user_id = $2',
      [id, req.user.id]
    );

    if (bill.rows.length === 0) {
      return res.status(404).json({ error: 'Bill not found.' });
    }

    return res.status(200).json(bill.rows[0]);
  } catch (error) {
    console.error('Get Bill By ID Error:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
};

export const createBill = async (req, res) => {
  const { title, amount, due_date, status } = req.body;

  if (!title || amount === undefined || !due_date) {
    return res.status(400).json({ error: 'Title, amount, and due date are required.' });
  }

  const normalizedStatus = status === 'paid' ? 'paid' : 'unpaid';
  const client = await pool.connect();

  try {
    await ensureBillPaymentColumn();
    await client.query('BEGIN');

    let paidTransactionId = null;
    if (normalizedStatus === 'paid') {
      paidTransactionId = await createBillPaymentTransaction(client, { title, amount }, req.user.id);
    }

    const newBill = await client.query(
      `INSERT INTO bills (user_id, title, amount, due_date, status, paid_transaction_id)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [req.user.id, title, amount, due_date, normalizedStatus, paidTransactionId]
    );

    await client.query('COMMIT');
    return res.status(201).json(newBill.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Create Bill Error:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  } finally {
    client.release();
  }
};

export const updateBill = async (req, res) => {
  const { id } = req.params;
  const { title, amount, due_date, status } = req.body;

  if (!title || amount === undefined || !due_date) {
    return res.status(400).json({ error: 'Title, amount, and due date are required.' });
  }

  const nextStatus = status === 'paid' ? 'paid' : 'unpaid';
  const client = await pool.connect();

  try {
    await ensureBillPaymentColumn();
    await client.query('BEGIN');

    const currentBillResult = await client.query(
      'SELECT * FROM bills WHERE id = $1 AND user_id = $2 FOR UPDATE',
      [id, req.user.id]
    );

    if (currentBillResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Bill not found or access denied.' });
    }

    const currentBill = currentBillResult.rows[0];
    let paidTransactionId = currentBill.paid_transaction_id;

    if (nextStatus === 'unpaid') {
      await deleteLinkedPaymentTransaction(client, req.user.id, paidTransactionId);
      paidTransactionId = null;
    } else {
      paidTransactionId = await syncPaymentTransactionWhenBillPaid(
        client,
        req.user.id,
        title,
        amount,
        paidTransactionId
      );
    }

    const updated = await client.query(
      `UPDATE bills
       SET title = $1,
           amount = $2,
           due_date = $3,
           status = $4,
           paid_transaction_id = $5
       WHERE id = $6 AND user_id = $7
       RETURNING *`,
      [title, amount, due_date, nextStatus, paidTransactionId, id, req.user.id]
    );

    await client.query('COMMIT');
    return res.status(200).json(updated.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Update Bill Error:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  } finally {
    client.release();
  }
};

export const deleteBill = async (req, res) => {
  const { id } = req.params;
  const client = await pool.connect();

  try {
    await ensureBillPaymentColumn();
    await client.query('BEGIN');

    const billResult = await client.query(
      'SELECT * FROM bills WHERE id = $1 AND user_id = $2 FOR UPDATE',
      [id, req.user.id]
    );

    if (billResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Bill not found or access denied.' });
    }

    const bill = billResult.rows[0];
    await deleteLinkedPaymentTransaction(client, req.user.id, bill.paid_transaction_id);

    await client.query(
      'DELETE FROM bills WHERE id = $1 AND user_id = $2',
      [id, req.user.id]
    );

    await client.query('COMMIT');
    return res.status(200).json({ message: 'Bill deleted successfully.' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Delete Bill Error:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  } finally {
    client.release();
  }
};

export const payBill = async (req, res) => {
  const { id } = req.params;
  const client = await pool.connect();

  try {
    await ensureBillPaymentColumn();
    await client.query('BEGIN');

    const billResult = await client.query(
      'SELECT * FROM bills WHERE id = $1 AND user_id = $2 FOR UPDATE',
      [id, req.user.id]
    );

    if (billResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Bill not found or access denied.' });
    }

    const bill = billResult.rows[0];
    const paymentTransactionId = await syncPaymentTransactionWhenBillPaid(
      client,
      req.user.id,
      bill.title,
      bill.amount,
      bill.paid_transaction_id
    );

    const updated = await client.query(
      `UPDATE bills
       SET status = 'paid',
           paid_transaction_id = $1
       WHERE id = $2 AND user_id = $3
       RETURNING *`,
      [paymentTransactionId, id, req.user.id]
    );

    await client.query('COMMIT');
    return res.status(200).json(updated.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Pay Bill Error:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  } finally {
    client.release();
  }
};
