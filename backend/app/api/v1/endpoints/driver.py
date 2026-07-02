from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db, require_roles
from app.models.user import User, UserRole
from app.models.pengiriman import Pengiriman
from app.repositories.base import BaseRepository
from app.schemas.driver import PengirimanCreate, PengirimanResponse, PengirimanUpdate

router = APIRouter()

DRIVER_ROLES = (UserRole.ADMIN, UserRole.DRIVER)


@router.get("/pengiriman", response_model=list[PengirimanResponse])
async def list_pengiriman(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(*DRIVER_ROLES)),
):
    repo = BaseRepository(Pengiriman, db)
    return await repo.get_all()


@router.post("/pengiriman", response_model=PengirimanResponse)
async def buat_pengiriman(
    payload: PengirimanCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(*DRIVER_ROLES)),
):
    pengiriman = Pengiriman(**payload.model_dump(), driver_id=current_user.id)
    db.add(pengiriman)
    await db.commit()
    await db.refresh(pengiriman)
    return pengiriman


@router.patch("/pengiriman/{pengiriman_id}", response_model=PengirimanResponse)
async def update_pengiriman(
    pengiriman_id: int,
    payload: PengirimanUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(*DRIVER_ROLES)),
):
    repo = BaseRepository(Pengiriman, db)
    pengiriman = await repo.get(pengiriman_id)
    for field, value in payload.model_dump(exclude_none=True).items():
        setattr(pengiriman, field, value)
    await db.commit()
    await db.refresh(pengiriman)
    return pengiriman
