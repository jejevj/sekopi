# SekoPi — Alur Bisnis & Sistem

> Dokumentasi alur lengkap sistem manajemen kopi gerobakan SekoPi.
> Dibuat: 2026-07-03 WIB
> Catatan: **Driver adalah operator gerobak sekaligus kasirnya** — satu orang yang mengambil barang, berjualan, dan mengembalikan sisa.

---

## 1. Alur Utama End-to-End

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        ALUR BISNIS SEKOPI                               │
└─────────────────────────────────────────────────────────────────────────┘

 [INVENTORI]
      │
      ▼
 Tambah Bahan Baku ke Gudang
 (Stok MASUK)
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
      │
      ▼
 Unit berstatus READY di gudang
      │
      ▼
 [DRIVER] Scan Dispatch (READY → DISPATCHED)
      │  - Driver scan barcode tiap cup yang dimuat ke kendaraan
      │  - Sistem tolak jika cup sudah EXPIRED
      │  - Sistem beri WARNING jika expiry ≤ 2 hari
      │
      ▼
 Driver antar ke gerobak
      │
      ▼
 [DRIVER] Scan Deliver (DISPATCHED → DELIVERED)
      │  - Driver konfirmasi stok sudah ada di gerobak
      │
      ▼
 [DRIVER] Scan Sell (DELIVERED → SOLD)
      │  - Driver scan barcode saat pelanggan beli di gerobak
      │  - Driver = operator gerobak sekaligus kasir
      │  - Sistem tolak jika produk EXPIRED
      │  - Record Penjualan otomatis dibuat
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
      │  - BAIK               → unit kembali READY (bisa dijual lagi)
      │  - RUSAK_KONFIRMASI   → unit VOID (kerugian tercatat)
      │
      ▼
 [SHAREHOLDER] Lihat Laporan
      - Pendapatan harian / mingguan / bulanan
      - Estimasi kerugian (expired, rusak, void)
      - Efisiensi per batch produksi
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
    │         │         ├──→ DONE       (produksi selesai)
    │         │         └──→ CANCELLED  (stok MASUK kembali / rollback)
    │         └──→ CANCELLED
    └──→ CANCELLED
```

---

## 3. Status Flow Production Unit (Barcode)

```
  READY
    │
    ├──→ DISPATCHED   (driver scan loading ke kendaraan)
    │         │
    │         ├──→ DELIVERED   (driver scan terima di gerobak)
    │         │         │
    │         │         ├──→ SOLD              (driver scan jual di gerobak)
    │         │         ├──→ RETURNED_GOOD     (driver bawa balik, kondisi baik)
    │         │         │         └──→ READY   (setelah review: konfirmasi BAIK)
    │         │         └──→ RETURNED_DAMAGED  (driver bawa balik, kondisi rusak)
    │         │                   ├──→ READY   (review: ternyata BAIK — salah klaim)
    │         │                   └──→ VOID    (review: RUSAK_KONFIRMASI)
    │         └──→ RETURNED_DAMAGED / RETURNED_GOOD  (belum di-deliver tapi rusak)
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

## 5. Alur Stok Bahan Baku

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

## 6. Cron Jobs Otomatis (Asia/Jakarta)

| Waktu | Job | Aksi |
|-------|-----|------|
| 00:01 | `mark_expired_units` | Tandai unit yang melewati `expiry_date` → `EXPIRED` |
| 07:00 | `expiry_warning_log` | Log warning unit yang akan expired ≤ 2 hari |
| 07:00 | `low_stock_alert` | Log warning bahan baku di bawah `stok_minimum` |

---

## 7. Role & Akses

| Role | Akses Utama |
|------|-------------|
| `admin` | Semua endpoint + manajemen pengguna |
| `produksi` | MO, generate unit, laporan produksi |
| `inventori` | Stok bahan baku, review return, expiry alerts |
| `driver` | Scan dispatch, deliver, **jual (kasir gerobak)**, buat & submit return |
| `shareholder` | Laporan keuangan & kerugian (read-only) |

> **Catatan:** Tidak ada role `kasir` yang terpisah. Driver adalah operator gerobak sekaligus yang melayani transaksi penjualan. Semua aksi kasir (scan jual) dilakukan oleh role `driver`.
