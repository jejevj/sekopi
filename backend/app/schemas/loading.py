from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict

from app.models.loading import StatusLoading


# ── Snap helpers ───────────────────────────────────────────────────────────
class UserSnap(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    full_name: str


class GerobakSnap(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    nama: str


class UnitSnap(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    barcode: str
    nama_menu: str
    expiry_date: Optional[str]


# ── Item schemas ───────────────────────────────────────────────────────────
class LoadingItemResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    production_unit_id: int
    barcode_snapshot: str
    harga_modal_snapshot: float
    unit: Optional[UnitSnap] = None

    @classmethod
    def from_orm_obj(cls, obj):
        pu = obj.production_unit
        unit_snap = None
        if pu:
            unit_snap = UnitSnap(
                id=pu.id,
                barcode=pu.barcode,
                nama_menu=pu.menu_nama if hasattr(pu, "menu_nama") else "",
                expiry_date=pu.expiry_date.isoformat() if pu.expiry_date else None,
            )
        return cls(
            id=obj.id,
            production_unit_id=obj.production_unit_id,
            barcode_snapshot=obj.barcode_snapshot,
            harga_modal_snapshot=float(obj.harga_modal_snapshot),
            unit=unit_snap,
        )


# ── Loading Order schemas ──────────────────────────────────────────────────
class LoadingOrderCreate(BaseModel):
    gerobak_id: int
    driver_id: int
    catatan: Optional[str] = None


class LoadingOrderUpdate(BaseModel):
    status: Optional[StatusLoading] = None
    catatan: Optional[str] = None


class ScanItemRequest(BaseModel):
    barcode: str


class LoadingOrderResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    nomor_loading: str
    status: StatusLoading
    catatan: Optional[str]
    gerobak: GerobakSnap
    driver: UserSnap
    pembuat: UserSnap
    items: list[LoadingItemResponse]
    total_unit: int
    created_at: str
    updated_at: str

    @classmethod
    def from_orm_obj(cls, obj):
        return cls(
            id=obj.id,
            nomor_loading=obj.nomor_loading,
            status=obj.status,
            catatan=obj.catatan,
            gerobak=GerobakSnap.model_validate(obj.gerobak),
            driver=UserSnap.model_validate(obj.driver),
            pembuat=UserSnap.model_validate(obj.pembuat),
            items=[LoadingItemResponse.from_orm_obj(i) for i in obj.items],
            total_unit=len(obj.items),
            created_at=obj.created_at.isoformat(),
            updated_at=obj.updated_at.isoformat(),
        )
