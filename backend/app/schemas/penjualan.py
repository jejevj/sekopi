from datetime import datetime
from pydantic import BaseModel


class PenjualanResponse(BaseModel):
    id: int
    production_unit_id: int
    barcode: str
    nama_produk: str
    harga: float
    catatan: str | None = None
    kasir_id: int
    sold_at: datetime

    model_config = {"from_attributes": True}


class PenjualanSummary(BaseModel):
    total_terjual: int
    total_pendapatan: float
    periode: str
