from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db, require_roles
from app.models.loading import StatusLoading
from app.models.user import User, UserRole
from app.repositories.loading import LoadingRepository
from app.schemas.loading import (
    LoadingOrderCreate, LoadingOrderResponse, LoadingOrderUpdate, ScanItemRequest,
)
from app.services.loading import LoadingService

router = APIRouter()

LOADING_MANAGERS = (UserRole.ADMIN, UserRole.INVENTORI, UserRole.DRIVER)


def _svc(db: AsyncSession = Depends(get_db)) -> LoadingService:
    return LoadingService(LoadingRepository(db), db)


@router.post("", response_model=LoadingOrderResponse, status_code=201)
async def create_loading(
    data: LoadingOrderCreate,
    svc: LoadingService = Depends(_svc),
    current_user: User = Depends(require_roles(*LOADING_MANAGERS)),
):
    return await svc.create(data, current_user.id)


@router.get("", response_model=list[LoadingOrderResponse])
async def list_loading(
    gerobak_id: Optional[int] = Query(None),
    status: Optional[StatusLoading] = Query(None),
    svc: LoadingService = Depends(_svc),
    current_user: User = Depends(get_current_user),
):
    return await svc.list_all(
        gerobak_id=gerobak_id,
        status=status,
        current_user_id=current_user.id,
        current_user_role=current_user.role,
    )


@router.get("/{loading_id}", response_model=LoadingOrderResponse)
async def get_loading(
    loading_id: int,
    svc: LoadingService = Depends(_svc),
    _: User = Depends(get_current_user),
):
    return await svc.get(loading_id)


@router.patch("/{loading_id}", response_model=LoadingOrderResponse)
async def update_loading(
    loading_id: int,
    data: LoadingOrderUpdate,
    svc: LoadingService = Depends(_svc),
    current_user: User = Depends(require_roles(*LOADING_MANAGERS)),
):
    return await svc.update_status(loading_id, data)


@router.delete("/{loading_id}", status_code=204)
async def delete_loading(
    loading_id: int,
    svc: LoadingService = Depends(_svc),
    _: User = Depends(require_roles(UserRole.ADMIN)),
):
    await svc.delete(loading_id)


@router.post("/{loading_id}/scan", response_model=LoadingOrderResponse)
async def scan_item(
    loading_id: int,
    req: ScanItemRequest,
    svc: LoadingService = Depends(_svc),
    _: User = Depends(require_roles(*LOADING_MANAGERS)),
):
    return await svc.scan_item(loading_id, req)


@router.delete("/{loading_id}/items/{item_id}", response_model=LoadingOrderResponse)
async def remove_item(
    loading_id: int,
    item_id: int,
    svc: LoadingService = Depends(_svc),
    _: User = Depends(require_roles(UserRole.ADMIN, UserRole.INVENTORI)),
):
    return await svc.remove_item(loading_id, item_id)
