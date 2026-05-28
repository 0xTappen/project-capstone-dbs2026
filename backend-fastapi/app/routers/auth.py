import re
from typing import Any
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr
from sqlalchemy import text
from sqlalchemy.orm import Session
from ..database import get_db
from ..deps import get_current_user
from ..security import create_access_token, hash_password, verify_password

router = APIRouter()
PHONE_REGEX = re.compile(r'^\+?[0-9()\-\s]{7,20}$')


class RegisterPayload(BaseModel):
    name: str
    email: EmailStr
    password: str
    phone: str | None = None
    address: str | None = None
    avatar_url: str | None = None


class LoginPayload(BaseModel):
    email: EmailStr
    password: str


class UpdateMePayload(BaseModel):
    name: str | None = None
    phone: str | None = None
    address: str | None = None
    avatar_url: str | None = None


class ChangePasswordPayload(BaseModel):
    currentPassword: str
    newPassword: str


def _validate_profile(phone: str | None, address: str | None):
    if phone and (not PHONE_REGEX.match(phone) or len(phone) > 20):
        raise HTTPException(status_code=400, detail='Phone number format is invalid.')
    if address and len(address) > 255:
        raise HTTPException(status_code=400, detail='Address is too long.')


@router.post('/register', status_code=201)
def register(payload: RegisterPayload, db: Session = Depends(get_db)):
    if len(payload.password) < 8:
        raise HTTPException(status_code=400, detail='Password must be at least 8 characters long.')
    _validate_profile(payload.phone, payload.address)

    existing = db.execute(text('SELECT id FROM users WHERE email = :email'), {'email': payload.email.lower()}).first()
    if existing:
        raise HTTPException(status_code=400, detail='Email already registered.')

    user = db.execute(
        text('''
            INSERT INTO users (name, email, password_hash, phone, address, avatar_url)
            VALUES (:name, :email, :password_hash, :phone, :address, :avatar_url)
            RETURNING id, name, email, phone, address, avatar_url, created_at
        '''),
        {
            'name': payload.name.strip(),
            'email': payload.email.lower(),
            'password_hash': hash_password(payload.password),
            'phone': payload.phone.strip() if payload.phone else None,
            'address': payload.address.strip() if payload.address else None,
            'avatar_url': payload.avatar_url,
        },
    ).mappings().first()
    db.execute(text('INSERT INTO user_settings (user_id, currency, theme) VALUES (:user_id, :currency, :theme) ON CONFLICT (user_id) DO NOTHING'), {'user_id': user['id'], 'currency': 'IDR', 'theme': 'system'})
    db.commit()
    return {'message': 'Registration successful.', 'user': dict(user)}


@router.post('/login')
def login(payload: LoginPayload, db: Session = Depends(get_db)):
    user = db.execute(text('SELECT * FROM users WHERE email = :email'), {'email': payload.email.lower()}).mappings().first()
    if not user or not verify_password(payload.password, user['password_hash']):
        raise HTTPException(status_code=401, detail='Invalid email or password.')
    token = create_access_token({'id': user['id'], 'email': user['email']})
    return {
        'token': token,
        'user': {
            'id': user['id'],
            'name': user['name'],
            'email': user['email'],
            'phone': user['phone'],
            'address': user['address'],
            'avatar_url': user['avatar_url'],
            'created_at': user['created_at'],
        },
    }


@router.post('/google')
def google_login(_: dict[str, Any]):
    raise HTTPException(status_code=501, detail='Google login is not implemented yet in FastAPI backend.')


@router.get('/me')
def get_me(current_user=Depends(get_current_user)):
    return {'user': current_user}


@router.put('/me')
def update_me(payload: UpdateMePayload, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    _validate_profile(payload.phone, payload.address)
    updates = {
        'name': payload.name.strip() if payload.name is not None else current_user['name'],
        'phone': payload.phone.strip() if payload.phone is not None and payload.phone != '' else (None if payload.phone == '' else current_user['phone']),
        'address': payload.address.strip() if payload.address is not None and payload.address != '' else (None if payload.address == '' else current_user['address']),
        'avatar_url': payload.avatar_url if payload.avatar_url is not None else current_user['avatar_url'],
        'id': current_user['id'],
    }
    user = db.execute(text('''
        UPDATE users
        SET name = :name, phone = :phone, address = :address, avatar_url = :avatar_url
        WHERE id = :id
        RETURNING id, name, email, phone, address, avatar_url, created_at
    '''), updates).mappings().first()
    db.commit()
    return {'message': 'Profile updated successfully.', 'user': dict(user)}


@router.put('/change-password')
def change_password(payload: ChangePasswordPayload, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    if len(payload.newPassword) < 8:
        raise HTTPException(status_code=400, detail='Password must be at least 8 characters long.')
    user = db.execute(text('SELECT password_hash FROM users WHERE id = :id'), {'id': current_user['id']}).mappings().first()
    if not user or not verify_password(payload.currentPassword, user['password_hash']):
        raise HTTPException(status_code=400, detail='Current password is incorrect.')
    db.execute(text('UPDATE users SET password_hash = :password_hash WHERE id = :id'), {'password_hash': hash_password(payload.newPassword), 'id': current_user['id']})
    db.commit()
    return {'message': 'Password changed successfully.'}
