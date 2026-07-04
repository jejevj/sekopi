# SekoPi — Alur Bisnis & Sistem

> Dokumentasi alur lengkap sistem manajemen kopi gerobakan SekoPi.
> Dibuat: 2026-07-03 WIB
> Last updated: **2026-07-04 19:31 WIB**
> Catatan: **Driver adalah operator gerobak sekaligus kasirnya** — satu orang yang mengambil barang, berjualan, dan mengembalikan sisa.

---

## 1. Alur Utama End-to-End

```
┌───────────────────────────────────────────────────────────────────────────┐
│                        ALUR BISNIS SEKOPI                               │
└───────────────────────────────────────────────────────────────────────────┘

 [INVENTORI]
      │
      ▼
 Tambah Bahan Baku ke Gudang
 (Stok MASUK → tabel `stok`, tipe=MASUK)
      │
      ▼
 [PRODUKSI] Buat Manufacturing Order (MO)
      │  - Input nama produk, target qty, tanggal
      │  - Input Bill of Materials (BOM): bahan + qty
      │
      ▼
 Konfirmasi MO (DRAFT → CONFIRMED)
      │  - Sistem cek saldo stok semua bahan
      │  - Tolak jika stok tidak cukup
      │
      ▼
 Mulai Produksi (CONFIRMED → IN_PROGRESS)
      │  - Stok bahan baku otomatis KELUAR dari gudang
      │
      ▼
 Produksi Selesai (IN_PROGRESS → DONE)
      │
      ▼
 [PRODUKSI] Generate Barcode Unit
      │  - Input: jumlah unit, expiry_date, harga_modal
      │  - Sistem generate barcode unik: SKP-YYYYMMDD-XXXX
      │  - Setiap cup = 1 record ProductionUnit
      │  - harga_jual diisi dari menu.harga_jual saat generate
      │
      ▼
 Unit berstatus READY di gudang
      │
      ▼
 [DRIVER] Loading Order — Scan Dispatch (READY → DISPATCHED)
      │  - Driver buat LoadingOrder baru
      │  - Scan barcode tiap cup yang dimuat ke kendaraan
      │  - Sistem tolak jika cup EXPIRED
      │  - Sistem beri WARNING jika expiry ≤ 2 hari
      │  - Absensi driver otomatis tercatat (HADIR)
      │
      ▼
 [DRIVER] Scan Deliver (DISPATCHED → DELIVERED)
      │  - Driver konfirmasi stok sudah ada di gerobak
      │  - `current_gerobak_id` & `current_driver_id` diisi di ProductionUnit
      │
      ▼
 [DRIVER] Scan Sell (DELIVERED → SOLD)
      │  - Driver scan barcode saat pelanggan beli
      │  - Sistem tolak jika produk EXPIRED
      │  - Record `penjualan` dibuat otomatis:
      │      └─ barcode, nama_produk, harga (dari harga_jual)
      │      └─ kasir_id = driver yang scan
      │      └─ gerobak_id = gerobak tempat jual
      │      └─ sold_at = timestamp WIB (Asia/Jakarta)
      │  - `current_gerobak_id` & `current_driver_id` di-clear
      │
      ▼
 ─────── AKHIR HARI ───────
      │
      ▼
 [DRIVER] Buat Return Order
      │  - Scan barcode sisa & rusak yang dibawa balik
      │  - Tandai tiap item: SISA atau RUSAK
      │
      ▼
 [DRIVER] Submit Return
      │
      ▼
 [INVENTORI/ADMIN] Review Return
      │  - Per item: konfirmasi BAIK atau RUSAK_KONFIRMASI
      │  - BAIK             → unit kembali READY (bisa dijual lagi)
      │  - RUSAK_KONFIRMASI → unit VOID (kerugian tercatat)
      │
      ▼
 [ADMIN/SHAREHOLDER] Lihat Laporan Penjualan
      - Filter: rentang datetime WIB (jam & menit), gerobak, grup saham
      - Tampil: gerobak tempat jual, nama driver, grup saham
      - Ringkasan: omzet per gerobak, per produk
      - Export CSV: termasuk kolom gerobak, driver, grup saham
```

---

## 2. Status Flow Manufacturing Order (MO)

```
  DRAFT
    │
    ├──→ CONFIRMED  (cek stok, semua bahan harus cukup)
    │         │
    │         ├──→ IN_PROGRESS  (stok bahan KELUAR otomatis)
    │         │         │
    │         │         ├──→ DONE       (produksi selesai, siap generate unit)
    │         │         └──→ CANCELLED  (stok MASUK kembali / rollback)
    │         └──→ CANCELLED
    └──→ CANCELLED
```

---

## 3. Status Flow Production Unit (Barcode)

```
  READY
    │
    ├──→ DISPATCHED   (driver scan loading ke kendaraan via LoadingOrder)
    │         │
    │         ├──→ DELIVERED   (driver konfirmasi terima di gerobak)
    │         │         │
    │         │         ├──→ SOLD              (scan jual → record penjualan dibuat)
    │         │         ├──→ RETURNED_GOOD     (bawa balik, kondisi baik)
    │         │         │         └──→ READY   (review: konfirmasi BAIK)
    │         │         └──→ RETURNED_DAMAGED  (bawa balik, kondisi rusak)
    │         │                   ├──→ READY   (review: ternyata BAIK)
    │         │                   └──→ VOID    (review: RUSAK_KONFIRMASI)
    │         └──→ RETURNED_DAMAGED / RETURNED_GOOD  (sebelum di-deliver)
    ├──→ EXPIRED  (melewati expiry_date, ditandai cron 00:01 WIB)
    └──→ VOID     (admin/produksi void manual)
```

---

## 4. Status Flow Return Order

```
  DRAFT      (driver input item)
    │
    ▼
  SUBMITTED  (driver submit, tunggu review)
    │
    ▼
  REVIEWED   (admin/inventori konfirmasi tiap item)
```

---

## 5. Status Flow Loading Order

```
  OPEN       (driver buat loading, scan unit satu per satu)
    │
    ▼
  DISPATCHED (semua unit sudah di-scan dispatch)
    │
    ▼
  DELIVERED  (driver konfirmasi semua stok sudah di gerobak)
    │
    ▼
  CLOSED     (hari selesai, return sudah direview)
```

---

## 6. Alur Stok Bahan Baku

```
  Inventori tambah stok
        │
        ▼
  Stok MASUK (tipe = MASUK)
        │
  Saldo = Σ MASUK - Σ KELUAR
        │
        ▼
  MO status → IN_PROGRESS
        │
        ▼
  Stok KELUAR otomatis per bahan di BOM
        │
        ▼
  Jika MO CANCELLED dari IN_PROGRESS:
  Stok MASUK kembali (rollback)
```

---

## 7. Alur Pencatatan Penjualan

```
  Driver scan barcode unit (status DELIVERED)
        │
        ▼
  Sistem validasi:
  ├── Unit EXPIRED? → TOLAK
  └── Unit valid → LANJUT
        │
        ▼
  ProductionUnit.status → SOLD
  ProductionUnit.sold_at = now (UTC, simpan ke DB)
  ProductionUnit.current_gerobak_id = NULL (di-clear)
  ProductionUnit.current_driver_id  = NULL (di-clear)
        │
        ▼
  INSERT INTO penjualan:
  ├── production_unit_id  = unit.id
  ├── barcode             = unit.barcode
  ├── nama_produk         = unit.nama_produk
  ├── harga               = unit.harga_jual
  ├── kasir_id            = driver.id
  ├── gerobak_id          = driver.current_gerobak_id (sebelum di-clear)
  └── sold_at             = timestamp UTC (response di-convert ke WIB +07:00)
        │
        ▼
  Response API GET /penjualan/:
  ├── sold_at         → ISO 8601 dengan offset +07:00
  ├── gerobak_nama    → join tabel gerobak
  ├── kasir_nama      → join tabel users
  └── grup_nama       → join shareholder_groups via gerobak
```

---

## 8. Cron Jobs Otomatis (Asia/Jakarta)

| Waktu | Job | Aksi |
|-------|-----|------|
| 00:01 | `mark_expired_units` | Tandai unit yang melewati `expiry_date` → `EXPIRED` |
| 07:00 | `expiry_warning_log` | Log warning unit yang akan expired ≤ 2 hari |
| 07:00 | `low_stock_alert` | Log warning bahan baku di bawah `stok_minimum` |

---

## 9. Role & Akses

| Role | Akses Utama |
|------|-------------|
| `admin` | Semua endpoint + manajemen pengguna + laporan lengkap |
| `produksi` | MO, generate unit, laporan produksi |
| `inventori` | Stok bahan baku, review return, expiry alerts |
| `driver` | Loading order, scan dispatch/deliver/**jual (kasir gerobak)**, buat & submit return, absensi |
| `shareholder` | Laporan keuangan & kerugian (read-only, filter by grup sendiri) |

> **Catatan:** Tidak ada role `kasir` yang terpisah. Driver adalah operator gerobak sekaligus yang melayani transaksi penjualan. Semua aksi kasir (scan jual) dilakukan oleh role `driver`.

---

## 10. Timezone

- Semua data tersimpan di DB dalam **UTC**
- Semua response API datetime menggunakan **ISO 8601 dengan offset `+07:00`** (Asia/Jakarta)
- Helper terpusat: `backend/app/core/timezone.py`
  - `to_wib(dt)` — konversi UTC/naive → WIB
  - `now_wib()` — waktu sekarang dalam WIB
  - `parse_datetime_wib(s)` — parse input string dari frontend (support `YYYY-MM-DD`, `YYYY-MM-DDTHH:mm`, dengan/tanpa offset)
- Frontend selalu render waktu dengan `timeZone: 'Asia/Jakarta'`
- Filter laporan menggunakan input `datetime-local` (bukan hanya `date`)
