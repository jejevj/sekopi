from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from jose import JWTError, jwt
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db, get_current_user
from app.core.config import settings
from app.core.exceptions import CredentialsException
from app.core.security import create_access_token, verify_password
from app.models.user import User
from app.repositories.user_repo import UserRepository
from app.schemas.user import Token, TokenPayload, UserResponse

router = APIRouter()

# Refresh token berlaku lebih lama dari access token
REFRESH_TOKEN_EXPIRE_DAYS = 7


@router.post("/login", response_model=Token)
async def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: AsyncSession = Depends(get_db),
):
    user_repo = UserRepository(db)
    user = await user_repo.get_by_email(form_data.username)
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise CredentialsException()
    if not user.is_active:
        raise HTTPException(status_code=400, detail="Akun tidak aktif")

    access_token  = create_access_token(subject=user.id)
    refresh_token = create_access_token(
        subject=user.id,
        expires_delta=timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS),
    )
    return Token(
        access_token=access_token,
        refresh_token=refresh_token,
        user=UserResponse.model_validate(user),
    )


@router.post("/refresh", response_model=Token)
async def refresh_token(
    body: TokenPayload,
    db: AsyncSession = Depends(get_db),
):
    """
    Terima { "sub": "<refresh_token_string>" } atau body JSON { "refresh_token": "..." }.
    Verifikasi refresh token lalu kembalikan access_token + refresh_token baru.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Refresh token tidak valid atau sudah kadaluarsa",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(
            body.refresh_token,
            settings.SECRET_KEY,
            algorithms=[settings.ALGORITHM],
        )
        user_id: str = payload.get("sub")
        if user_id is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    user_repo = UserRepository(db)
    user = await user_repo.get_by_id(int(user_id))
    if not user:
        raise credentials_exception
    if not user.is_active:
        raise HTTPException(status_code=400, detail="Akun tidak aktif")

    new_access_token  = create_access_token(subject=user.id)
    new_refresh_token = create_access_token(
        subject=user.id,
        expires_delta=timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS),
    )
    return Token(
        access_token=new_access_token,
        refresh_token=new_refresh_token,
        user=UserResponse.model_validate(user),
    )


@router.get("/me", response_model=UserResponse)
async def get_me(current_user: User = Depends(get_current_user)):
    return current_user
