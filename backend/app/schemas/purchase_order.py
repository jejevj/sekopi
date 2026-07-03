from datetime import date, datetime
from pydantic import BaseModel, model_validator
from app.models.purchase_order import StatusPO, MetodeBayar


# ── Supplier ────────────────────────────────────────────────────────────────
class SupplierCreate(BaseModel):
    nama: str
    kontak: str | None = None
    telepon: str | None = None
    email: str | None = None
    alamat: str | None = None
    catatan: str | None = None

class SupplierUpdate(BaseModel):
    nama: str | None = None
    kontak: str | None = None
    telepon: str | None = None
    email: str | None = None
    alamat: str | None = None
    catatan: str | None = None
    is_active: bool | None = None

class SupplierResponse(BaseModel):
    id: int
    nama: str
    kontak: str | None = None
    telepon: str | None = None
    email: str | None = None
    alamat: str | None = None
    catatan: str | None = None
    is_active: bool
    created_at: datetime | None = None
    model_config = {"from_attributes": True}


# ── PO Item ──────────────────────────────────────────────────────────────────
class POItemCreate(BaseModel):
    bahan_baku_id: int
    jumlah: float
    satuan: str
    harga_satuan: float

    @model_validator(mode="after")
    def calc_subtotal(self):
        # subtotal dihitung server-side, tidak perlu dari client
        return self

class POItemResponse(BaseModel):
    id: int
    bahan_baku_id: int
    bahan_baku_nama: str = ""
    jumlah: float
    satuan: str
    harga_satuan: float
    subtotal: float
    model_config = {"from_attributes": True}


# ── Purchase Order ───────────────────────────────────────────────────────────
class POCreate(BaseModel):
    supplier_id: int
    tanggal_invoice: date
    tanggal_jatuh_tempo: date | None = None
    metode_bayar: MetodeBayar = MetodeBayar.TUNAI
    catatan: str | None = None
    items: list[POItemCreate]

    @model_validator(mode="after")
    def validate_tempo(self):
        if self.metode_bayar == MetodeBayar.TEMPO and not self.tanggal_jatuh_tempo:
            raise ValueError("Tagihan tempo wajib mengisi tanggal_jatuh_tempo")
        return self

class POUpdate(BaseModel):
    status: StatusPO | None = None
    tanggal_bayar: date | None = None
    tanggal_jatuh_tempo: date | None = None
    catatan: str | None = None
    metode_bayar: MetodeBayar | None = None

class POSupplierInfo(BaseModel):
    id: int
    nama: str
    model_config = {"from_attributes": True}

class POUserInfo(BaseModel):
    id: int
    full_name: str
    model_config = {"from_attributes": True}

class POResponse(BaseModel):
    id: int
    nomor_po: str
    supplier: POSupplierInfo
    dibuat_user: POUserInfo
    tanggal_invoice: date
    tanggal_jatuh_tempo: date | None = None
    tanggal_bayar: date | None = None
    metode_bayar: MetodeBayar
    status: StatusPO
    total_amount: float
    catatan: str | None = None
    items: list[POItemResponse] = []
    created_at: datetime | None = None
    model_config = {"from_attributes": True}


# ── Laporan Pengeluaran ───────────────────────────────────────────────────────
class PengeluaranPerSupplier(BaseModel):
    supplier_id: int
    supplier_nama: str
    jumlah_po: int
    total_pengeluaran: float
    total_lunas: float
    total_outstanding: float

class PengeluaranPerBahan(BaseModel):
    bahan_baku_id: int
    bahan_baku_nama: str
    total_jumlah: float
    satuan: str
    total_pengeluaran: float

class LaporanPengeluaranResponse(BaseModel):
    periode_dari: date
    periode_sampai: date
    generated_at: datetime
    # Ringkasan
    total_pengeluaran: float           # semua PO berdasar tanggal_invoice
    total_lunas: float                  # PO yang sudah dibayar
    total_outstanding: float            # PO yang belum lunas
    total_jatuh_tempo: float            # PO yang sudah lewat jatuh tempo
    jumlah_po: int
    jumlah_po_outstanding: int
    # Breakdown
    per_supplier: list[PengeluaranPerSupplier]
    per_bahan: list[PengeluaranPerBahan]
    # Daftar PO outstanding untuk monitoring
    po_outstanding: list[POResponse]
