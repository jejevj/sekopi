from datetime import date, timedelta
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db, require_roles
from app.models.purchase_order import StatusPO
from app.models.supplier import Supplier
from app.models.user import User, UserRole
from app.schemas.purchase_order import (
    POCreate, POUpdate, POResponse,
    SupplierCreate, SupplierUpdate, SupplierResponse,
    LaporanPengeluaranResponse,
)
from app.services.purchase_order_service import PurchaseOrderService

router = APIRouter()
INVENTORI_ROLES = (UserRole.ADMIN, UserRole.INVENTORI)


# ── Supplier ────────────────────────────────────────────────────────

@router.get("/suppliers", response_model=list[SupplierResponse])
async def list_suppliers(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(*INVENTORI_ROLES)),
):
    result = await db.execute(select(Supplier).order_by(Supplier.nama))
    return result.scalars().all()


@router.post("/suppliers", response_model=SupplierResponse, status_code=201)
async def create_supplier(
    payload: SupplierCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(*INVENTORI_ROLES)),
):
    s = Supplier(**payload.model_dump())
    db.add(s)
    await db.commit()
    await db.refresh(s)
    return s


@router.patch("/suppliers/{supplier_id}", response_model=SupplierResponse)
async def update_supplier(
    supplier_id: int,
    payload: SupplierUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(*INVENTORI_ROLES)),
):
    s = await db.get(Supplier, supplier_id)
    if not s:
        raise HTTPException(404, "Supplier tidak ditemukan")
    for k, v in payload.model_dump(exclude_none=True).items():
        setattr(s, k, v)
    await db.commit()
    await db.refresh(s)
    return s


# ── Purchase Orders ───────────────────────────────────────────────

@router.get("", response_model=list[POResponse])
async def list_po(
    dari: date | None = Query(None),
    sampai: date | None = Query(None),
    status: StatusPO | None = Query(None),
    supplier_id: int | None = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(*INVENTORI_ROLES)),
):
    svc = PurchaseOrderService(db)
    return await svc.list_po(dari, sampai, status, supplier_id)


@router.post("", response_model=POResponse, status_code=201)
async def create_po(
    payload: POCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(*INVENTORI_ROLES)),
):
    return await PurchaseOrderService(db).create_po(payload, current_user.id)


@router.get("/laporan", response_model=LaporanPengeluaranResponse)
async def laporan_pengeluaran(
    dari: date = Query(..., description="Berdasarkan tanggal_invoice"),
    sampai: date = Query(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(*INVENTORI_ROLES)),
):
    if sampai < dari:
        raise HTTPException(400, "'sampai' tidak boleh sebelum 'dari'")
    return await PurchaseOrderService(db).get_laporan_pengeluaran(dari, sampai)


@router.get("/laporan/bulan-ini", response_model=LaporanPengeluaranResponse)
async def laporan_bulan_ini(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(*INVENTORI_ROLES)),
):
    today = date.today()
    return await PurchaseOrderService(db).get_laporan_pengeluaran(today.replace(day=1), today)


@router.get("/laporan/bulan-lalu", response_model=LaporanPengeluaranResponse)
async def laporan_bulan_lalu(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(*INVENTORI_ROLES)),
):
    today = date.today()
    first_this = today.replace(day=1)
    last_prev = first_this - timedelta(days=1)
    first_prev = last_prev.replace(day=1)
    return await PurchaseOrderService(db).get_laporan_pengeluaran(first_prev, last_prev)


@router.get("/{po_id}", response_model=POResponse)
async def get_po(
    po_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(*INVENTORI_ROLES)),
):
    from app.models.purchase_order import PurchaseOrder
    po = await db.get(PurchaseOrder, po_id)
    if not po:
        raise HTTPException(404, "PO tidak ditemukan")
    return PurchaseOrderService(db)._po_to_response(po)


@router.patch("/{po_id}", response_model=POResponse)
async def update_po(
    po_id: int,
    payload: POUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(*INVENTORI_ROLES)),
):
    try:
        return await PurchaseOrderService(db).update_po(po_id, payload, current_user.id)
    except ValueError as e:
        raise HTTPException(404, str(e))
