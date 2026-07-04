from datetime import date, datetime
from pydantic import BaseModel, Field
from app.models.manufacturing_order import StatusMO


# ─── MOBahanBaku ─────────────────────────────────────────────────────────────

class MOBahanBakuCreate(BaseModel):
    bahan_baku_id: int
    qty_rencana: float
    qty_per_unit: float | None = None
    satuan: str


class MOBahanBakuUpdate(BaseModel):
    qty_aktual: float | None = None


class MOBahanBakuResponse(BaseModel):
    id: int
    bahan_baku_id: int
    qty_rencana: float
    qty_per_unit: float | None = None
    qty_aktual: float | None = None
    satuan: str
    nama_bahan: str | None = None
    harga_beli_per_satuan: float | None = None

    model_config = {"from_attributes": True}


# ─── MOLine ───────────────────────────────────────────────────────────────────

class MOLineCreate(BaseModel):
    menu_id: int | None = None
    nama_produk: str
    target_qty: float = Field(..., gt=0)
    satuan: str = "unit"
    bahan_baku_lines: list[MOBahanBakuCreate] = []


class MOLineUpdate(BaseModel):
    """Dipakai untuk PATCH satu line (hanya saat MO masih DRAFT)."""
    nama_produk: str | None = None
    target_qty: float | None = None
    satuan: str | None = None
    bahan_baku_lines: list[MOBahanBakuCreate] | None = None  # None = tidak berubah


class MOLineResponse(BaseModel):
    id: int
    menu_id: int | None = None
    nama_produk: str
    target_qty: float
    satuan: str
    created_at: datetime
    bahan_baku_lines: list[MOBahanBakuResponse] = []
    # Estimasi harga modal per unit untuk line ini
    estimasi_harga_modal: float | None = None

    model_config = {"from_attributes": True}


# ─── ManufacturingOrder ───────────────────────────────────────────────────────

class ManufacturingOrderCreate(BaseModel):
    tanggal_rencana: date
    catatan: str | None = None
    lines: list[MOLineCreate] = Field(..., min_length=1, description="Minimal 1 line produk")


class ManufacturingOrderUpdate(BaseModel):
    """Update header MO — hanya saat DRAFT."""
    tanggal_rencana: date | None = None
    catatan: str | None = None


class ManufacturingOrderUpdateStatus(BaseModel):
    status: StatusMO
    catatan: str | None = None
    # Untuk transisi DONE: kirim aktual per bahan per line
    # Format: [{"mo_line_id": 1, "bahan_baku_id": 2, "qty_aktual": 1.5}, ...]
    bahan_baku_aktual: list[dict] | None = None


class UserShortResponse(BaseModel):
    id: int
    full_name: str
    model_config = {"from_attributes": True}


class ManufacturingOrderResponse(BaseModel):
    id: int
    nomor_mo: str
    tanggal_rencana: date
    tanggal_mulai: datetime | None = None
    tanggal_selesai: datetime | None = None
    status: StatusMO
    catatan: str | None = None
    created_by: int
    approved_by: int | None = None
    approved_at: datetime | None = None
    inventori_by: int | None = None
    inventori_at: datetime | None = None
    created_at: datetime
    lines: list[MOLineResponse] = []
    created_by_user: UserShortResponse | None = None
    approved_by_user: UserShortResponse | None = None
    inventori_by_user: UserShortResponse | None = None
    # Total estimasi harga modal gabungan semua line (None jika ada bahan belum ada harga)
    estimasi_harga_modal_total: float | None = None

    model_config = {"from_attributes": True}


# ─── EstimasiHargaModal ───────────────────────────────────────────────────────

class EstimasiHargaModalLineDetail(BaseModel):
    mo_line_id: int
    nama_produk: str
    target_qty: float
    satuan: str
    estimasi_per_unit: float | None
    estimasi_total_line: float | None
    semua_harga_tersedia: bool
    bahan: list[dict]


class EstimasiHargaModalResponse(BaseModel):
    mo_id: int
    nomor_mo: str
    estimasi_total_mo: float | None
    semua_harga_tersedia: bool
    lines: list[EstimasiHargaModalLineDetail]
