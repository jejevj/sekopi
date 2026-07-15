from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db, require_roles, get_current_user
from app.core.security import get_password_hash, verify_password
from app.models.user import User, UserRole
from app.repositories.user_repo import UserRepository
from app.schemas.user import (
    UserCreate,
    UserResponse,
    UserUpdate,
    UserProfileUpdate,
    ChangePasswordPayload,
)

router = APIRouter()


# ── Admin: list semua user
@router.get("/", response_model=list[UserResponse])
async def list_users(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_roles(UserRole.ADMIN)),
):
    user_repo = UserRepository(db)
    return await user_repo.get_all()


# ── Admin: buat user baru
@router.post("/", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def create_user(
    payload: UserCreate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_roles(UserRole.ADMIN)),
):
    user_repo = UserRepository(db)
    existing = await user_repo.get_by_email(payload.email)
    if existing:
        raise HTTPException(status_code=400, detail="Email sudah terdaftar")
    user = User(
        email=payload.email,
        hashed_password=get_password_hash(payload.password),
        full_name=payload.full_name,
        role=payload.role,
    )
    return await user_repo.create(user)


# ── Self: update profil sendiri (full_name & email)
@router.patch("/me/profile", response_model=UserResponse)
async def update_my_profile(
    payload: UserProfileUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    user_repo = UserRepository(db)
    if payload.full_name is not None:
        current_user.full_name = payload.full_name
    if payload.email is not None:
        existing = await user_repo.get_by_email(payload.email)
        if existing and existing.id != current_user.id:
            raise HTTPException(status_code=400, detail="Email sudah digunakan akun lain")
        current_user.email = payload.email
    await db.commit()
    await db.refresh(current_user)
    return current_user


# ── Self: ganti password sendiri (butuh verifikasi password lama)
@router.post("/me/change-password", status_code=status.HTTP_200_OK)
async def change_my_password(
    payload: ChangePasswordPayload,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not verify_password(payload.current_password, current_user.hashed_password):
        raise HTTPException(status_code=400, detail="Password saat ini tidak sesuai")
    if len(payload.new_password) < 6:
        raise HTTPException(status_code=400, detail="Password baru minimal 6 karakter")
    if payload.current_password == payload.new_password:
        raise HTTPException(status_code=400, detail="Password baru tidak boleh sama dengan yang lama")
    current_user.hashed_password = get_password_hash(payload.new_password)
    await db.commit()
    return {"message": "Password berhasil diubah"}


# ── Admin: update user lain (role, is_active, full_name)
@router.patch("/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: int,
    payload: UserUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN)),
):
    user_repo = UserRepository(db)
    user = await user_repo.get_by_id(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="Pengguna tidak ditemukan")
    if payload.full_name is not None:
        user.full_name = payload.full_name
    if payload.role is not None:
        if user.id == current_user.id:
            raise HTTPException(status_code=400, detail="Tidak bisa mengubah role diri sendiri")
        user.role = payload.role
    if payload.is_active is not None:
        if user.id == current_user.id:
            raise HTTPException(status_code=400, detail="Tidak bisa menonaktifkan akun sendiri")
        user.is_active = payload.is_active
    await db.commit()
    await db.refresh(user)
    return user


# ── Admin: reset password user lain
@router.post("/{user_id}/reset-password", status_code=status.HTTP_200_OK)
async def reset_password(
    user_id: int,
    payload: dict,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_roles(UserRole.ADMIN)),
):
    new_password: str = payload.get("new_password", "")
    if not new_password or len(new_password) < 6:
        raise HTTPException(status_code=400, detail="Password minimal 6 karakter")
    user_repo = UserRepository(db)
    user = await user_repo.get_by_id(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="Pengguna tidak ditemukan")
    user.hashed_password = get_password_hash(new_password)
    await db.commit()
    return {"message": "Password berhasil direset"}


# ── Admin: hapus user
@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN)),
):
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Tidak bisa menghapus akun sendiri")
    user_repo = UserRepository(db)
    user = await user_repo.get_by_id(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="Pengguna tidak ditemukan")
    await db.delete(user)
    await db.commit()
