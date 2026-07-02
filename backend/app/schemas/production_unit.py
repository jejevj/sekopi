from datetime import datetime, date
from pydantic import BaseModel, field_validator
from app.models.production_unit import StatusUnit


class ProductionUnitResponse(BaseModel):
    id: int
    barcode: str
    mo_id: int
    nama_produk: str
    expiry_date: date
    status: StatusUnit
    pengiriman_id: int | None = None
    dispatched_at: datetime | None = None
    delivered_at: datetime | None = None
    sold_at: datetime | None = None
    created_at: datetime
    # computed fields (populated by service)
    hari_tersisa: int | None = None
    is_expiring_soon: bool = False   # True jika <= 2 hari lagi
    is_expired: bool = False

    model_config = {"from_attributes": True}


class GenerateUnitsRequest(BaseModel):
    mo_id: int
    jumlah: int
    expiry_date: date  # diinput oleh tim produksi

    @field_validator("expiry_date")
    @classmethod
    def expiry_must_be_future(cls, v: date) -> date:
        if v <= date.today():
            raise ValueError("Expiry date harus di masa depan")
        return v


class ScanDispatchRequest(BaseModel):
    barcodes: list[str]
    pengiriman_id: int


class ScanDeliverRequest(BaseModel):
    barcodes: list[str]


class ScanSellRequest(BaseModel):
    barcode: str
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


class ExpiryAlertResponse(BaseModel):
    total_akan_expired: int     # unit yang expired dalam X hari ke depan
    total_sudah_expired: int    # unit yang sudah lewat expiry date
    units_expiring_soon: list[ProductionUnitResponse]
    units_expired: list[ProductionUnitResponse]
