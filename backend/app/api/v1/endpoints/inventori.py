from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db, require_roles
from app.models.bahan_baku import BahanBaku
from app.models.manufacturing_order import MOBahanBaku
from app.models.stok import Stok
from app.models.user import User, UserRole
from app.repositories.stok_repo import StokRepository
from app.schemas.inventori import (
    BahanBakuCreate,
    BahanBakuResponse,
    BahanBakuUpdate,
    StokHistoriResponse,
    StokTransaksiCreate,
    StokTransaksiResponse,
)

router = APIRouter()

INVENTORI_ROLES = (UserRole.ADMIN, UserRole.INVENTORI)
VIEW_ROLES = (UserRole.ADMIN, UserRole.INVENTORI, UserRole.PRODUKSI, UserRole.SHAREHOLDER)


async def _bahan_with_saldo(bahan: BahanBaku, db: AsyncSession) -> dict:
    repo = StokRepository(db)
    saldo = await repo.get_stok_saldo(bahan.id)
    data = BahanBakuResponse.model_validate(bahan).model_dump()
    data["saldo"] = saldo
    return data


# ─── Bahan Baku CRUD ────────────────────────────────────────────────────────

@router.get("/bahan-baku", response_model=list[BahanBakuResponse])
async def list_bahan_baku(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(*VIEW_ROLES)),
):
    result = await db.execute(select(BahanBaku).order_by(BahanBaku.nama))
    items = result.scalars().all()
    return [await _bahan_with_saldo(b, db) for b in items]


@router.post("/bahan-baku", response_model=BahanBakuResponse, status_code=status.HTTP_201_CREATED)
async def create_bahan_baku(
    payload: BahanBakuCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(*INVENTORI_ROLES)),
):
    bahan = BahanBaku(**payload.model_dump())
    db.add(bahan)
    await db.commit()
    await db.refresh(bahan)
    return await _bahan_with_saldo(bahan, db)


@router.get("/bahan-baku/{bahan_id}", response_model=BahanBakuResponse)
async def get_bahan_baku(
    bahan_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(*VIEW_ROLES)),
):
    bahan = await db.get(BahanBaku, bahan_id)
    if not bahan:
        raise HTTPException(status_code=404, detail="Bahan baku tidak ditemukan")
    return await _bahan_with_saldo(bahan, db)


@router.patch("/bahan-baku/{bahan_id}", response_model=BahanBakuResponse)
async def update_bahan_baku(
    bahan_id: int,
    payload: BahanBakuUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(*INVENTORI_ROLES)),
):
    bahan = await db.get(BahanBaku, bahan_id)
    if not bahan:
        raise HTTPException(status_code=404, detail="Bahan baku tidak ditemukan")
    for field, value in payload.model_dump(exclude_none=True).items():
        setattr(bahan, field, value)
    await db.commit()
    await db.refresh(bahan)
    return await _bahan_with_saldo(bahan, db)


@router.delete("/bahan-baku/{bahan_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_bahan_baku(
    bahan_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(*INVENTORI_ROLES)),
):
    bahan = await db.get(BahanBaku, bahan_id)
    if not bahan:
        raise HTTPException(status_code=404, detail="Bahan baku tidak ditemukan")
    # cek apakah sudah dipakai di MO
    used = await db.execute(
        select(MOBahanBaku).where(MOBahanBaku.bahan_baku_id == bahan_id).limit(1)
    )
    if used.scalar_one_or_none():
        raise HTTPException(
            status_code=400,
            detail="Bahan baku sudah digunakan dalam Manufacturing Order, tidak bisa dihapus."
        )
    await db.delete(bahan)
    await db.commit()


# ─── Stok Transaksi ─────────────────────────────────────────────────────────

@router.get("/stok/{bahan_id}/saldo")
async def get_saldo_stok(
    bahan_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(*VIEW_ROLES)),
):
    repo = StokRepository(db)
    saldo = await repo.get_stok_saldo(bahan_id)
    bahan = await db.get(BahanBaku, bahan_id)
    return {
        "bahan_baku_id": bahan_id,
        "nama": bahan.nama if bahan else "-",
        "satuan": bahan.satuan if bahan else "-",
        "saldo": saldo,
    }


@router.get("/stok/{bahan_id}/histori", response_model=list[StokHistoriResponse])
async def get_histori_stok(
    bahan_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(*VIEW_ROLES)),
):
    result = await db.execute(
        select(Stok)
        .where(Stok.bahan_baku_id == bahan_id)
        .order_by(Stok.created_at.desc())
        .limit(50)
    )
    return result.scalars().all()


@router.post("/stok", response_model=StokTransaksiResponse)
async def tambah_stok(
    payload: StokTransaksiCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(*INVENTORI_ROLES)),
):
    bahan = await db.get(BahanBaku, payload.bahan_baku_id)
    if not bahan:
        raise HTTPException(status_code=404, detail="Bahan baku tidak ditemukan")
    stok = Stok(**payload.model_dump(), created_by=current_user.id)
    db.add(stok)
    await db.commit()
    await db.refresh(stok)
    return stok
