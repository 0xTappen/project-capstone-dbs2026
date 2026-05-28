from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.orm import Session
from ..database import get_db
from ..deps import require_profile_completion

router = APIRouter()

class BillPayload(BaseModel):
    title: str
    amount: float
    due_date: str
    status: str | None = 'unpaid'

@router.get('')
def get_bills(current_user=Depends(require_profile_completion), db: Session = Depends(get_db)):
    rows = db.execute(text('SELECT * FROM bills WHERE user_id = :user_id ORDER BY due_date ASC, id DESC'), {'user_id': current_user['id']}).mappings().all()
    return [dict(row) for row in rows]

@router.post('', status_code=201)
def create_bill(payload: BillPayload, current_user=Depends(require_profile_completion), db: Session = Depends(get_db)):
    row = db.execute(text('INSERT INTO bills (user_id, title, amount, due_date, status) VALUES (:user_id, :title, :amount, :due_date, :status) RETURNING *'), {'user_id': current_user['id'], 'title': payload.title, 'amount': payload.amount, 'due_date': payload.due_date, 'status': payload.status or 'unpaid'}).mappings().first()
    db.commit()
    return dict(row)

@router.get('/{bill_id}')
def get_bill_by_id(bill_id: int, current_user=Depends(require_profile_completion), db: Session = Depends(get_db)):
    row = db.execute(text('SELECT * FROM bills WHERE id = :id AND user_id = :user_id'), {'id': bill_id, 'user_id': current_user['id']}).mappings().first()
    if not row:
        raise HTTPException(status_code=404, detail='Bill not found or access denied.')
    return dict(row)

@router.put('/{bill_id}')
def update_bill(bill_id: int, payload: BillPayload, current_user=Depends(require_profile_completion), db: Session = Depends(get_db)):
    row = db.execute(text('UPDATE bills SET title = :title, amount = :amount, due_date = :due_date, status = :status WHERE id = :id AND user_id = :user_id RETURNING *'), {'id': bill_id, 'user_id': current_user['id'], 'title': payload.title, 'amount': payload.amount, 'due_date': payload.due_date, 'status': payload.status or 'unpaid'}).mappings().first()
    if not row:
        raise HTTPException(status_code=404, detail='Bill not found or access denied.')
    db.commit()
    return dict(row)

@router.patch('/{bill_id}/pay')
def pay_bill(bill_id: int, current_user=Depends(require_profile_completion), db: Session = Depends(get_db)):
    row = db.execute(text("UPDATE bills SET status = 'paid' WHERE id = :id AND user_id = :user_id RETURNING *"), {'id': bill_id, 'user_id': current_user['id']}).mappings().first()
    if not row:
        raise HTTPException(status_code=404, detail='Bill not found or access denied.')
    db.commit()
    return dict(row)

@router.delete('/{bill_id}')
def delete_bill(bill_id: int, current_user=Depends(require_profile_completion), db: Session = Depends(get_db)):
    row = db.execute(text('DELETE FROM bills WHERE id = :id AND user_id = :user_id RETURNING id'), {'id': bill_id, 'user_id': current_user['id']}).first()
    if not row:
        raise HTTPException(status_code=404, detail='Bill not found or access denied.')
    db.commit()
    return {'message': 'Bill deleted successfully.'}
