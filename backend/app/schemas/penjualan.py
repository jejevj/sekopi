from datetime import datetime
from typing import Optional
from pydantic import BaseModel


class PenjualanListItem(BaseModel):
    id: int
    production_unit_id: int
    barcode: str
    nama_produk: str
    harga: float
    catatan: Optional[str] = None
    sold_at: datetime

    # Kasir / Driver
    kasir_id: int
    kasir_nama: Optional[str] = None

    # Gerobak
    gerobak_id: Optional[int] = None
    gerobak_nama: Optional[str] = None
    gerobak_kode: Optional[str] = None
    gerobak_lokasi: Optional[str] = None

    # Grup Saham
    grup_id: Optional[int] = None
    grup_nama: Optional[str] = None

    model_config = {"from_attributes": True}


class PenjualanListResponse(BaseModel):
    total: int
    page: int
    per_page: int
    total_pages: int
    items: list[PenjualanListItem]
