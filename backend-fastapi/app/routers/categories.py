from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.orm import Session
from ..database import get_db
from ..deps import require_profile_completion

router = APIRouter()
DEFAULT_CATEGORIES = [
    {'name': 'Gaji', 'type': 'income'}, {'name': 'Bonus', 'type': 'income'}, {'name': 'Investasi', 'type': 'income'}, {'name': 'Freelance', 'type': 'income'},
    {'name': 'Makanan', 'type': 'expense'}, {'name': 'Transportasi', 'type': 'expense'}, {'name': 'Belanja', 'type': 'expense'}, {'name': 'Tagihan', 'type': 'expense'}, {'name': 'Kesehatan', 'type': 'expense'}, {'name': 'Hiburan', 'type': 'expense'},
]

class CategoryPayload(BaseModel):
    name: str
    type: str

@router.get('')
def get_categories(current_user=Depends(require_profile_completion), db: Session = Depends(get_db)):
    rows = db.execute(text('SELECT * FROM categories WHERE user_id = :user_id ORDER BY id DESC'), {'user_id': current_user['id']}).mappings().all()
    if not rows:
        for category in DEFAULT_CATEGORIES:
            db.execute(text('INSERT INTO categories (user_id, name, type) VALUES (:user_id, :name, :type)'), {'user_id': current_user['id'], **category})
        db.commit()
        rows = db.execute(text('SELECT * FROM categories WHERE user_id = :user_id ORDER BY id DESC'), {'user_id': current_user['id']}).mappings().all()
    return [dict(row) for row in rows]

@router.post('', status_code=201)
def create_category(payload: CategoryPayload, current_user=Depends(require_profile_completion), db: Session = Depends(get_db)):
    if payload.type not in ['income', 'expense']:
        raise HTTPException(status_code=400, detail="Type must be either 'income' or 'expense'.")
    row = db.execute(text('INSERT INTO categories (user_id, name, type) VALUES (:user_id, :name, :type) RETURNING *'), {'user_id': current_user['id'], 'name': payload.name, 'type': payload.type}).mappings().first()
    db.commit()
    return dict(row)

@router.put('/{category_id}')
def update_category(category_id: int, payload: CategoryPayload, current_user=Depends(require_profile_completion), db: Session = Depends(get_db)):
    row = db.execute(text('UPDATE categories SET name = :name, type = :type WHERE id = :id AND user_id = :user_id RETURNING *'), {'id': category_id, 'user_id': current_user['id'], 'name': payload.name, 'type': payload.type}).mappings().first()
    if not row:
        raise HTTPException(status_code=404, detail='Category not found or access denied.')
    db.commit()
    return dict(row)

@router.delete('/{category_id}')
def delete_category(category_id: int, current_user=Depends(require_profile_completion), db: Session = Depends(get_db)):
    row = db.execute(text('DELETE FROM categories WHERE id = :id AND user_id = :user_id RETURNING id'), {'id': category_id, 'user_id': current_user['id']}).first()
    if not row:
        raise HTTPException(status_code=404, detail='Category not found or access denied.')
    db.commit()
    return {'message': 'Category deleted successfully.'}
