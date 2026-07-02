from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db, require_roles
from app.models.user import User, UserRole
from app.schemas.return_order import (
    ReturnOrderCreate,
    ReturnOrderResponse,
    ReviewReturnOrderRequest,
)
from app.services.return_order_service import ReturnOrderService

router = APIRouter()


@router.post("/", response_model=ReturnOrderResponse, status_code=status.HTTP_201_CREATED)
async def create_return(
    payload: ReturnOrderCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.DRIVER)),
):
    """
    Driver buat return order.
    Scan barcode per item, tandai SISA atau RUSAK.
    """
    service = ReturnOrderService(db)
    try:
        return await service.create_return(payload, current_user.id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{return_id}/submit", response_model=ReturnOrderResponse)
async def submit_return(
    return_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.DRIVER)),
):
    """Driver submit return order setelah semua item diinput."""
    service = ReturnOrderService(db)
    try:
        return await service.submit_return(return_id, current_user.id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{return_id}/review", response_model=ReturnOrderResponse)
async def review_return(
    return_id: int,
    payload: ReviewReturnOrderRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.INVENTORI)),
):
    """
    Admin/Inventori konfirmasi kondisi tiap item.
    BAIK → unit kembali READY (bisa dijual lagi).
    RUSAK_KONFIRMASI → unit VOID (kerugian tercatat).
    """
    service = ReturnOrderService(db)
    try:
        return await service.review_return(return_id, payload, current_user.id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/{return_id}/summary")
async def return_summary(
    return_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(
        UserRole.ADMIN, UserRole.INVENTORI, UserRole.SHAREHOLDER
    )),
):
    """Summary retur: sisa, rusak, per batch MO."""
    service = ReturnOrderService(db)
    try:
        return await service.get_return_summary(return_id)
    except Exception as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/", response_model=list[ReturnOrderResponse])
async def list_returns(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(
        UserRole.ADMIN, UserRole.INVENTORI, UserRole.DRIVER, UserRole.SHAREHOLDER
    )),
):
    from sqlalchemy import select
    from app.models.return_order import ReturnOrder
    result = await db.execute(select(ReturnOrder).order_by(ReturnOrder.created_at.desc()))
    orders = list(result.scalars().all())
    for o in orders:
        o.total_sisa = sum(1 for i in o.items if i.kategori.value == "sisa")
        o.total_rusak = sum(1 for i in o.items if i.kategori.value == "rusak")
    return orders


@router.get("/{return_id}", response_model=ReturnOrderResponse)
async def get_return(
    return_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(
        UserRole.ADMIN, UserRole.INVENTORI, UserRole.DRIVER
    )),
):
    from sqlalchemy import select
    from app.models.return_order import ReturnOrder
    result = await db.execute(
        select(ReturnOrder).where(ReturnOrder.id == return_id)
    )
    ro = result.scalar_one_or_none()
    if not ro:
        raise HTTPException(status_code=404, detail="Return Order tidak ditemukan")
    ro.total_sisa = sum(1 for i in ro.items if i.kategori.value == "sisa")
    ro.total_rusak = sum(1 for i in ro.items if i.kategori.value == "rusak")
    return ro
