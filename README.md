# Mindfase - Personal Finance App

Aplikasi personal finance dengan stack `React + Vite` (frontend) dan `Express + PostgreSQL` (backend), termasuk fitur AI Advisor.

## Struktur

- `frontend/` - React app
- `backend/` - REST API + PostgreSQL

## Backend Environment

Buat file `backend/.env` dari `backend/.env.example` lalu isi nilai yang sesuai:

```env
PORT=5000
DATABASE_URL=postgres://postgres:postgres@localhost:5432/personal_finance
JWT_SECRET=replace-with-strong-secret
CORS_ORIGIN=http://localhost:5173,http://127.0.0.1:5173

AI_PROVIDER=groq
GROQ_API_KEY=replace-with-your-groq-api-key
GROQ_MODEL=llama-3.1-8b-instant
GROQ_API_BASE_URL=https://api.groq.com/openai/v1
```

## Menjalankan Project

### 1. Backend

```bash
cd backend
npm install
npm run dev
```

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

## AI Advisor

Endpoint chatbot:

- `POST /api/chatbot`
- `GET /api/chatbot/history`
- `DELETE /api/chatbot/history`

Jika `AI_PROVIDER=groq`, backend akan memanggil Groq API (`/chat/completions`) dengan konteks ringkasan finansial user dan riwayat chat.
