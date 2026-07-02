from pydantic import BaseModel
from app.models.stok import TipeTransaksiStok


class BahanBakuBase(BaseModel):
    nama: str
    satuan: str
    stok_minimum: float = 0
    deskripsi: str | None = None


class BahanBakuCreate(BahanBakuBase):
    pass


class BahanBakuResponse(BahanBakuBase):
    id: int

    model_config = {"from_attributes": True}


class StokTransaksiCreate(BaseModel):
    bahan_baku_id: int
    tipe: TipeTransaksiStok
    jumlah: float
    keterangan: str | None = None


class StokTransaksiResponse(StokTransaksiCreate):
    id: int

    model_config = {"from_attributes": True}
