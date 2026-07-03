# SekoPi — Changelog

Semua perubahan penting pada proyek ini didokumentasikan di sini.

---

## [Unreleased] — v1.1.0

### 2026-07-03 (Sesi siang, WIB)

#### ✨ Features
- **`47a500d`** `feat(users): lengkapi API PATCH/DELETE/reset-password + buat halaman manajemen pengguna`
  - Endpoint baru: `PATCH /users/{id}` (update nama, role, status aktif)
  - Endpoint baru: `POST /users/{id}/reset-password` (min. 6 karakter)
  - Endpoint baru: `DELETE /users/{id}`
  - Safeguard: admin tidak bisa ubah role/nonaktifkan/hapus akun sendiri
  - `UserRepository` ditambah method `get_by_id()` dan `get_by_email()`
  - Halaman `(admin)/users/index.tsx` — tabel pengguna lengkap dengan:
    - Stats cards (total, aktif, nonaktif, jenis role)
    - Filter search nama/email + dropdown role
    - Avatar inisial berwarna per role
    - 4 tombol aksi per baris: Edit, Reset Password, Toggle Aktif, Hapus
    - Modal tambah/edit pengguna
    - Modal reset password terpisah

#### 🐛 Bugfix
- **`500c8c0`** `fix(router): pindah users.tsx → users/index.tsx`
  - Error Expo Router: _"Found conflicting screens with the same pattern '(admin)/users'"_
  - Root cause: `users.tsx` dan `users/index.tsx` sama-sama resolve ke route `/(admin)/users`
  - Solusi: hapus `users.tsx`, pindahkan konten ke `users/index.tsx`, sesuaikan import path ke `../../../`

- **`21d4b9c`** `fix(router): hapus users.tsx duplikat`

- **`03e392e`** `fix(backend+frontend): rename get → get_by_id di deps.py, hapus KASIR dari dropdown`
  - `deps.py` memanggil `user_repo.get()` yang tidak ada → diganti `user_repo.get_by_id()`
  - Dropdown role UI sebelumnya hardcode `KASIR` yang tidak ada di `UserRole` enum backend
  - Role diselaraskan: `admin`, `produksi`, `inventori`, `driver`, `shareholder`

- **`a1722b5`** `fix(deps): definisikan get_db lokal, hapus import dari session`
  - `ImportError: cannot import name 'get_db' from 'app.db.session'`
  - Root cause: `session.py` hanya export `AsyncSessionLocal`, tidak ada `get_db`
  - Solusi: definisikan `get_db()` sebagai async generator langsung di `deps.py`

---

## [v1.0.0] — 2026-07-03 (Sesi awal)

#### ✅ Fix
- **`38401a6`** `fix: safe barcode generation with DB sequence, add pagination to all list endpoints, add harga_modal to ProductionUnit`
  - Barcode generation diubah dari `COUNT+1` ke `MAX+1` — race-condition safe
  - Semua list endpoint sekarang paginated (`page`, `per_page`, `total_pages`)
  - Field `harga_modal` ditambahkan ke `ProductionUnit`

#### ✨ Features
- **`423cd0e`** `feat: add comprehensive shareholder loss & profit report endpoints`
  - `LaporanShareholderResponse` — laporan lengkap: pendapatan, kerugian, efisiensi
  - Endpoint: `GET /laporan/shareholder`, `/minggu-ini`, `/bulan-ini`
  - Breakdown kerugian per kategori: EXPIRED, RUSAK_KONFIRMASI, VOID_LAINNYA

- **`ddfcd45`** `feat: add Return Order system with damaged confirmation, batch tracking, and stock restoration`
  - Model `ReturnOrder` + `ReturnItem`
  - Status baru di `ProductionUnit`: `RETURNED_GOOD`, `RETURNED_DAMAGED`
  - Flow: Driver buat → Submit → Admin review per item

- **`26bc2c4`** `feat: add APScheduler for automatic daily expiry marking and low stock alerts`
  - `AsyncIOScheduler` dengan timezone `Asia/Jakarta`
  - Cron `mark_expired_units` — jam 00:01 WIB
  - Cron `expiry_warning_log` + `low_stock_alert` — jam 07:00 WIB

- **`1b62c71`** `feat: add expiry_date to ProductionUnit with FEFO sorting, expiry alerts`
  - Field `expiry_date` wajib diisi saat generate unit
  - FEFO sorting di semua query
  - Computed fields: `hari_tersisa`, `is_expiring_soon`, `is_expired`

- **`4d38159`** `feat: add ProductionUnit with barcode tracking, scan endpoints for each stage`
  - Model `ProductionUnit` — 1 record = 1 item fisik
  - Auto-generate barcode: `SKP-YYYYMMDD-XXXX`

- **`dd59f94`** `feat: add Manufacturing Order with BOM, auto stock deduction, and status flow`
  - Model `ManufacturingOrder` + `MOBahanBaku`
  - Status flow: `DRAFT → CONFIRMED → IN_PROGRESS → DONE / CANCELLED`

- **`f1c9999`** `Initial project scaffold`

---

## Status Backlog

### ✅ Selesai
- [x] Backend — Auth (login, JWT, refresh)
- [x] Backend — User CRUD lengkap (list, create, update, delete, reset-password)
- [x] Backend — Manufacturing Order + BOM + cek stok
- [x] Backend — Production Unit + barcode + FEFO
- [x] Backend — Scan flow (dispatch, deliver, sell, void)
- [x] Backend — Return Order (buat, submit, review per item)
- [x] Backend — Laporan Shareholder (harian, mingguan, bulanan)
- [x] Backend — APScheduler (expiry marking, low stock alert)
- [x] Frontend — Login
- [x] Frontend — Layout sidebar admin
- [x] Frontend — Dashboard overview
- [x] Frontend — Manajemen Pengguna (list, tambah, edit, reset password, toggle aktif, hapus)
- [x] Frontend — Bahan Baku (stok inventori)
- [x] Frontend — Gerobak (manajemen gerobak/outlet)
- [x] Frontend — Manufacturing Order (list + buat + status)

### 🔜 Segera (Next Sprint)
- [ ] Frontend — Generate Production Unit + expiry date
- [ ] Frontend — Halaman Expiry Alerts
- [ ] Frontend — Scan dispatch & deliver (Driver)
- [ ] Frontend — Scan sell (Kasir/Driver)
- [ ] Frontend — Return Order (buat + review)
- [ ] Frontend — Laporan Shareholder (chart Recharts)
- [ ] Unit tests untuk critical flows

### 🗓️ Planned
- [ ] Export laporan ke CSV/PDF
- [ ] Push notification (expiry alert via WhatsApp/FCM)
- [ ] Audit log (siapa ubah apa)
- [ ] Redis cache untuk laporan berat
- [ ] Soft delete semua model
