from datetime import datetime
from pydantic import BaseModel
from app.models.stok import TipeTransaksiStok


class BahanBakuBase(BaseModel):
    nama: str
    satuan: str
    satuan_display: str | None = None
    konversi_factor: float | None = None
    stok_minimum: float = 0
    deskripsi: str | None = None


class BahanBakuCreate(BahanBakuBase):
    pass


class BahanBakuUpdate(BaseModel):
    nama: str | None = None
    satuan: str | None = None
    satuan_display: str | None = None
    konversi_factor: float | None = None
    stok_minimum: float | None = None
    deskripsi: str | None = None


class BahanBakuResponse(BahanBakuBase):
    id: int
    saldo: float = 0.0  # dihitung realtime, bukan dari DB
    created_at: datetime | None = None

    model_config = {"from_attributes": True}


class StokTransaksiCreate(BaseModel):
    bahan_baku_id: int
    tipe: TipeTransaksiStok
    jumlah: float
    keterangan: str | None = None


class StokTransaksiResponse(StokTransaksiCreate):
    id: int
    created_at: datetime | None = None

    model_config = {"from_attributes": True}


class StokHistoriResponse(BaseModel):
    id: int
    bahan_baku_id: int
    tipe: TipeTransaksiStok
    jumlah: float
    keterangan: str | None = None
    created_at: datetime | None = None

    model_config = {"from_attributes": True}
