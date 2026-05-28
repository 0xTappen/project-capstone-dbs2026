from fastapi import Depends, Header, HTTPException, status
from sqlalchemy import text
from sqlalchemy.orm import Session
from .database import get_db
from .security import decode_access_token


def get_current_user(authorization: str | None = Header(default=None), db: Session = Depends(get_db)):
    if not authorization or not authorization.startswith('Bearer '):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail='Access denied. No token provided.')

    token = authorization.split(' ', 1)[1]
    try:
        payload = decode_access_token(token)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(exc)) from exc

    user = db.execute(
        text('SELECT id, name, email, phone, address, avatar_url, created_at FROM users WHERE id = :id'),
        {'id': payload.get('id')},
    ).mappings().first()

    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='User not found.')

    return dict(user)


def require_profile_completion(current_user=Depends(get_current_user)):
    if not str(current_user.get('phone') or '').strip() or not str(current_user.get('address') or '').strip():
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail='Lengkapi profil Anda (telepon dan alamat) sebelum menggunakan fitur ini.',
        )
    return current_user
