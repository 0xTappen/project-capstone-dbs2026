from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import text
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import require_profile_completion
from ..services.expense_analysis import (
    build_expense_pattern_analysis,
    build_transactions_dataframe,
    train_financial_health_model,
)

router = APIRouter()


def _fetch_transaction_rows(db: Session, user_id: int) -> list[dict]:
    # Helper ini mengambil data transaksi yang dibutuhkan oleh seluruh endpoint laporan.
    rows = db.execute(
        text(
            '''
            SELECT
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
                COALESCE(c.name, 'Tanpa Kategori') AS category_name
            FROM transactions t
            LEFT JOIN categories c ON c.id = t.category_id
            WHERE t.user_id = :user_id
            ORDER BY t.transaction_date ASC, t.id ASC
            '''
        ),
        {'user_id': user_id},
    ).mappings().all()
    return [dict(row) for row in rows]


@router.get('/monthly')
def get_monthly_report(
    month: int = Query(..., ge=1, le=12),
    year: int = Query(..., ge=2000),
    current_user=Depends(require_profile_completion),
    db: Session = Depends(get_db),
):
    # Endpoint ini mempertahankan kontrak lama agar frontend tetap kompatibel.
    rows = db.execute(
        text(
            '''
            SELECT id, type, amount, description, transaction_date::date AS transaction_date
            FROM transactions
            WHERE user_id = :user_id
              AND EXTRACT(MONTH FROM transaction_date) = :month
              AND EXTRACT(YEAR FROM transaction_date) = :year
            ORDER BY transaction_date ASC, id ASC
            '''
        ),
        {'user_id': current_user['id'], 'month': month, 'year': year},
    ).mappings().all()

    transactions = [dict(row) for row in rows]
    income = round(sum(float(row['amount']) for row in transactions if row['type'] == 'income'), 2)
    expense = round(sum(float(row['amount']) for row in transactions if row['type'] == 'expense'), 2)

    return {
        'month': month,
        'year': year,
        'income': income,
        'expense': expense,
        'net': round(income - expense, 2),
        'transactions': transactions,
    }


@router.get('/category')
def get_category_report(
    month: int = Query(..., ge=1, le=12),
    year: int = Query(..., ge=2000),
    current_user=Depends(require_profile_completion),
    db: Session = Depends(get_db),
):
    # Laporan kategori dipakai untuk komposisi pengeluaran per kategori di bulan tertentu.
    rows = db.execute(
        text(
            '''
            SELECT
                c.id AS category_id,
                c.name AS category_name,
                c.type,
                COALESCE(SUM(t.amount), 0) AS total
            FROM categories c
            LEFT JOIN transactions t
              ON c.id = t.category_id
             AND EXTRACT(MONTH FROM t.transaction_date) = :month
             AND EXTRACT(YEAR FROM t.transaction_date) = :year
            WHERE c.user_id = :user_id
            GROUP BY c.id, c.name, c.type
            ORDER BY total DESC
            '''
        ),
        {'user_id': current_user['id'], 'month': month, 'year': year},
    ).mappings().all()
    return [dict(row) for row in rows]


@router.get('/expense-pattern')
def get_expense_pattern_report(
    current_user=Depends(require_profile_completion),
    db: Session = Depends(get_db),
):
    # Endpoint baru ini mengubah ide notebook menjadi response JSON yang siap dipakai frontend.
    frame = build_transactions_dataframe(_fetch_transaction_rows(db, current_user['id']))
    return build_expense_pattern_analysis(frame)


@router.get('/financial-health-model')
def get_financial_health_model_metrics(
    current_user=Depends(require_profile_completion),
    db: Session = Depends(get_db),
):
    # Endpoint ini melatih model dari data real user, lalu mengembalikan metrik training-nya.
    frame = build_transactions_dataframe(_fetch_transaction_rows(db, current_user['id']))
    result = train_financial_health_model(frame)

    if result.status == 'ok':
        return {
            'status': result.status,
            'message': result.message,
            'sample_size': result.sample_size,
            'data_sources': result.data_sources,
            'class_distribution': result.class_distribution,
            'metrics': result.metrics,
        }

    # Jika data belum cukup, tetap kembalikan 200 agar frontend bisa menampilkan pesan yang ramah user.
    return {
        'status': result.status,
        'message': result.message,
        'sample_size': result.sample_size,
        'data_sources': result.data_sources,
        'class_distribution': result.class_distribution,
        'metrics': result.metrics,
    }
