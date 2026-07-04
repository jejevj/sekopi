from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db, require_roles
from app.models.loading import StatusLoading
from app.models.user import User, UserRole
from app.repositories.loading import LoadingRepository
from app.schemas.loading import (
    LoadingOrderCreate, LoadingOrderResponse, LoadingOrderUpdate, ScanItemRequest,
)
from app.services.loading import LoadingService

router = APIRouter()


def _svc(db: Session = Depends(get_db)) -> LoadingService:
    return LoadingService(LoadingRepository(db), db)


# ── CRUD ───────────────────────────────────────────────────────────────────

@router.post("/", response_model=LoadingOrderResponse, status_code=201)
def create_loading(
    data: LoadingOrderCreate,
    svc: LoadingService = Depends(_svc),
    current_user: User = Depends(require_roles([UserRole.ADMIN, UserRole.INVENTORI])),
):
    """Buat loading order baru."""
    return svc.create(data, current_user.id)


@router.get("/", response_model=list[LoadingOrderResponse])
def list_loading(
    gerobak_id: Optional[int] = Query(None),
    status: Optional[StatusLoading] = Query(None),
    svc: LoadingService = Depends(_svc),
    _: User = Depends(get_current_user),
):
    return svc.list_all(gerobak_id=gerobak_id, status=status)


@router.get("/{loading_id}", response_model=LoadingOrderResponse)
def get_loading(
    loading_id: int,
    svc: LoadingService = Depends(_svc),
    _: User = Depends(get_current_user),
):
    return svc.get(loading_id)


@router.patch("/{loading_id}", response_model=LoadingOrderResponse)
def update_loading(
    loading_id: int,
    data: LoadingOrderUpdate,
    svc: LoadingService = Depends(_svc),
    _: User = Depends(require_roles([UserRole.ADMIN, UserRole.INVENTORI])),
):
    """Update status / catatan loading."""
    return svc.update_status(loading_id, data)


@router.delete("/{loading_id}", status_code=204)
def delete_loading(
    loading_id: int,
    svc: LoadingService = Depends(_svc),
    _: User = Depends(require_roles([UserRole.ADMIN])),
):
    """Hapus loading (hanya status DRAFT)."""
    svc.delete(loading_id)


# ── Item scan ──────────────────────────────────────────────────────────────

@router.post("/{loading_id}/scan", response_model=LoadingOrderResponse)
def scan_item(
    loading_id: int,
    req: ScanItemRequest,
    svc: LoadingService = Depends(_svc),
    _: User = Depends(require_roles([UserRole.ADMIN, UserRole.INVENTORI, UserRole.DRIVER])),
):
    """Scan barcode untuk menambah unit ke loading."""
    return svc.scan_item(loading_id, req)


@router.delete("/{loading_id}/items/{item_id}", response_model=LoadingOrderResponse)
def remove_item(
    loading_id: int,
    item_id: int,
    svc: LoadingService = Depends(_svc),
    _: User = Depends(require_roles([UserRole.ADMIN, UserRole.INVENTORI])),
):
    """Hapus item dari loading (hanya DRAFT)."""
    return svc.remove_item(loading_id, item_id)
