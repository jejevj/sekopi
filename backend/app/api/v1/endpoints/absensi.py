from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

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


def _setting_svc(db: AsyncSession = Depends(get_db)) -> AbsensiSettingService:
    return AbsensiSettingService(AbsensiSettingRepository(db))


def _svc(db: AsyncSession = Depends(get_db)) -> AbsensiService:
    return AbsensiService(AbsensiRepository(db), AbsensiSettingRepository(db))


# ══ Setting Lokasi ══════════════════════════════════════════════════════════════════════════

@router.get("/settings", response_model=list[AbsensiSettingResponse])
async def list_settings(
    svc: AbsensiSettingService = Depends(_setting_svc),
    _: User = Depends(get_current_user),
):
    return await svc.list_all()


@router.post("/settings", response_model=AbsensiSettingResponse, status_code=201)
async def create_setting(
    data: AbsensiSettingCreate,
    svc: AbsensiSettingService = Depends(_setting_svc),
    _: User = Depends(require_roles([UserRole.ADMIN])),
):
    return await svc.create(data)


@router.patch("/settings/{setting_id}", response_model=AbsensiSettingResponse)
async def update_setting(
    setting_id: int,
    data: AbsensiSettingUpdate,
    svc: AbsensiSettingService = Depends(_setting_svc),
    _: User = Depends(require_roles([UserRole.ADMIN])),
):
    return await svc.update(setting_id, data)


@router.delete("/settings/{setting_id}", status_code=204)
async def delete_setting(
    setting_id: int,
    svc: AbsensiSettingService = Depends(_setting_svc),
    _: User = Depends(require_roles([UserRole.ADMIN])),
):
    await svc.delete(setting_id)


# ══ Absensi CRUD ═════════════════════════════════════════════════════════════════════════

@router.post("/", response_model=AbsensiResponse, status_code=201)
async def catat_absensi(
    data: AbsensiCreate,
    enforce_radius: bool = Query(False),
    svc: AbsensiService = Depends(_svc),
    current_user: User = Depends(get_current_user),
):
    return await svc.catat(data, current_user.id, enforce_radius=enforce_radius)


@router.get("/", response_model=list[AbsensiResponse])
async def list_absensi(
    dari: date = Query(...),
    sampai: date = Query(...),
    user_id: Optional[int] = Query(None),
    svc: AbsensiService = Depends(_svc),
    _: User = Depends(get_current_user),
):
    if user_id:
        return await svc.list_by_user(user_id, dari, sampai)
    return await svc.list_range(dari, sampai)


@router.get("/rekap", response_model=AbsensiRekapHarian)
async def rekap_harian(
    tanggal: date = Query(default=date.today()),
    svc: AbsensiService = Depends(_svc),
    _: User = Depends(get_current_user),
):
    return await svc.rekap_harian(tanggal)


@router.get("/{absensi_id}", response_model=AbsensiResponse)
async def get_absensi(
    absensi_id: int,
    svc: AbsensiService = Depends(_svc),
    _: User = Depends(get_current_user),
):
    return await svc.get(absensi_id)


@router.patch("/{absensi_id}", response_model=AbsensiResponse)
async def update_absensi(
    absensi_id: int,
    data: AbsensiUpdate,
    svc: AbsensiService = Depends(_svc),
    _: User = Depends(require_roles([UserRole.ADMIN, UserRole.PRODUKSI])),
):
    return await svc.update(absensi_id, data)


@router.delete("/{absensi_id}", status_code=204)
async def delete_absensi(
    absensi_id: int,
    svc: AbsensiService = Depends(_svc),
    _: User = Depends(require_roles([UserRole.ADMIN])),
):
    await svc.delete(absensi_id)
