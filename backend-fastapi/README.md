# FastAPI Backend

Backend alternatif berbasis FastAPI yang kompatibel dengan frontend saat ini.
Versi ini juga sudah menambahkan analisis pola pengeluaran dan evaluasi model sederhana dari data transaksi user.

## Jalankan

```bash
cd backend-fastapi
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --reload --host 0.0.0.0 --port 5000
```

## Catatan

- Endpoint base tetap di `/api`, jadi frontend tidak perlu diubah.
- Gunakan database PostgreSQL yang sama seperti backend lama.
- Endpoint yang sudah disiapkan: `auth`, `categories`, `transactions`, `bills`, `budgets`, `settings`, `reports`.
- Endpoint report baru:
  - `GET /api/reports/monthly`
  - `GET /api/reports/category`
  - `GET /api/reports/expense-pattern`
  - `GET /api/reports/financial-health-model`
- Endpoint `dashboard` dan `chatbot` belum dipindahkan penuh.
- Endpoint `POST /api/auth/google` masih `501 Not Implemented`.
- Dataset referensi di `dataset/Personal_Finance_Dataset.csv` bisa ikut dipakai untuk training model.
- Default `TRAINING_MODE=notebook_exact`, jadi endpoint model akan mengikuti pipeline notebook referensi.

## Catatan akurasi model

- Jika `TRAINING_MODE=notebook_exact`, model memakai **dataset notebook yang sama** dan pipeline yang sama agar hasilnya tetap selaras dengan notebook.
- Dalam mode itu, backend **tidak mencampur** data database user ke endpoint `financial-health-model`.
- Jika nanti mode diganti dari `notebook_exact`, barulah metrik bisa berubah karena sumber data training ikut berubah.
- Metrik yang dikembalikan endpoint `financial-health-model` adalah:
  - `test_results`
  - `cv_results`
  - `tuned_gradient_boosting`
  - `notebook_reference_metrics`

## File penting

- `backend-fastapi/app/routers/reports.py` berisi endpoint analisis/laporan.
- `backend-fastapi/app/services/expense_analysis.py` berisi logika analisis dan training model.
- Komentar penjelasan di dalam kode ditulis dalam Bahasa Indonesia agar lebih mudah dipahami.
- Path dataset bisa diatur lewat `DATASET_CSV_PATH` pada `.env`.
