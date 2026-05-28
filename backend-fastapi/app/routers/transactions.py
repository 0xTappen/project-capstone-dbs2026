from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.orm import Session
from ..database import get_db
from ..deps import require_profile_completion

router = APIRouter()

class TransactionPayload(BaseModel):
    category_id: int | None = None
    type: str
    amount: float
    description: str | None = None
    transaction_date: str | None = None


def normalize_type(value: str) -> str:
    lowered = str(value or '').lower()
    if lowered in ['income', 'pemasukan', 'masuk']:
        return 'income'
    if lowered in ['expense', 'pengeluaran', 'keluar']:
        return 'expense'
    return lowered

@router.get('')
def get_transactions(current_user=Depends(require_profile_completion), db: Session = Depends(get_db)):
    rows = db.execute(text('''
        SELECT t.id, t.user_id, t.category_id,
               CASE
                 WHEN LOWER(t.type) IN ('income', 'pemasukan', 'masuk') THEN 'income'
                 WHEN LOWER(t.type) IN ('expense', 'pengeluaran', 'keluar') THEN 'expense'
                 ELSE LOWER(t.type)
               END AS type,
               t.amount, t.description, t.transaction_date::date AS transaction_date, t.created_at,
               c.name AS category_name
        FROM transactions t
        LEFT JOIN categories c ON t.category_id = c.id
        WHERE t.user_id = :user_id
        ORDER BY t.transaction_date DESC, t.id DESC
    '''), {'user_id': current_user['id']}).mappings().all()
    return [dict(row) for row in rows]

@router.post('', status_code=201)
def create_transaction(payload: TransactionPayload, current_user=Depends(require_profile_completion), db: Session = Depends(get_db)):
    tx_type = normalize_type(payload.type)
    if tx_type not in ['income', 'expense']:
        raise HTTPException(status_code=400, detail="Type must be either 'income' or 'expense'.")
    row = db.execute(text('''
        INSERT INTO transactions (user_id, category_id, type, amount, description, transaction_date)
        VALUES (:user_id, :category_id, :type, :amount, :description, COALESCE(:transaction_date, CURRENT_DATE))
        RETURNING id, user_id, category_id, type, amount, description, transaction_date, created_at
    '''), {
        'user_id': current_user['id'], 'category_id': payload.category_id, 'type': tx_type,
        'amount': payload.amount, 'description': payload.description, 'transaction_date': payload.transaction_date,
    }).mappings().first()
    db.commit()
    return dict(row)

@router.get('/{transaction_id}')
def get_transaction_by_id(transaction_id: int, current_user=Depends(require_profile_completion), db: Session = Depends(get_db)):
    row = db.execute(text('SELECT * FROM transactions WHERE id = :id AND user_id = :user_id'), {'id': transaction_id, 'user_id': current_user['id']}).mappings().first()
    if not row:
        raise HTTPException(status_code=404, detail='Transaction not found or access denied.')
    return dict(row)

@router.put('/{transaction_id}')
def update_transaction(transaction_id: int, payload: TransactionPayload, current_user=Depends(require_profile_completion), db: Session = Depends(get_db)):
    tx_type = normalize_type(payload.type)
    row = db.execute(text('''
        UPDATE transactions
        SET category_id = :category_id, type = :type, amount = :amount, description = :description, transaction_date = COALESCE(:transaction_date, transaction_date)
        WHERE id = :id AND user_id = :user_id
        RETURNING *
    '''), {
        'id': transaction_id, 'user_id': current_user['id'], 'category_id': payload.category_id,
        'type': tx_type, 'amount': payload.amount, 'description': payload.description, 'transaction_date': payload.transaction_date,
    }).mappings().first()
    if not row:
        raise HTTPException(status_code=404, detail='Transaction not found or access denied.')
    db.commit()
    return dict(row)

@router.delete('/{transaction_id}')
def delete_transaction(transaction_id: int, current_user=Depends(require_profile_completion), db: Session = Depends(get_db)):
    row = db.execute(text('DELETE FROM transactions WHERE id = :id AND user_id = :user_id RETURNING id'), {'id': transaction_id, 'user_id': current_user['id']}).first()
    if not row:
        raise HTTPException(status_code=404, detail='Transaction not found or access denied.')
    db.commit()
    return {'message': 'Transaction deleted successfully.'}
