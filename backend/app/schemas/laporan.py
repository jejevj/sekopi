from datetime import date, datetime
from pydantic import BaseModel


# ── Penjualan ──────────────────────────────────────────────────────────────────
class PenjualanHarian(BaseModel):
    tanggal: date
    total_terjual: int
    total_pendapatan: float


# ── Kerugian ───────────────────────────────────────────────────────────────────
class KerugianItem(BaseModel):
    kategori: str          # EXPIRED / VOID_RUSAK / VOID_LAINNYA
    jumlah_unit: int
    estimasi_kerugian: float  # jumlah_unit * harga_satuan_rata2
    keterangan: str


class LaporanKerugian(BaseModel):
    periode_dari: date
    periode_sampai: date
    total_unit_expired: int
    total_unit_rusak_konfirmasi: int
    total_unit_void_lainnya: int
    total_unit_kerugian: int
    estimasi_total_kerugian: float
    detail: list[KerugianItem]
    by_batch: list[dict]   # breakdown per MO/batch


# ── Produksi ───────────────────────────────────────────────────────────────────
class BatchProduksiSummary(BaseModel):
    mo_id: int
    nomor_mo: str
    nama_produk: str
    total_diproduksi: int
    total_terjual: int
    total_sisa_kembali: int
    total_rusak: int
    total_expired: int
    persentase_terjual: float


# ── Ringkasan Utama Shareholder ────────────────────────────────────────────────
class LaporanShareholderResponse(BaseModel):
    periode_dari: date
    periode_sampai: date
    generated_at: datetime

    # Penjualan
    total_unit_diproduksi: int
    total_unit_terjual: int
    total_pendapatan: float
    rata_rata_pendapatan_harian: float

    # Kerugian
    total_unit_expired: int
    total_unit_rusak: int
    total_unit_void: int
    estimasi_kerugian: float

    # Efisiensi
    persentase_terjual: float       # terjual / diproduksi * 100
    persentase_kerugian: float      # (expired+rusak+void) / diproduksi * 100

    # Detail
    penjualan_harian: list[PenjualanHarian]
    kerugian_detail: LaporanKerugian
    by_batch: list[BatchProduksiSummary]
