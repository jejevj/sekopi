from datetime import date, datetime
from pydantic import BaseModel, field_validator
from app.models.manufacturing_order import StatusMO


class MOBahanBakuCreate(BaseModel):
    bahan_baku_id: int
    qty_rencana: float
    satuan: str


class MOBahanBakuUpdate(BaseModel):
    qty_aktual: float | None = None


class MOBahanBakuResponse(BaseModel):
    id: int
    bahan_baku_id: int
    qty_rencana: float
    qty_aktual: float | None = None
    satuan: str
    nama_bahan: str | None = None  # populated from join

    model_config = {"from_attributes": True}


class ManufacturingOrderCreate(BaseModel):
    nama_produk: str
    target_qty: float
    satuan: str
    tanggal_rencana: date
    catatan: str | None = None
    bahan_baku_lines: list[MOBahanBakuCreate] = []


class ManufacturingOrderUpdate(BaseModel):
    nama_produk: str | None = None
    target_qty: float | None = None
    satuan: str | None = None
    tanggal_rencana: date | None = None
    catatan: str | None = None


class ManufacturingOrderUpdateStatus(BaseModel):
    status: StatusMO
    catatan: str | None = None
    # Diisi saat status -> DONE, untuk mencatat qty aktual per bahan
    bahan_baku_aktual: list[dict] | None = None


class ManufacturingOrderResponse(BaseModel):
    id: int
    nomor_mo: str
    nama_produk: str
    target_qty: float
    satuan: str
    tanggal_rencana: date
    tanggal_mulai: datetime | None = None
    tanggal_selesai: datetime | None = None
    status: StatusMO
    catatan: str | None = None
    created_by: int
    created_at: datetime
    bahan_baku_lines: list[MOBahanBakuResponse] = []

    model_config = {"from_attributes": True}
