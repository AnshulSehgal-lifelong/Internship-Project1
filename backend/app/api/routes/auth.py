from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
import bcrypt
from jose import jwt
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.db.session import get_db
from app.models.user import User
from app.schemas.auth import Token, UserCreate, UserRead


router = APIRouter(prefix="/auth", tags=["auth"])
oauth2_scheme = OAuth2PasswordBearer(tokenUrl=f"{settings.api_v1_prefix}/auth/token")
REFRESH_COOKIE_NAME = "refresh_token"


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, hashed_password: str) -> bool:
    return bcrypt.checkpw(password.encode("utf-8"), hashed_password.encode("utf-8"))


def create_token(subject: str, token_type: str, expires_delta: timedelta) -> str:
    expire = datetime.now(timezone.utc) + expires_delta
    payload = {"sub": subject, "type": token_type, "exp": expire}
    return jwt.encode(payload, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)


def create_access_token(subject: str) -> str:
    return create_token(subject, "access", timedelta(minutes=settings.access_token_expire_minutes))


def create_refresh_token(subject: str) -> str:
    return create_token(subject, "refresh", timedelta(days=settings.refresh_token_expire_days))


def set_refresh_cookie(response: Response, refresh_token: str) -> None:
    response.set_cookie(
        key=REFRESH_COOKIE_NAME,
        value=refresh_token,
        httponly=True,
        samesite="lax",
        secure=False,
        max_age=settings.refresh_token_expire_days * 24 * 60 * 60,
        path="/",
    )


def clear_refresh_cookie(response: Response) -> None:
    response.delete_cookie(key=REFRESH_COOKIE_NAME, path="/")


async def get_current_user(token: str = Depends(oauth2_scheme), db: AsyncSession = Depends(get_db)) -> User:
    credentials_error = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, settings.jwt_secret_key, algorithms=[settings.jwt_algorithm])
        email = payload.get("sub")
        token_type = payload.get("type")
        if email is None or token_type != "access":
            raise credentials_error
    except Exception as exc:  # noqa: BLE001
        raise credentials_error from exc

    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()
    if user is None or not user.is_active:
        raise credentials_error
    return user


def require_roles(*allowed_roles: str, detail: str = "Not authorized"):
    async def role_dependency(current_user: User = Depends(get_current_user)) -> User:
        if (current_user.role or "") not in allowed_roles:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=detail)
        return current_user

    return role_dependency


@router.post("/register", response_model=UserRead, status_code=status.HTTP_201_CREATED)
async def register(payload: UserCreate, db: AsyncSession = Depends(get_db)) -> User:
    result = await db.execute(select(User).where(User.email == payload.email))
    existing_user = result.scalar_one_or_none()
    if existing_user:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email already registered")

    user = User(
        first_name=payload.first_name,
        last_name=payload.last_name,
        role=payload.role,
        email=payload.email,
        hashed_password=hash_password(payload.password),
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


@router.post("/token", response_model=Token)
async def login_for_access_token(
    response: Response,
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: AsyncSession = Depends(get_db),
) -> Token:
    result = await db.execute(select(User).where(User.email == form_data.username))
    user = result.scalar_one_or_none()
    if user is None or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Incorrect email or password")

    access_token = create_access_token(subject=user.email)
    refresh_token = create_refresh_token(subject=user.email)
    set_refresh_cookie(response, refresh_token)
    return Token(access_token=access_token)


@router.post("/refresh", response_model=Token)
async def refresh_access_token(request: Request, response: Response, db: AsyncSession = Depends(get_db)) -> Token:
    refresh_token = request.cookies.get(REFRESH_COOKIE_NAME)
    credentials_error = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    if not refresh_token:
        raise credentials_error

    try:
        payload = jwt.decode(refresh_token, settings.jwt_secret_key, algorithms=[settings.jwt_algorithm])
        email = payload.get("sub")
        token_type = payload.get("type")
        if email is None or token_type != "refresh":
            raise credentials_error
    except Exception as exc:  # noqa: BLE001
        raise credentials_error from exc

    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()
    if user is None or not user.is_active:
        raise credentials_error

    access_token = create_access_token(subject=user.email)
    set_refresh_cookie(response, create_refresh_token(subject=user.email))
    return Token(access_token=access_token)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(response: Response) -> None:
    clear_refresh_cookie(response)


@router.get("/me", response_model=UserRead)
async def read_me(current_user: User = Depends(get_current_user)) -> User:
    return current_user