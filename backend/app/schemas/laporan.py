from datetime import date, datetime
from pydantic import BaseModel


# ── Penjualan ──────────────────────────────────────────────────────────────────
class PenjualanHarian(BaseModel):
    tanggal: date
    total_terjual: int
    total_pendapatan: float


# ── Kerugian ───────────────────────────────────────────────────────────────────
class KerugianItem(BaseModel):
    kategori: str
    jumlah_unit: int
    estimasi_kerugian: float
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
    by_batch: list[dict]


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


# ── Per Gerobak (untuk laporan per grup) ──────────────────────────────────────
class PenjualanPerGerobak(BaseModel):
    gerobak_id: int
    gerobak_nama: str
    gerobak_kode: str
    total_terjual: int
    total_pendapatan: float
    persentase_dari_total: float


# ── Laporan Umum (ADMIN) ───────────────────────────────────────────────────────
class LaporanUmumResponse(BaseModel):
    periode_dari: date
    periode_sampai: date
    generated_at: datetime

    total_unit_diproduksi: int
    total_unit_terjual: int
    total_pendapatan: float
    rata_rata_pendapatan_harian: float

    total_unit_expired: int
    total_unit_rusak: int
    total_unit_void: int
    estimasi_kerugian: float

    persentase_terjual: float
    persentase_kerugian: float

    penjualan_harian: list[PenjualanHarian]
    penjualan_per_gerobak: list[PenjualanPerGerobak]
    kerugian_detail: LaporanKerugian
    by_batch: list[BatchProduksiSummary]


# ── Laporan Shareholder (per grup) ─────────────────────────────────────────────
class LaporanShareholderResponse(BaseModel):
    periode_dari: date
    periode_sampai: date
    generated_at: datetime

    # Info grup
    shareholder_group_id: int | None = None
    shareholder_group_nama: str | None = None
    gerobaks: list[str] = []   # nama gerobak yang masuk grup ini

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
    persentase_terjual: float
    persentase_kerugian: float

    # Detail
    penjualan_harian: list[PenjualanHarian]
    penjualan_per_gerobak: list[PenjualanPerGerobak]
    kerugian_detail: LaporanKerugian
    by_batch: list[BatchProduksiSummary]
