from datetime import datetime
from typing import Optional
from pydantic import BaseModel, field_serializer

from app.core.timezone import to_wib


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

    @field_serializer("sold_at")
    def serialize_sold_at(self, dt: datetime) -> str:
        """Selalu return ISO string dengan offset +07:00."""
        wib = to_wib(dt)
        return wib.isoformat() if wib else ""

    model_config = {"from_attributes": True}


class PenjualanListResponse(BaseModel):
    total: int
    page: int
    per_page: int
    total_pages: int
    items: list[PenjualanListItem]
