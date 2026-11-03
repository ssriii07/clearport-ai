"""Password hashing and short-lived signed API access tokens for local demo.

Avoid storing passwords or JWT secrets in git. Demo accounts are synthetic.
"""
import base64
import hashlib
import hmac
import os
import secrets
from datetime import datetime, timedelta, timezone
from dotenv import dotenv_values
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
import jwt
from sqlalchemy.orm import Session
from .database import ENV_FILE, User, get_db

security = HTTPBearer(auto_error=False)

def password_hash(password: str) -> str:
    salt = secrets.token_bytes(16)
    digest = hashlib.scrypt(password.encode('utf-8'), salt=salt, n=2**14, r=8, p=1)
    return base64.b64encode(salt).decode() + ':' + base64.b64encode(digest).decode()

def verify_password(password: str, stored: str) -> bool:
    try:
        salt64, digest64 = stored.split(':', 1)
        salt, expected = base64.b64decode(salt64), base64.b64decode(digest64)
        actual = hashlib.scrypt(password.encode('utf-8'), salt=salt, n=2**14, r=8, p=1)
        return hmac.compare_digest(expected, actual)
    except (ValueError, TypeError):
        return False

def jwt_secret() -> str:
    secret = os.environ.get('CLEARPORT_JWT_SECRET') or dotenv_values(ENV_FILE).get('CLEARPORT_JWT_SECRET')
    if not secret or len(secret) < 32:
        raise RuntimeError('CLEARPORT_JWT_SECRET must contain at least 32 characters')
    return secret

def issue_token(user: User) -> str:
    now = datetime.now(timezone.utc)
    return jwt.encode({'sub': str(user.id), 'iat': now, 'exp': now + timedelta(hours=4)}, jwt_secret(), algorithm='HS256')

def current_user(credentials: HTTPAuthorizationCredentials | None = Depends(security), db: Session = Depends(get_db)) -> User:
    if not credentials or credentials.scheme.lower() != 'bearer':
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail='Sign in required')
    try:
        payload = jwt.decode(credentials.credentials, jwt_secret(), algorithms=['HS256'])
        user_id = int(payload['sub'])
    except (jwt.PyJWTError, KeyError, ValueError, TypeError):
        raise HTTPException(status_code=401, detail='Invalid or expired token') from None
    user = db.get(User, user_id)
    if user is None or not user.active:
        raise HTTPException(status_code=401, detail='Account unavailable')
    return user

def manager_only(user: User = Depends(current_user)) -> User:
    if user.role != 'manager':
        raise HTTPException(status_code=403, detail='Manager permission required')
    return user
