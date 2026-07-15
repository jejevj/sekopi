"""Endpoint khusus untuk user mengatur profil & password diri sendiri.
Dipisah dari users.py agar tidak bentrok dengan route /{user_id}.
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db, get_current_user
from app.core.security import get_password_hash, verify_password
from app.models.user import User
from app.repositories.user_repo import UserRepository
from app.schemas.user import UserResponse, UserProfileUpdate, ChangePasswordPayload

router = APIRouter()


@router.patch("/", response_model=UserResponse)
async def update_my_profile(
    payload: UserProfileUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update nama dan/atau email akun sendiri."""
    user_repo = UserRepository(db)
    if payload.full_name is not None:
        current_user.full_name = payload.full_name
    if payload.email is not None:
        existing = await user_repo.get_by_email(payload.email)
        if existing and existing.id != current_user.id:
            raise HTTPException(
                status_code=400,
                detail="Email sudah digunakan akun lain",
            )
        current_user.email = payload.email
    await db.commit()
    await db.refresh(current_user)
    return current_user


@router.post("/change-password", status_code=status.HTTP_200_OK)
async def change_my_password(
    payload: ChangePasswordPayload,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Ganti password sendiri — wajib verifikasi password lama."""
    if not verify_password(payload.current_password, current_user.hashed_password):
        raise HTTPException(status_code=400, detail="Password saat ini tidak sesuai")
    if len(payload.new_password) < 6:
        raise HTTPException(status_code=400, detail="Password baru minimal 6 karakter")
    if payload.current_password == payload.new_password:
        raise HTTPException(
            status_code=400,
            detail="Password baru tidak boleh sama dengan yang lama",
        )
    current_user.hashed_password = get_password_hash(payload.new_password)
    await db.commit()
    return {"message": "Password berhasil diubah"}
