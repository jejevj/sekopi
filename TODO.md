# SekoPi — Frontend TODO

> Dibuat: **2026-07-04 12:49 WIB**
> Last updated: **2026-07-04 14:47 WIB**
> Status legend: `[ ]` belum · `[~]` perlu audit/fix · `[x]` selesai

---

## 🔴 PRIORITAS TINGGI — Alur Produksi Utama

### 1. `/mo/[id].tsx` — Detail Manufacturing Order
- `[~]` File sudah ada (`20.7 KB`) — perlu audit
- `[ ]` Tombol **Confirm MO** (DRAFT → CONFIRMED)
- `[ ]` Tombol **Mulai Produksi** (CONFIRMED → IN_PROGRESS)
- `[ ]` Tombol **Selesai / DONE** (IN_PROGRESS → DONE)
- `[ ]` Tombol **Generate Unit** → redirect ke `/produksi/generate?mo_id=X`
- `[ ]` Tampilan BOM lines (nama bahan, qty rencana vs aktual)
- `[ ]` Guard: tombol Generate hanya muncul jika status = DONE
- `[ ]` Layout full-width

### 2. `/produksi/generate.tsx` — Generate Unit Produksi
- `[~]` File sudah ada (`14.1 KB`) — perlu audit
- `[ ]` Baca `mo_id` dari query param
- `[ ]` Input jumlah aktual, expiry date, harga modal
- `[ ]` Indikator selisih real-time (hijau = sama target, merah = beda)
- `[ ]` Section alasan + kategori selisih — **wajib** jika ada selisih
- `[ ]` Setelah submit: tampilkan daftar barcode unit yang di-generate
- `[ ]` Layout full-width

---

## 🟡 PRIORITAS SEDANG — Kelengkapan Fitur

### 3. `/menu/[id].tsx` — Detail Menu & Manajemen Resep
- `[~]` File sudah ada (`14.5 KB`) — perlu audit
- `[ ]` Edit nama menu & harga jual inline (tanpa modal)
- `[ ]` Daftar semua versi resep dengan badge AKTIF/NONAKTIF
- `[ ]` Tombol **Jadikan Aktif** per versi resep
- `[ ]` Form tambah versi resep baru (expand/collapse)
- `[ ]` Form bahan baku per versi resep (tambah/hapus baris)
- `[ ]` Layout full-width

### 4. `/produksi/index.tsx` — Monitoring Production Unit
- `[~]` File sudah ada (`24 KB`) — perlu audit
- `[ ]` List semua unit dengan urutan FEFO
- `[ ]` Filter by status: READY / DISPATCHED / DELIVERED / SOLD / VOID / EXPIRED
- `[ ]` Badge warna per status
- `[ ]` Kolom hari tersisa + highlight merah jika ≤ 2 hari
- `[ ]` Link ke detail MO dari setiap unit
- `[ ]` Layout full-width

### 5. `/return/index.tsx` — Return Unit
- `[~]` File sudah ada (`17.7 KB`) — perlu audit
- `[ ]` Form scan barcode untuk proses return
- `[ ]` Input alasan return
- `[ ]` List riwayat return (barcode, produk, tanggal, alasan)
- `[ ]` Badge status unit sebelum/sesudah return
- `[ ]` Layout full-width

---

## 🟢 PRIORITAS RENDAH — Data Sudah Ada di Backend

### 6. `/(inventori)/stok` — Histori Stok Semua Bahan
- `[ ]` Cek apakah file sudah ada
- `[ ]` Tabel histori mutasi stok (masuk/keluar, tanggal, keterangan)
- `[ ]` Filter by bahan baku
- `[ ]` Filter by rentang tanggal

### 7. `/(inventori)/expiry` — Expiry Alert
- `[ ]` Cek apakah file sudah ada
- `[ ]` List unit akan expired dalam N hari (default 3)
- `[ ]` List unit sudah expired tapi belum VOID
- `[ ]` Slider/input untuk set threshold hari
- `[ ]` Tombol bulk void untuk unit expired

### 8. `/(admin)/gerobak/saham` — Grup & Saham
- `[ ]` Cek apakah file sudah ada
- `[ ]` List grup gerobak + komposisi saham per anggota
- `[ ]` Form tambah anggota + persentase saham
- `[ ]` Validasi total saham = 100%

### 9. `/(admin)/gerobak/dividen` — Distribusi Dividen
- `[ ]` Cek apakah file sudah ada
- `[ ]` Form hitung dividen dari pendapatan periode
- `[ ]` Preview distribusi per anggota sebelum submit
- `[ ]` Riwayat distribusi dividen

### 10. `/(shareholder)/laporan` — Laporan Shareholder
- `[ ]` Cek apakah file sudah ada
- `[ ]` Summary pendapatan, pengeluaran, profit
- `[ ]` Chart penjualan per periode
- `[ ]` Tabel dividen yang diterima

---

## 📋 Backend — Hal Yang Perlu Dicek

- `[x]` Migration `0001_initial` — selesai
- `[x]` Migration `0002_selisih_produksi` — selesai
- `[x]` Migration `0003_absensi_loading` — **selesai 2026-07-04**
- `[x]` Fix `ProductionUnitResponse` — 2026-07-04
- `[x]` Fix `ExpiryAlertResponse` field mismatch — 2026-07-04
- `[x]` Fix `ScanVoidRequest.alasan` — 2026-07-04
- `[x]` Model + API Absensi (CRUD lengkap) — **2026-07-04**
- `[x]` Model + API Loading Gerobak (scan stok, status machine) — **2026-07-04**
- `[ ]` Cek endpoint `GET /menu/` — pastikan include `resep_list` + `bahan_list`
- `[ ]` Cek endpoint `GET /manufacturing-orders/{id}` — include `bahan_baku_lines`
- `[ ]` Cek endpoint `PATCH /manufacturing-orders/{id}/status`
- `[ ]` Cek endpoint `POST /production-units/generate` — validasi selisih qty

---

## 🗓️ Plan Pengerjaan

```
Sesi 2026-07-04 (1) ✅ SELESAI
├── [x] Fix components/layout/Sidebar.tsx — tambah Menu & Resep
├── [x] Fix menu/index.tsx — layout full-width
├── [x] Fix mo/buat.tsx — layout full-width
└── [x] Fix backend schemas/production_unit.py

Sesi 2026-07-04 (2) ✅ SELESAI
├── [x] Users: ganti native confirm/alert → modal + toast
├── [x] Backend: model + CRUD Absensi
├── [x] Backend: model + CRUD Loading Gerobak (scan barcode)
├── [x] Migration 0003_absensi_loading
└── [x] Frontend: halaman monitoring absensi

Sesi Berikutnya 🔜
├── [1] Audit + fix mo/[id].tsx          ← MULAI DARI SINI
├── [2] Audit produksi/generate.tsx
├── [3] Audit menu/[id].tsx
├── [4] Audit produksi/index.tsx
└── [5] Audit return/index.tsx

Sesi Akhir
├── inventori/stok & expiry
├── gerobak/saham & dividen
└── shareholder/laporan
```

---

> **Standar Layout:** Semua halaman harus menggunakan layout **full-width**
> (`padding: 24`, tanpa `maxWidth` dan `margin: auto`),
> konsisten dengan `bahan-baku/index.tsx` sebagai referensi.
