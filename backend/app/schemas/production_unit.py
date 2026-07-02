from datetime import datetime
from pydantic import BaseModel
from app.models.production_unit import StatusUnit


class ProductionUnitResponse(BaseModel):
    id: int
    barcode: str
    mo_id: int
    nama_produk: str
    status: StatusUnit
    pengiriman_id: int | None = None
    dispatched_at: datetime | None = None
    delivered_at: datetime | None = None
    sold_at: datetime | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class GenerateUnitsRequest(BaseModel):
    mo_id: int
    jumlah: int  # berapa unit yang di-generate


class ScanDispatchRequest(BaseModel):
    barcodes: list[str]  # scan multiple saat loading ke kendaraan
    pengiriman_id: int


class ScanDeliverRequest(BaseModel):
    barcodes: list[str]  # scan saat gerobak terima


class ScanSellRequest(BaseModel):
    barcode: str   # scan 1 per 1 saat jual
    harga: float
    catatan: str | None = None


class ScanVoidRequest(BaseModel):
    barcode: str
    alasan: str


class ScanResultResponse(BaseModel):
    barcode: str
    status: str
    message: str
    unit: ProductionUnitResponse | None = None
