from pydantic import BaseModel
from app.models.produksi import StatusProduksi


class ProduksiCreate(BaseModel):
    nama_batch: str
    jumlah_output: float
    satuan_output: str
    catatan: str | None = None


class ProduksiUpdate(BaseModel):
    status: StatusProduksi | None = None
    catatan: str | None = None


class ProduksiResponse(ProduksiCreate):
    id: int
    status: StatusProduksi

    model_config = {"from_attributes": True}
