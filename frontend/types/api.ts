// ── Auth ─────────────────────────────────────────────────────────────────────
export type UserRole = "ADMIN" | "PRODUKSI" | "INVENTORI" | "DRIVER" | "SHAREHOLDER";

export interface User {
  id: number;
  nama: string;
  email: string;
  role: UserRole;
  created_at: string;
}

// ── Manufacturing Order ───────────────────────────────────────────────────────
export type StatusMO = "draft" | "confirmed" | "in_progress" | "done" | "cancelled";

export interface MOBahanBaku {
  id: number;
  bahan_baku_id: number;
  nama_bahan: string;
  satuan: string;
  jumlah_dibutuhkan: number;
}

export interface ManufacturingOrder {
  id: number;
  nomor_mo: string;
  nama_produk: string;
  target_qty: number;
  status: StatusMO;
  bahan_baku: MOBahanBaku[];
  created_at: string;
  updated_at: string;
}

export interface PaginatedResponse<T> {
  total: number;
  page: number;
  per_page: number;
  total_pages: number;
  items: T[];
}

// ── Production Unit ───────────────────────────────────────────────────────────
export type StatusUnit =
  | "ready" | "dispatched" | "delivered" | "sold"
  | "expired" | "void" | "returned_good" | "returned_damaged";

export interface ProductionUnit {
  id: number;
  barcode: string;
  mo_id: number;
  nama_produk: string;
  expiry_date: string;
  harga_modal: number | null;
  status: StatusUnit;
  pengiriman_id: number | null;
  hari_tersisa: number | null;
  is_expiring_soon: boolean;
  is_expired: boolean;
  created_at: string;
}

// ── Penjualan ─────────────────────────────────────────────────────────────────
export interface Penjualan {
  id: number;
  barcode: string;
  nama_produk: string;
  harga: number;
  kasir_id: number;
  sold_at: string;
}

// ── Return Order ──────────────────────────────────────────────────────────────
export type StatusReturn = "draft" | "submitted" | "reviewed";
export type KategoriReturn = "sisa" | "rusak";
export type KondisiKonfirmasi = "baik" | "rusak_konfirmasi" | null;

export interface ReturnItem {
  id: number;
  barcode: string;
  mo_id: number | null;
  kategori: KategoriReturn;
  kondisi_konfirmasi: KondisiKonfirmasi;
  catatan: string | null;
}

export interface ReturnOrder {
  id: number;
  nomor_return: string;
  pengiriman_id: number;
  status: StatusReturn;
  items: ReturnItem[];
  created_at: string;
}

// ── Laporan ───────────────────────────────────────────────────────────────────
export interface PenjualanHarian {
  tanggal: string;
  total_terjual: number;
  total_pendapatan: number;
}

export interface KerugianItem {
  kategori: string;
  jumlah_unit: number;
  estimasi_kerugian: number;
  keterangan: string;
}

export interface BatchProduksiSummary {
  mo_id: number;
  nomor_mo: string;
  nama_produk: string;
  total_diproduksi: number;
  total_terjual: number;
  total_sisa_kembali: number;
  total_rusak: number;
  total_expired: number;
  persentase_terjual: number;
}

export interface LaporanShareholderResponse {
  periode_dari: string;
  periode_sampai: string;
  generated_at: string;
  total_unit_diproduksi: number;
  total_unit_terjual: number;
  total_pendapatan: number;
  rata_rata_pendapatan_harian: number;
  total_unit_expired: number;
  total_unit_rusak: number;
  total_unit_void: number;
  estimasi_kerugian: number;
  persentase_terjual: number;
  persentase_kerugian: number;
  penjualan_harian: PenjualanHarian[];
  by_batch: BatchProduksiSummary[];
}
