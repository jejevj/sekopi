from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field


# ── ResepBahan ──────────────────────────────────────────────
class ResepBahanBase(BaseModel):
    bahan_baku_id: int
    qty_per_unit: float = Field(..., gt=0)
    satuan: str


class ResepBahanCreate(ResepBahanBase):
    pass


class ResepBahanResponse(ResepBahanBase):
    id: int
    nama_bahan: Optional[str] = None

    model_config = {"from_attributes": True}


# ── Resep ───────────────────────────────────────────────────
class ResepCreate(BaseModel):
    nama_versi: str = Field(..., max_length=100)
    catatan: Optional[str] = None
    bahan_list: list[ResepBahanCreate] = Field(..., min_length=1)


class ResepResponse(BaseModel):
    id: int
    menu_id: int
    nama_versi: str
    is_active: bool
    catatan: Optional[str] = None
    bahan_list: list[ResepBahanResponse] = []
    created_at: datetime

    model_config = {"from_attributes": True}


# ── Menu ────────────────────────────────────────────────────
class MenuCreate(BaseModel):
    nama: str = Field(..., max_length=255)
    deskripsi: Optional[str] = None
    harga_jual: float = Field(..., gt=0, description="Harga jual per unit ke pelanggan")
    resep: Optional[ResepCreate] = Field(
        None, description="Opsional: langsung buat resep pertama saat buat menu"
    )


class MenuUpdate(BaseModel):
    nama: Optional[str] = Field(None, max_length=255)
    deskripsi: Optional[str] = None
    harga_jual: Optional[float] = Field(None, gt=0)
    is_active: Optional[bool] = None


class MenuResponse(BaseModel):
    id: int
    nama: str
    deskripsi: Optional[str] = None
    harga_jual: float
    is_active: bool
    resep_list: list[ResepResponse] = []
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class MenuShortResponse(BaseModel):
    """Ringkasan Menu untuk embed di response MO / generate."""
    id: int
    nama: str
    harga_jual: float
    is_active: bool

    model_config = {"from_attributes": True}
