import secrets
import time

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from .config import settings

security = HTTPBearer(auto_error=False)
JWT_ALGORITHM = "HS256"


def create_access_token(username: str) -> dict:
    now = int(time.time())
    expires_at = now + settings.JWT_EXPIRES_MINUTES * 60
    payload = {
        "sub": username,
        "iat": now,
        "exp": expires_at,
        "scope": "admin",
    }
    token = jwt.encode(payload, settings.JWT_SECRET, algorithm=JWT_ALGORITHM)
    return {
        "access_token": token,
        "token_type": "bearer",
        "expires_at": expires_at,
        "username": username,
    }


def _constant_time_equals(a: str, b: str) -> bool:
    """Constant-time string comparison that tolerates non-ASCII input.

    ``secrets.compare_digest`` raises ``TypeError`` for ``str`` values containing
    non-ASCII characters, so compare the UTF-8 byte encodings instead — that turns
    a hostile non-ASCII credential into a clean ``False`` rather than a 500.
    """
    return secrets.compare_digest(a.encode("utf-8"), b.encode("utf-8"))


def authenticate_admin(username: str, password: str) -> bool:
    valid_username = _constant_time_equals(username, settings.ADMIN_USERNAME)
    valid_password = _constant_time_equals(password, settings.ADMIN_PASSWORD)
    return valid_username and valid_password


def decode_access_token(token: str) -> dict:
    try:
        payload = jwt.decode(
            token,
            settings.JWT_SECRET,
            algorithms=[JWT_ALGORITHM],
            options={"require": ["exp", "sub", "scope"]},
        )
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token expired",
            headers={"WWW-Authenticate": "Bearer"},
        ) from None
    except jwt.InvalidTokenError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token",
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc

    username = payload.get("sub")
    if not username or not _constant_time_equals(str(username), settings.ADMIN_USERNAME):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token subject",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if payload.get("scope") != "admin":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Insufficient scope",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return payload


def require_admin(credentials: HTTPAuthorizationCredentials | None = Depends(security)) -> str:
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if credentials.scheme.lower() != "bearer":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Bearer token required",
            headers={"WWW-Authenticate": "Bearer"},
        )

    payload = decode_access_token(credentials.credentials)
    return payload["sub"]
