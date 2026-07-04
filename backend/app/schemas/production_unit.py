from datetime import date, datetime
from typing import Optional
from pydantic import BaseModel, Field

from app.models.menu import KategoriSelisih
from app.models.production_unit import StatusUnit


class GenerateUnitsRequest(BaseModel):
    mo_id: int
    jumlah: int = Field(..., gt=0, description="Jumlah unit yang berhasil di-generate (aktual)")
    expiry_date: date
    harga_modal: Optional[float] = Field(None, gt=0)
    # Selisih — wajib diisi jika jumlah != target_qty MO
    alasan_selisih: Optional[str] = Field(
        None,
        description="Wajib diisi jika jumlah aktual berbeda dari target_qty MO"
    )
    kategori_selisih: Optional[KategoriSelisih] = Field(
        None,
        description="Kategori penyebab selisih: human_error | bahan | alat | lainnya"
    )


class ProductionUnitResponse(BaseModel):
    id: int
    barcode: str
    mo_id: int
    nama_produk: str
    expiry_date: date
    harga_modal: Optional[float] = None
    harga_jual: Optional[float] = None
    status: StatusUnit
    pengiriman_id: Optional[int] = None
    dispatched_at: Optional[datetime] = None
    delivered_at: Optional[datetime] = None
    sold_at: Optional[datetime] = None
    returned_at: Optional[datetime] = None
    voided_at: Optional[datetime] = None
    void_reason: Optional[str] = None
    created_at: datetime
    # Kalkulasi margin — dihitung di service layer
    margin: Optional[float] = None
    # Field kalkulasi expiry — diset manual oleh _enrich_unit
    hari_tersisa: Optional[int] = None
    is_expired: Optional[bool] = None
    is_expiring_soon: Optional[bool] = None

    model_config = {"from_attributes": True}


class GenerateBatchResponse(BaseModel):
    id: int
    mo_id: int
    jumlah_target: int
    jumlah_aktual: int
    selisih_qty: int
    alasan_selisih: Optional[str] = None
    kategori_selisih: Optional[KategoriSelisih] = None
    expiry_date: date
    harga_modal: Optional[float] = None
    harga_jual: Optional[float] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class GenerateUnitsResponse(BaseModel):
    """Response lengkap dari endpoint /generate."""
    batch: GenerateBatchResponse
    units: list[ProductionUnitResponse]
    peringatan_selisih: Optional[str] = None


class ExpiryAlertItem(BaseModel):
    barcode: str
    nama_produk: str
    expiry_date: date
    status: StatusUnit
    sisa_hari: int

    model_config = {"from_attributes": True}


class ExpiryAlertResponse(BaseModel):
    # Field cocok dengan yang dikembalikan service get_expiry_alerts
    total_akan_expired: int
    total_sudah_expired: int
    units_expiring_soon: list[ProductionUnitResponse]
    units_expired: list[ProductionUnitResponse]


class PaginatedUnitResponse(BaseModel):
    total: int
    page: int
    per_page: int
    total_pages: int = 1
    items: list[ProductionUnitResponse]


class ScanDispatchRequest(BaseModel):
    barcodes: list[str] = Field(..., min_length=1)
    pengiriman_id: Optional[int] = None


class ScanDeliverRequest(BaseModel):
    barcodes: list[str] = Field(..., min_length=1)


class ScanSellRequest(BaseModel):
    barcode: str
    gerobak_id: Optional[int] = None


class ScanVoidRequest(BaseModel):
    barcode: str
    alasan: Optional[str] = None


class ScanResultResponse(BaseModel):
    barcode: str
    status: str
    message: str
    unit: Optional[ProductionUnitResponse] = None
