from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.orm import Session
from ..database import get_db
from ..deps import require_profile_completion

router = APIRouter()

class BudgetPayload(BaseModel):
    category_id: int
    limit_amount: float
    month: int
    year: int

@router.get('')
def get_budgets(current_user=Depends(require_profile_completion), db: Session = Depends(get_db)):
    rows = db.execute(text('''
        SELECT b.*, c.name AS category_name, c.type AS category_type
        FROM budgets b
        JOIN categories c ON c.id = b.category_id
        WHERE b.user_id = :user_id
        ORDER BY b.year DESC, b.month DESC, b.id DESC
    '''), {'user_id': current_user['id']}).mappings().all()
    return [dict(row) for row in rows]

@router.post('', status_code=201)
def create_budget(payload: BudgetPayload, current_user=Depends(require_profile_completion), db: Session = Depends(get_db)):
    row = db.execute(text('''
        INSERT INTO budgets (user_id, category_id, limit_amount, month, year)
        VALUES (:user_id, :category_id, :limit_amount, :month, :year)
        RETURNING *
    '''), {'user_id': current_user['id'], 'category_id': payload.category_id, 'limit_amount': payload.limit_amount, 'month': payload.month, 'year': payload.year}).mappings().first()
    db.commit()
    return dict(row)

@router.get('/{budget_id}')
def get_budget_by_id(budget_id: int, current_user=Depends(require_profile_completion), db: Session = Depends(get_db)):
    row = db.execute(text('SELECT * FROM budgets WHERE id = :id AND user_id = :user_id'), {'id': budget_id, 'user_id': current_user['id']}).mappings().first()
    if not row:
        raise HTTPException(status_code=404, detail='Budget not found or access denied.')
    return dict(row)

@router.put('/{budget_id}')
def update_budget(budget_id: int, payload: BudgetPayload, current_user=Depends(require_profile_completion), db: Session = Depends(get_db)):
    row = db.execute(text('''
        UPDATE budgets
        SET category_id = :category_id, limit_amount = :limit_amount, month = :month, year = :year
        WHERE id = :id AND user_id = :user_id
        RETURNING *
    '''), {'id': budget_id, 'user_id': current_user['id'], 'category_id': payload.category_id, 'limit_amount': payload.limit_amount, 'month': payload.month, 'year': payload.year}).mappings().first()
    if not row:
        raise HTTPException(status_code=404, detail='Budget not found or access denied.')
    db.commit()
    return dict(row)

@router.delete('/{budget_id}')
def delete_budget(budget_id: int, current_user=Depends(require_profile_completion), db: Session = Depends(get_db)):
    row = db.execute(text('DELETE FROM budgets WHERE id = :id AND user_id = :user_id RETURNING id'), {'id': budget_id, 'user_id': current_user['id']}).first()
    if not row:
        raise HTTPException(status_code=404, detail='Budget not found or access denied.')
    db.commit()
    return {'message': 'Budget deleted successfully.'}
