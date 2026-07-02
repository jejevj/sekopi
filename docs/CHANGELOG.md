# SekoPi — Changelog

Semua perubahan penting pada proyek ini didokumentasikan di sini.

---

## [Unreleased] — Backend v1.0.0

### 2026-07-03 (Session malam, WIB)

#### ✅ Fix
- **`38401a6`** `fix: safe barcode generation with DB sequence, add pagination to all list endpoints, add harga_modal to ProductionUnit`
  - Barcode generation diubah dari `COUNT+1` ke `MAX+1` — race-condition safe
  - Semua list endpoint sekarang paginated (`page`, `per_page`, `total_pages`)
  - Field `harga_modal` ditambahkan ke `ProductionUnit` untuk kalkulasi kerugian riil
  - `LaporanService` prioritas pakai `harga_modal`, fallback ke avg harga jual

#### ✨ Features
- **`423cd0e`** `feat: add comprehensive shareholder loss & profit report endpoints`
  - `LaporanShareholderResponse` — laporan lengkap: pendapatan, kerugian, efisiensi
  - Endpoint: `GET /laporan/shareholder`, `/minggu-ini`, `/bulan-ini`
  - Breakdown kerugian per kategori: EXPIRED, RUSAK_KONFIRMASI, VOID_LAINNYA
  - Breakdown efisiensi per batch MO

- **`ddfcd45`** `feat: add Return Order system with damaged confirmation, batch tracking, and stock restoration`
  - Model `ReturnOrder` + `ReturnItem`
  - Status baru di `ProductionUnit`: `RETURNED_GOOD`, `RETURNED_DAMAGED`
  - Flow: Driver buat → Submit → Admin review per item
  - Konfirmasi `BAIK` → unit kembali `READY`; `RUSAK_KONFIRMASI` → unit `VOID`
  - Summary retur per batch MO

- **`26bc2c4`** `feat: add APScheduler for automatic daily expiry marking and low stock alerts`
  - `AsyncIOScheduler` dengan timezone `Asia/Jakarta`
  - Cron `mark_expired_units` — jam 00:01 WIB
  - Cron `expiry_warning_log` — jam 07:00 WIB
  - Cron `low_stock_alert` — jam 07:00 WIB
  - Admin endpoint: list jobs + manual trigger per job

- **`1b62c71`** `feat: add expiry_date to ProductionUnit with FEFO sorting, expiry alerts, fix AsyncStorage typo`
  - Field `expiry_date` wajib diisi saat generate unit
  - FEFO sorting di semua query (expiry terdekat duluan)
  - `GET /expiry-alerts` — dashboard expired & hampir expired
  - `POST /trigger-mark-expired` — manual trigger
  - Fix typo `AsyncStorage` → `AsyncSession` di endpoint void
  - Computed fields di response: `hari_tersisa`, `is_expiring_soon`, `is_expired`

- **`4d381590`** `feat: add ProductionUnit with barcode tracking, scan endpoints for each stage`
  - Model `ProductionUnit` — 1 record = 1 item fisik
  - Model `Penjualan` — transaksi per scan jual
  - Auto-generate barcode: `SKP-YYYYMMDD-XXXX`
  - Endpoint scan: `dispatch`, `deliver`, `sell`, `void`
  - `GET /penjualan/summary` — total penjualan & pendapatan per hari

- **`dd59f94`** `feat: add Manufacturing Order with BOM, auto stock deduction, and status flow`
  - Model `ManufacturingOrder` + `MOBahanBaku`
  - Auto-generate nomor MO: `MO-YYYYMMDD-XXX`
  - Status flow: `DRAFT → CONFIRMED → IN_PROGRESS → DONE / CANCELLED`
  - Auto stok KELUAR saat `IN_PROGRESS`, rollback stok jika `CANCELLED`
  - `GET /cek-stok` — cek ketersediaan bahan sebelum konfirmasi

- **`31d1a87`** `fix: resolve circular import by separating Base from model imports`

- **`f1c9999`** `Initial project scaffold: README, backend & frontend structure`

---

## Status Backlog

### 🔜 Segera (Next Sprint)
- [ ] Frontend — Login & Dashboard
- [ ] Frontend — Halaman MO & Generate Unit
- [ ] Frontend — Scanner barcode (mobile-friendly)
- [ ] Frontend — Laporan Shareholder
- [ ] Unit tests untuk critical flows

### 🗓️ Planned
- [ ] Export laporan ke CSV/PDF
- [ ] Push notification (expiry alert via WhatsApp/FCM)
- [ ] Audit log (siapa ubah apa)
- [ ] Redis cache untuk laporan berat
- [ ] Soft delete semua model
