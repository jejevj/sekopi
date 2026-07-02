from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db, require_roles
from app.models.user import User, UserRole
from app.repositories.stok_repo import StokRepository
from app.schemas.inventori import BahanBakuCreate, BahanBakuResponse, StokTransaksiCreate, StokTransaksiResponse
from app.models.bahan_baku import BahanBaku
from app.models.stok import Stok

router = APIRouter()

INVENTORI_ROLES = (UserRole.ADMIN, UserRole.INVENTORI)


@router.get("/bahan-baku", response_model=list[BahanBakuResponse])
async def list_bahan_baku(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(*INVENTORI_ROLES, UserRole.SHAREHOLDER)),
):
    from app.repositories.base import BaseRepository
    repo = BaseRepository(BahanBaku, db)
    return await repo.get_all()


@router.post("/bahan-baku", response_model=BahanBakuResponse)
async def create_bahan_baku(
    payload: BahanBakuCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(*INVENTORI_ROLES)),
):
    bahan = BahanBaku(**payload.model_dump())
    db.add(bahan)
    await db.commit()
    await db.refresh(bahan)
    return bahan


@router.post("/stok", response_model=StokTransaksiResponse)
async def tambah_stok(
    payload: StokTransaksiCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(*INVENTORI_ROLES)),
):
    stok = Stok(**payload.model_dump(), created_by=current_user.id)
    db.add(stok)
    await db.commit()
    await db.refresh(stok)
    return stok


@router.get("/stok/{bahan_baku_id}/saldo")
async def get_saldo_stok(
    bahan_baku_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(*INVENTORI_ROLES, UserRole.SHAREHOLDER)),
):
    repo = StokRepository(db)
    saldo = await repo.get_stok_saldo(bahan_baku_id)
    return {"bahan_baku_id": bahan_baku_id, "saldo": saldo}
