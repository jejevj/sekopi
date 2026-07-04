from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db, require_roles
from app.models.user import User, UserRole
from app.repositories.absensi import AbsensiRepository
from app.repositories.absensi_setting import AbsensiSettingRepository
from app.schemas.absensi import (
    AbsensiCreate, AbsensiRekapHarian, AbsensiResponse,
    AbsensiSettingCreate, AbsensiSettingResponse, AbsensiSettingUpdate,
    AbsensiUpdate,
)
from app.services.absensi import AbsensiService, AbsensiSettingService

router = APIRouter()


def _setting_svc(db: Session = Depends(get_db)) -> AbsensiSettingService:
    return AbsensiSettingService(AbsensiSettingRepository(db))


def _svc(db: Session = Depends(get_db)) -> AbsensiService:
    return AbsensiService(AbsensiRepository(db), AbsensiSettingRepository(db))


# ══ Setting Lokasi ═════════════════════════════════════════════════════════════

@router.get("/settings", response_model=list[AbsensiSettingResponse])
def list_settings(
    svc: AbsensiSettingService = Depends(_setting_svc),
    _: User = Depends(get_current_user),
):
    """List semua setting lokasi absensi."""
    return svc.list_all()


@router.post("/settings", response_model=AbsensiSettingResponse, status_code=201)
def create_setting(
    data: AbsensiSettingCreate,
    svc: AbsensiSettingService = Depends(_setting_svc),
    _: User = Depends(require_roles([UserRole.ADMIN])),
):
    return svc.create(data)


@router.patch("/settings/{setting_id}", response_model=AbsensiSettingResponse)
def update_setting(
    setting_id: int,
    data: AbsensiSettingUpdate,
    svc: AbsensiSettingService = Depends(_setting_svc),
    _: User = Depends(require_roles([UserRole.ADMIN])),
):
    return svc.update(setting_id, data)


@router.delete("/settings/{setting_id}", status_code=204)
def delete_setting(
    setting_id: int,
    svc: AbsensiSettingService = Depends(_setting_svc),
    _: User = Depends(require_roles([UserRole.ADMIN])),
):
    svc.delete(setting_id)


# ══ Absensi CRUD ═════════════════════════════════════════════════════════════

@router.post("/", response_model=AbsensiResponse, status_code=201)
def catat_absensi(
    data: AbsensiCreate,
    enforce_radius: bool = Query(False, description="True = tolak jika di luar radius (dipakai mobile)"),
    svc: AbsensiService = Depends(_svc),
    current_user: User = Depends(get_current_user),
):
    """
    Catat absensi.
    - Mobile: kirim latitude/longitude/foto_url + enforce_radius=true
    - Web/admin: boleh tanpa koordinat
    """
    return svc.catat(data, current_user.id, enforce_radius=enforce_radius)


@router.get("/", response_model=list[AbsensiResponse])
def list_absensi(
    dari: date = Query(...),
    sampai: date = Query(...),
    user_id: Optional[int] = Query(None),
    svc: AbsensiService = Depends(_svc),
    _: User = Depends(get_current_user),
):
    if user_id:
        return svc.list_by_user(user_id, dari, sampai)
    return svc.list_range(dari, sampai)


@router.get("/rekap", response_model=AbsensiRekapHarian)
def rekap_harian(
    tanggal: date = Query(default=date.today()),
    svc: AbsensiService = Depends(_svc),
    _: User = Depends(get_current_user),
):
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
    _: User = Depends(require_roles([UserRole.ADMIN, UserRole.PRODUKSI])),
):
    return svc.update(absensi_id, data)


@router.delete("/{absensi_id}", status_code=204)
def delete_absensi(
    absensi_id: int,
    svc: AbsensiService = Depends(_svc),
    _: User = Depends(require_roles([UserRole.ADMIN])),
):
    svc.delete(absensi_id)
