from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db, require_roles
from app.models.user import User, UserRole
from app.repositories.absensi import AbsensiRepository
from app.schemas.absensi import (
    AbsensiCreate, AbsensiRekapHarian, AbsensiResponse, AbsensiUpdate,
)
from app.services.absensi import AbsensiService

router = APIRouter()


def _svc(db: Session = Depends(get_db)) -> AbsensiService:
    return AbsensiService(AbsensiRepository(db))


# ── CRUD ───────────────────────────────────────────────────────────────────

@router.post("/", response_model=AbsensiResponse, status_code=201)
def catat_absensi(
    data: AbsensiCreate,
    svc: AbsensiService = Depends(_svc),
    current_user: User = Depends(require_roles([UserRole.ADMIN, UserRole.PRODUKSI])),
):
    """Catat absensi baru (admin / produksi)."""
    return svc.catat(data, current_user.id)


@router.get("/", response_model=list[AbsensiResponse])
def list_absensi(
    dari: date = Query(..., description="Tanggal mulai (YYYY-MM-DD)"),
    sampai: date = Query(..., description="Tanggal akhir (YYYY-MM-DD)"),
    user_id: Optional[int] = Query(None),
    svc: AbsensiService = Depends(_svc),
    _: User = Depends(get_current_user),
):
    """List absensi per rentang tanggal (semua role)."""
    if user_id:
        return svc.list_by_user(user_id, dari, sampai)
    return svc.list_range(dari, sampai)


@router.get("/rekap", response_model=AbsensiRekapHarian)
def rekap_harian(
    tanggal: date = Query(default=date.today()),
    svc: AbsensiService = Depends(_svc),
    _: User = Depends(get_current_user),
):
    """Rekap absensi satu hari — dipakai halaman monitoring web."""
    return svc.rekap_harian(tanggal)


@router.get("/{absensi_id}", response_model=AbsensiResponse)
def get_absensi(
    absensi_id: int,
    svc: AbsensiService = Depends(_svc),
    _: User = Depends(get_current_user),
):
    return svc.get(absensi_id)


@router.patch("/{absensi_id}", response_model=AbsensiResponse)
def update_absensi(
    absensi_id: int,
    data: AbsensiUpdate,
    svc: AbsensiService = Depends(_svc),
    current_user: User = Depends(require_roles([UserRole.ADMIN, UserRole.PRODUKSI])),
):
    return svc.update(absensi_id, data)


@router.delete("/{absensi_id}", status_code=204)
def delete_absensi(
    absensi_id: int,
    svc: AbsensiService = Depends(_svc),
    _: User = Depends(require_roles([UserRole.ADMIN])),
):
    svc.delete(absensi_id)
