from datetime import date
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from pydantic import BaseModel
from typing import Optional

from app.api.deps import get_db, require_roles
from app.models.pengeluaran import Pengeluaran, KategoriPengeluaran
from app.models.user import User, UserRole

router = APIRouter()


class PengeluaranCreate(BaseModel):
    nama:      str
    jumlah:    float
    kategori:  KategoriPengeluaran = KategoriPengeluaran.LAINNYA
    tanggal:   date
    catatan:   Optional[str] = None


class PengeluaranUpdate(BaseModel):
    nama:      Optional[str] = None
    jumlah:    Optional[float] = None
    kategori:  Optional[KategoriPengeluaran] = None
    tanggal:   Optional[date] = None
    catatan:   Optional[str] = None


@router.get("")
async def list_pengeluaran(
    dari:   Optional[date] = None,
    sampai: Optional[date] = None,
    db:     AsyncSession = Depends(get_db),
    _:      User = Depends(require_roles(UserRole.ADMIN)),
):
    q = select(Pengeluaran).order_by(Pengeluaran.tanggal.desc())
    if dari:
        q = q.where(Pengeluaran.tanggal >= dari)
    if sampai:
        q = q.where(Pengeluaran.tanggal <= sampai)
    result = await db.execute(q)
    rows = result.scalars().all()
    return [
        {
            "id":         r.id,
            "nama":       r.nama,
            "jumlah":     float(r.jumlah),
            "kategori":   r.kategori,
            "tanggal":    r.tanggal,
            "catatan":    r.catatan,
            "dibuat_oleh": r.dibuat_user.full_name,
        }
        for r in rows
    ]


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_pengeluaran(
    body:         PengeluaranCreate,
    db:           AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN)),
):
    p = Pengeluaran(
        nama=body.nama,
        jumlah=body.jumlah,
        kategori=body.kategori,
        tanggal=body.tanggal,
        catatan=body.catatan,
        dibuat_oleh=current_user.id,
    )
    db.add(p)
    await db.commit()
    await db.refresh(p)
    return {"id": p.id, "nama": p.nama, "jumlah": float(p.jumlah), "kategori": p.kategori, "tanggal": p.tanggal}


@router.patch("/{pengeluaran_id}")
async def update_pengeluaran(
    pengeluaran_id: int,
    body:           PengeluaranUpdate,
    db:             AsyncSession = Depends(get_db),
    _:              User = Depends(require_roles(UserRole.ADMIN)),
):
    p = await db.get(Pengeluaran, pengeluaran_id)
    if not p:
        raise HTTPException(404, "Pengeluaran tidak ditemukan")
    for field, val in body.model_dump(exclude_unset=True).items():
        setattr(p, field, val)
    await db.commit()
    await db.refresh(p)
    return {"id": p.id, "nama": p.nama, "jumlah": float(p.jumlah), "kategori": p.kategori, "tanggal": p.tanggal}


@router.delete("/{pengeluaran_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_pengeluaran(
    pengeluaran_id: int,
    db:             AsyncSession = Depends(get_db),
    _:              User = Depends(require_roles(UserRole.ADMIN)),
):
    p = await db.get(Pengeluaran, pengeluaran_id)
    if not p:
        raise HTTPException(404, "Pengeluaran tidak ditemukan")
    await db.delete(p)
    await db.commit()
