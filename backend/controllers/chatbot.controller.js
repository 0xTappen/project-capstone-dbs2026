import pool from '../config/db.js';

let chatStorageReady = false;

function formatCurrency(value) {
  const amount = Number(value) || 0;
  return `Rp ${amount.toLocaleString('id-ID')}`;
}

function formatDate(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function buildSessionTitle(message) {
  const normalized = String(message || '').trim().replace(/\s+/g, ' ');
  if (!normalized) return 'Chat Baru';
  return normalized.length > 60 ? `${normalized.slice(0, 57)}...` : normalized;
}

async function ensureChatStorage() {
  if (chatStorageReady) {
    return;
  }

  await pool.query(
    `CREATE TABLE IF NOT EXISTS chat_sessions (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      title VARCHAR(255) NOT NULL DEFAULT 'Chat Baru',
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    )`
  );

  await pool.query(
    `ALTER TABLE chat_history
     ADD COLUMN IF NOT EXISTS session_id INTEGER REFERENCES chat_sessions(id) ON DELETE CASCADE`
  );

  await pool.query(
    'CREATE INDEX IF NOT EXISTS idx_chat_sessions_user_updated ON chat_sessions(user_id, updated_at DESC, id DESC)'
  );

  await pool.query(
    'CREATE INDEX IF NOT EXISTS idx_chat_history_session_created ON chat_history(session_id, created_at ASC, id ASC)'
  );

  chatStorageReady = true;
}

async function getFinancialSummary(userId) {
  const [totalsResult, unpaidBillsResult, monthlyBudgetResult, monthlyFlowResult, recentTransactionsResult] = await Promise.all([
    pool.query(
      `SELECT
         COALESCE(SUM(CASE WHEN LOWER(type) IN ('income', 'pemasukan', 'masuk') THEN amount ELSE 0 END), 0) AS total_income,
         COALESCE(SUM(CASE WHEN LOWER(type) IN ('expense', 'pengeluaran', 'keluar') THEN amount ELSE 0 END), 0) AS total_expense
       FROM transactions
       WHERE user_id = $1`,
      [userId]
    ),
    pool.query(
      `SELECT
         COALESCE(SUM(amount), 0) AS unpaid_amount,
         COUNT(*) AS unpaid_count
       FROM bills
       WHERE user_id = $1 AND status = 'unpaid'`,
      [userId]
    ),
    pool.query(
      `SELECT
         COALESCE(SUM(limit_amount), 0) AS monthly_budget
       FROM budgets
       WHERE user_id = $1
         AND month = EXTRACT(MONTH FROM CURRENT_DATE)
         AND year = EXTRACT(YEAR FROM CURRENT_DATE)`,
      [userId]
    ),
    pool.query(
      `SELECT
         COALESCE(SUM(CASE WHEN LOWER(type) IN ('income', 'pemasukan', 'masuk') THEN amount ELSE 0 END), 0) AS monthly_income,
         COALESCE(SUM(CASE WHEN LOWER(type) IN ('expense', 'pengeluaran', 'keluar') THEN amount ELSE 0 END), 0) AS monthly_expense
       FROM transactions
       WHERE user_id = $1
         AND EXTRACT(MONTH FROM transaction_date) = EXTRACT(MONTH FROM CURRENT_DATE)
         AND EXTRACT(YEAR FROM transaction_date) = EXTRACT(YEAR FROM CURRENT_DATE)`,
      [userId]
    ),
    pool.query(
      `SELECT
         t.transaction_date,
         t.description,
         t.amount,
         CASE
           WHEN LOWER(t.type) IN ('income', 'pemasukan', 'masuk') THEN 'income'
           WHEN LOWER(t.type) IN ('expense', 'pengeluaran', 'keluar') THEN 'expense'
           ELSE LOWER(t.type)
         END AS type,
         COALESCE(c.name, 'Tanpa Kategori') AS category_name
       FROM transactions t
       LEFT JOIN categories c ON c.id = t.category_id
       WHERE t.user_id = $1
       ORDER BY t.transaction_date DESC, t.id DESC
       LIMIT 5`,
      [userId]
    ),
  ]);

  const totalIncome = Number(totalsResult.rows[0]?.total_income) || 0;
  const totalExpense = Number(totalsResult.rows[0]?.total_expense) || 0;
  const unpaidAmount = Number(unpaidBillsResult.rows[0]?.unpaid_amount) || 0;
  const unpaidCount = Number(unpaidBillsResult.rows[0]?.unpaid_count) || 0;
  const monthlyBudget = Number(monthlyBudgetResult.rows[0]?.monthly_budget) || 0;
  const monthlyIncome = Number(monthlyFlowResult.rows[0]?.monthly_income) || 0;
  const monthlyExpense = Number(monthlyFlowResult.rows[0]?.monthly_expense) || 0;

  return {
    totalIncome,
    totalExpense,
    balance: totalIncome - totalExpense,
    monthlyIncome,
    monthlyExpense,
    monthlyBalance: monthlyIncome - monthlyExpense,
    unpaidAmount,
    unpaidCount,
    monthlyBudget,
    recentTransactions: recentTransactionsResult.rows,
  };
}

async function getRecentMessages(userId, sessionId) {
  const result = await pool.query(
    `SELECT role, message
     FROM chat_history
     WHERE user_id = $1 AND session_id = $2
     ORDER BY created_at DESC, id DESC
     LIMIT 12`,
    [userId, sessionId]
  );

  return result.rows.reverse();
}

async function getSessionById(userId, sessionId) {
  const result = await pool.query(
    `SELECT id, user_id, title, created_at, updated_at
     FROM chat_sessions
     WHERE user_id = $1 AND id = $2`,
    [userId, sessionId]
  );

  return result.rows[0] || null;
}

async function getOrCreateLatestSession(userId) {
  const latestSession = await pool.query(
    `SELECT id, user_id, title, created_at, updated_at
     FROM chat_sessions
     WHERE user_id = $1
     ORDER BY updated_at DESC, id DESC
     LIMIT 1`,
    [userId]
  );

  if (latestSession.rows.length > 0) {
    return latestSession.rows[0];
  }

  const createdSession = await pool.query(
    `INSERT INTO chat_sessions (user_id, title)
     VALUES ($1, 'Chat Baru')
     RETURNING id, user_id, title, created_at, updated_at`,
    [userId]
  );

  return createdSession.rows[0];
}

async function touchSession(userId, sessionId, messageForTitle) {
  const title = buildSessionTitle(messageForTitle);

  await pool.query(
    `UPDATE chat_sessions
     SET
       updated_at = CURRENT_TIMESTAMP,
       title = CASE WHEN title = 'Chat Baru' THEN $1 ELSE title END
     WHERE user_id = $2 AND id = $3`,
    [title, userId, sessionId]
  );
}

function buildFallbackReply(message, summary) {
  const lowerInput = message.toLowerCase();
  const {
    totalIncome,
    totalExpense,
    balance,
    monthlyIncome,
    monthlyExpense,
    monthlyBalance,
    unpaidAmount,
    unpaidCount,
    monthlyBudget,
  } = summary;

  if (lowerInput.includes('ringkasan') || lowerInput.includes('keuangan') || lowerInput.includes('saldo') || lowerInput.includes('uang') || lowerInput.includes('duit')) {
    return [
      'Berikut ringkasan keuangan Anda:',
      `- Saldo Bersih Saat Ini: ${formatCurrency(balance)}`,
      `- Total Pemasukan (Semua Waktu): ${formatCurrency(totalIncome)}`,
      `- Total Pengeluaran (Semua Waktu): ${formatCurrency(totalExpense)}`,
      `- Arus Kas Bulan Ini: +${formatCurrency(monthlyIncome)} / -${formatCurrency(monthlyExpense)} (Net: ${formatCurrency(monthlyBalance)})`,
      `- Tagihan Belum Lunas: ${unpaidCount} item (${formatCurrency(unpaidAmount)})`,
      `- Budget Bulan Ini: ${formatCurrency(monthlyBudget)}`,
    ].join('\n');
  }

  if (lowerInput.includes('boros') || lowerInput.includes('hemat') || lowerInput.includes('tips')) {
    return 'Tips cepat: gunakan rasio 50/30/20, pisahkan rekening kebutuhan vs tabungan, dan review pengeluaran mingguan di menu Reports.';
  }

  if (lowerInput.includes('target') || lowerInput.includes('estimasi') || lowerInput.includes('waktu')) {
    return 'Untuk estimasi target tabungan, kirim format: "target 10000000, nabung 1500000 per bulan". Saya bantu hitung waktunya.';
  }

  if (lowerInput.includes('halo') || lowerInput.includes('hai')) {
    return 'Halo! Saya siap bantu analisis keuangan Anda. Anda bisa minta ringkasan, tips hemat, atau estimasi target tabungan.';
  }

  return 'Saya siap bantu soal budgeting, arus kas, dan target tabungan. Coba tanya: "ringkasan keuangan saya bulan ini".';
}

async function generateGroqReply({ userId, sessionId, message }) {
  const apiKey = process.env.GROQ_API_KEY;
  const model = process.env.GROQ_MODEL || 'llama-3.1-8b-instant';
  const baseUrl = process.env.GROQ_API_BASE_URL || 'https://api.groq.com/openai/v1';

  if (!apiKey) {
    throw new Error('GROQ_API_KEY is missing.');
  }

  const [summary, history] = await Promise.all([
    getFinancialSummary(userId),
    getRecentMessages(userId, sessionId),
  ]);

  const recentTransactionsText = summary.recentTransactions.length === 0
    ? '- Tidak ada transaksi terbaru.'
    : summary.recentTransactions
      .map((item) => {
        const sign = item.type === 'income' ? '+' : '-';
        return `- ${formatDate(item.transaction_date)} | ${item.category_name} | ${sign}${formatCurrency(item.amount)} | ${item.description || 'Tanpa deskripsi'}`;
      })
      .join('\n');

  const systemPrompt = [
    'Kamu adalah AI Financial Advisor untuk aplikasi personal finance.',
    'Jawab dalam Bahasa Indonesia yang ringkas, praktis, dan actionable.',
    'Gunakan konteks finansial user berikut saat relevan. Ini data REAL akun user saat ini:',
    `- Saldo bersih saat ini: ${formatCurrency(summary.balance)}`,
    `- Total pemasukan semua waktu: ${formatCurrency(summary.totalIncome)}`,
    `- Total pengeluaran semua waktu: ${formatCurrency(summary.totalExpense)}`,
    `- Pemasukan bulan ini: ${formatCurrency(summary.monthlyIncome)}`,
    `- Pengeluaran bulan ini: ${formatCurrency(summary.monthlyExpense)}`,
    `- Net bulan ini: ${formatCurrency(summary.monthlyBalance)}`,
    `- Tagihan belum lunas: ${summary.unpaidCount} item (${formatCurrency(summary.unpaidAmount)})`,
    `- Budget bulan ini: ${formatCurrency(summary.monthlyBudget)}`,
    '- 5 transaksi terbaru:',
    recentTransactionsText,
    'Kalau user menanyakan uang/saldo, prioritaskan angka saldo bersih saat ini.',
    'Jangan mengklaim data di luar konteks ini. Jika data kurang, minta klarifikasi.',
    'Berikan peringatan singkat bahwa saran bersifat edukasi, bukan nasihat finansial profesional.',
  ].join('\n');

  const messages = [
    { role: 'system', content: systemPrompt },
    ...history
      .filter((item) => item.role === 'user' || item.role === 'assistant')
      .map((item) => ({ role: item.role, content: item.message })),
  ];

  if (messages[messages.length - 1]?.role !== 'user') {
    messages.push({ role: 'user', content: message });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);

  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: 0.4,
        max_tokens: 500,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Groq API error ${response.status}: ${errorBody}`);
    }

    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content;
    if (!content || typeof content !== 'string') {
      throw new Error('Groq API returned empty content.');
    }

    return content.trim();
  } finally {
    clearTimeout(timeout);
  }
}

export const listSessions = async (req, res) => {
  const userId = req.user.id;

  try {
    await ensureChatStorage();

    const sessions = await pool.query(
      `SELECT
         s.id,
         s.title,
         s.created_at,
         s.updated_at,
         COALESCE(last_msg.message, '') AS last_message
       FROM chat_sessions s
       LEFT JOIN LATERAL (
         SELECT message
         FROM chat_history h
         WHERE h.session_id = s.id
         ORDER BY h.created_at DESC, h.id DESC
         LIMIT 1
       ) last_msg ON true
       WHERE s.user_id = $1
       ORDER BY s.updated_at DESC, s.id DESC`,
      [userId]
    );

    return res.status(200).json(sessions.rows);
  } catch (error) {
    console.error('List Sessions Error:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
};

export const createSession = async (req, res) => {
  const userId = req.user.id;
  const customTitle = String(req.body?.title || '').trim();
  const title = customTitle || 'Chat Baru';

  try {
    await ensureChatStorage();

    const created = await pool.query(
      `INSERT INTO chat_sessions (user_id, title)
       VALUES ($1, $2)
       RETURNING id, title, created_at, updated_at`,
      [userId, title]
    );

    return res.status(201).json(created.rows[0]);
  } catch (error) {
    console.error('Create Session Error:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
};

export const updateSessionTitle = async (req, res) => {
  const userId = req.user.id;
  const sessionId = Number(req.params.sessionId);
  const title = String(req.body?.title || '').trim();

  if (!Number.isInteger(sessionId) || sessionId <= 0) {
    return res.status(400).json({ error: 'Invalid session id.' });
  }

  if (!title) {
    return res.status(400).json({ error: 'Title is required.' });
  }

  try {
    await ensureChatStorage();

    const updated = await pool.query(
      `UPDATE chat_sessions
       SET title = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2 AND user_id = $3
       RETURNING id, title, created_at, updated_at`,
      [title, sessionId, userId]
    );

    if (updated.rows.length === 0) {
      return res.status(404).json({ error: 'Session not found.' });
    }

    return res.status(200).json(updated.rows[0]);
  } catch (error) {
    console.error('Update Session Title Error:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
};

export const deleteSession = async (req, res) => {
  const userId = req.user.id;
  const sessionId = Number(req.params.sessionId);

  if (!Number.isInteger(sessionId) || sessionId <= 0) {
    return res.status(400).json({ error: 'Invalid session id.' });
  }

  try {
    await ensureChatStorage();

    const deleted = await pool.query(
      'DELETE FROM chat_sessions WHERE id = $1 AND user_id = $2 RETURNING id',
      [sessionId, userId]
    );

    if (deleted.rows.length === 0) {
      return res.status(404).json({ error: 'Session not found.' });
    }

    return res.status(200).json({ message: 'Session deleted successfully.' });
  } catch (error) {
    console.error('Delete Session Error:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
};

export const chat = async (req, res) => {
  const userId = req.user.id;
  const normalizedMessage = String(req.body?.message || '').trim();
  const requestedSessionId = req.body?.session_id;

  if (!normalizedMessage) {
    return res.status(400).json({ error: 'Message is required.' });
  }

  try {
    await ensureChatStorage();

    let session;
    if (requestedSessionId !== undefined && requestedSessionId !== null) {
      const sessionId = Number(requestedSessionId);
      if (!Number.isInteger(sessionId) || sessionId <= 0) {
        return res.status(400).json({ error: 'Invalid session id.' });
      }

      session = await getSessionById(userId, sessionId);
      if (!session) {
        return res.status(404).json({ error: 'Session not found.' });
      }
    } else {
      session = await getOrCreateLatestSession(userId);
    }

    await pool.query(
      `INSERT INTO chat_history (user_id, session_id, role, message)
       VALUES ($1, $2, $3, $4)`,
      [userId, session.id, 'user', normalizedMessage]
    );

    const provider = (process.env.AI_PROVIDER || '').toLowerCase();
    let reply;

    try {
      if (provider === 'groq') {
        reply = await generateGroqReply({ userId, sessionId: session.id, message: normalizedMessage });
      } else {
        const summary = await getFinancialSummary(userId);
        reply = buildFallbackReply(normalizedMessage, summary);
      }
    } catch (aiError) {
      console.error('AI Provider Error:', aiError);
      const summary = await getFinancialSummary(userId);
      reply = buildFallbackReply(normalizedMessage, summary);
    }

    await pool.query(
      `INSERT INTO chat_history (user_id, session_id, role, message)
       VALUES ($1, $2, $3, $4)`,
      [userId, session.id, 'assistant', reply]
    );

    await touchSession(userId, session.id, normalizedMessage);

    return res.status(200).json({
      reply,
      session_id: session.id,
    });
  } catch (error) {
    console.error('Chatbot Error:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
};

export const getHistory = async (req, res) => {
  const userId = req.user.id;
  const requestedSessionId = req.query.session_id;

  try {
    await ensureChatStorage();

    let session;
    if (requestedSessionId !== undefined) {
      const sessionId = Number(requestedSessionId);
      if (!Number.isInteger(sessionId) || sessionId <= 0) {
        return res.status(400).json({ error: 'Invalid session id.' });
      }

      session = await getSessionById(userId, sessionId);
      if (!session) {
        return res.status(404).json({ error: 'Session not found.' });
      }
    } else {
      session = await getOrCreateLatestSession(userId);
    }

    const history = await pool.query(
      `SELECT id, session_id, role, message, created_at
       FROM chat_history
       WHERE user_id = $1 AND session_id = $2
       ORDER BY created_at ASC, id ASC`,
      [userId, session.id]
    );

    return res.status(200).json({
      session,
      messages: history.rows,
    });
  } catch (error) {
    console.error('Get Chatbot History Error:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
};

export const clearHistory = async (req, res) => {
  const userId = req.user.id;
  const requestedSessionId = req.query.session_id;

  try {
    await ensureChatStorage();

    if (requestedSessionId !== undefined) {
      const sessionId = Number(requestedSessionId);
      if (!Number.isInteger(sessionId) || sessionId <= 0) {
        return res.status(400).json({ error: 'Invalid session id.' });
      }

      const session = await getSessionById(userId, sessionId);
      if (!session) {
        return res.status(404).json({ error: 'Session not found.' });
      }

      await pool.query('DELETE FROM chat_history WHERE user_id = $1 AND session_id = $2', [userId, sessionId]);
      await pool.query('UPDATE chat_sessions SET updated_at = CURRENT_TIMESTAMP WHERE id = $1 AND user_id = $2', [sessionId, userId]);

      return res.status(200).json({ message: 'Chat history for selected session cleared successfully.' });
    }

    await pool.query('DELETE FROM chat_history WHERE user_id = $1', [userId]);
    await pool.query('UPDATE chat_sessions SET updated_at = CURRENT_TIMESTAMP WHERE user_id = $1', [userId]);

    return res.status(200).json({ message: 'Chat history cleared successfully.' });
  } catch (error) {
    console.error('Clear Chatbot History Error:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
};
