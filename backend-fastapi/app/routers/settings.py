from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.orm import Session
from ..database import get_db
from ..deps import get_current_user

router = APIRouter()

class SettingsPayload(BaseModel):
    currency: str | None = None
    theme: str | None = None

@router.get('')
def get_settings(current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    row = db.execute(text('SELECT id, user_id, currency, theme FROM user_settings WHERE user_id = :user_id'), {'user_id': current_user['id']}).mappings().first()
    if not row:
        row = db.execute(text("INSERT INTO user_settings (user_id, currency, theme) VALUES (:user_id, 'IDR', 'system') RETURNING id, user_id, currency, theme"), {'user_id': current_user['id']}).mappings().first()
        db.commit()
    return dict(row)

@router.put('')
def update_settings(payload: SettingsPayload, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    if payload.theme is not None and payload.theme not in ['light', 'dark', 'system']:
        raise HTTPException(status_code=400, detail="Theme must be either 'light', 'dark', or 'system'.")
    row = db.execute(text('''
        INSERT INTO user_settings (user_id, currency, theme)
        VALUES (:user_id, :currency, :theme)
        ON CONFLICT (user_id)
        DO UPDATE SET
          currency = COALESCE(EXCLUDED.currency, user_settings.currency),
          theme = COALESCE(EXCLUDED.theme, user_settings.theme)
        RETURNING id, user_id, currency, theme
    '''), {'user_id': current_user['id'], 'currency': payload.currency.upper() if payload.currency else None, 'theme': payload.theme.lower() if payload.theme else None}).mappings().first()
    db.commit()
    return dict(row)
