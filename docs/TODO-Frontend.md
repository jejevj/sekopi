# SekoPi — Frontend TODO

> Strategy: **Web-first** (Expo Router + Shadcn UI), lalu port ke Android (React Native Reusables + NativeWind).
> Last updated: 2026-07-03 WIB

---

## Stack Web (Phase 1)

| Layer | Teknologi |
|-------|-----------|
| Framework | Expo SDK 52 + Expo Router v4 (web target) |
| UI Components | Shadcn UI (copy-paste, Radix UI primitives) |
| Styling | Tailwind CSS v4 via NativeWind |
| State / Server | TanStack Query v5 (data fetching + caching) |
| HTTP Client | Axios |
| Form | React Hook Form + Zod |
| Charts | Recharts (laporan shareholder) |
| Auth | JWT di localStorage / SecureStore |
| Icons | Lucide React |
| Notif Toast | Sonner |

---

## Struktur Direktori (Web)

```
frontend/
├── app/
│   ├── _layout.tsx
│   ├── index.tsx
│   ├── (auth)/
│   │   └── login.tsx             ✅ Selesai
│   ├── (admin)/
│   │   ├── _layout.tsx           ✅ Selesai
│   │   ├── dashboard.tsx         ✅ Selesai
│   │   ├── mo/
│   │   │   ├── index.tsx         ✅ Selesai
│   │   │   ├── [id].tsx          🔜 Planned
│   │   │   └── buat.tsx          ✅ Selesai
│   │   ├── produksi/
│   │   │   ├── index.tsx         🔜 Next
│   │   │   └── generate.tsx      🔜 Next
│   │   ├── bahan-baku/
│   │   │   └── index.tsx         ✅ Selesai
│   │   ├── gerobak/
│   │   │   └── index.tsx         ✅ Selesai
│   │   ├── pembelian/
│   │   │   └── index.tsx         ✅ Selesai
│   │   ├── return/
│   │   │   ├── index.tsx         🔜 Next
│   │   │   └── [id].tsx          🔜 Next
│   │   └── users/
│   │       └── index.tsx         ✅ Selesai
│   ├── (inventori)/
│   │   ├── _layout.tsx
│   │   ├── stok.tsx              🔜 Next
│   │   └── expiry.tsx            🔜 Next
│   ├── (driver)/
│   │   ├── _layout.tsx
│   │   ├── pengiriman.tsx        🔜 Next
│   │   └── return.tsx            🔜 Next
│   └── (shareholder)/
│       ├── _layout.tsx
│       └── laporan.tsx           🔜 Next
├── components/
│   ├── layout/
│   │   ├── Sidebar.tsx           ✅ Selesai
│   │   ├── Navbar.tsx            ✅ Selesai
│   │   └── AuthGuard.tsx         ✅ Selesai
│   └── shared/
│       ├── StatusBadge.tsx
│       ├── PaginatedTable.tsx
│       ├── BarcodeInput.tsx
│       └── LaporanChart.tsx
├── lib/
│   ├── api.ts                    ✅ Selesai
│   ├── auth.ts                   ✅ Selesai
│   └── utils.ts
└── stores/
    └── authStore.ts              ✅ Selesai
```

---

## Phase 1 — Web (Prioritas)

### 🔐 Auth
- [x] Setup Axios instance dengan base URL + Bearer token interceptor
- [x] Halaman login (`/login`) — form email + password
- [x] Auto redirect ke dashboard sesuai role setelah login
- [x] Logout + clear token
- [x] `AuthGuard` component — proteksi semua route
- [ ] Refresh token otomatis jika 401

### 🧭 Layout
- [x] Root layout dengan sidebar navigasi per role
- [x] Navbar atas dengan nama user + tombol logout
- [ ] Sidebar collapse di mobile web
- [ ] Toast notification (Sonner) untuk feedback aksi

### 👤 Manajemen User (Admin)
- [x] List user + role + status aktif
- [x] Form buat user baru (email, nama, role, password)
- [x] Edit user (nama, role)
- [x] Toggle aktif / nonaktif
- [x] Reset password
- [x] Hapus user
- [x] Filter search nama/email + filter role
- [x] Stats card (total, aktif, nonaktif, jenis role)

### 📋 Manufacturing Order (Admin / Produksi)
- [x] Halaman list MO — tabel paginated, filter by status
- [x] Form buat MO baru — input nama produk, target qty, tanggal
- [ ] Section BOM di form — tambah/hapus bahan baku dinamis
- [ ] `GET /cek-stok` — tampilkan warning realtime jika stok kurang
- [ ] Tombol update status MO (DRAFT → CONFIRMED → IN_PROGRESS → DONE)
- [ ] Detail MO — lihat BOM, list unit yang di-generate

### 🏷️ Production Unit & Barcode (Admin / Produksi)
- [ ] Halaman generate unit — input MO, jumlah, expiry_date, harga_modal
- [ ] List unit per MO — tabel FEFO, paginated
- [ ] Halaman expiry alerts — card unit hampir & sudah expired
- [ ] `BarcodeInput.tsx` — support keyboard input dari scanner fisik

### 🚚 Pengiriman & Scan (Driver)
- [ ] List pengiriman aktif driver
- [ ] Scan dispatch — input barcode satu per satu atau bulk
- [ ] Scan deliver — konfirmasi terima di gerobak
- [ ] Feedback per scan: ✅ OK / ❌ Error / ⚠️ Warning expiry

### ☕ Scan Jual (Driver/Kasir)
- [ ] Halaman scan sell — input barcode → tampil info produk → konfirmasi harga
- [ ] Feedback langsung: nama produk, expiry, status
- [ ] Riwayat penjualan hari ini

### 📦 Return Order (Driver + Admin/Inventori)
- [ ] Driver: buat return order, scan barcode sisa & rusak, submit
- [ ] Admin/Inventori: list return pending review
- [ ] Review per item — dropdown: BAIK / RUSAK_KONFIRMASI
- [ ] Summary return per batch setelah review selesai

### 📊 Laporan Shareholder
- [ ] Date range picker (dari — sampai)
- [ ] Shortcut tombol: Minggu ini / Bulan ini
- [ ] Card metrics: Total Produksi, Terjual, Pendapatan, Estimasi Kerugian
- [ ] Grafik line chart — pendapatan harian (Recharts)
- [ ] Grafik bar chart — breakdown kerugian (Expired / Rusak / Void)
- [ ] Tabel efisiensi per batch MO

### 🏦 Stok Inventori
- [x] List bahan baku + saldo stok saat ini
- [ ] Form tambah stok (MASUK)
- [ ] Badge warning jika saldo < `stok_minimum`

---

## ⚠️ Catatan Teknis & Gotcha

### Expo Router — Route Conflict
> Jangan buat `(group)/nama.tsx` **dan** `(group)/nama/index.tsx` sekaligus.
> Keduanya resolve ke route yang sama dan akan crash dengan error:
> _"Found conflicting screens with the same pattern"_
> **Aturan:** Selalu pakai folder `nama/index.tsx` jika ada kemungkinan subfolder di masa depan.

### UserRole Enum
> Role yang valid di backend: `admin`, `produksi`, `inventori`, `driver`, `shareholder` (huruf kecil semua).
> **Tidak ada** `kasir`. Pastikan dropdown UI selalu sinkron dengan enum ini.

### get_db di deps.py
> `session.py` hanya export `AsyncSessionLocal`, **bukan** `get_db`.
> `get_db` didefinisikan sebagai async generator di `deps.py`:
> ```python
> async def get_db() -> AsyncGenerator[AsyncSession, None]:
>     async with AsyncSessionLocal() as session:
>         yield session
> ```

---

## Phase 2 — Android (Setelah Web Selesai)

> Port dari web ke native menggunakan **React Native Reusables** + NativeWind.

### Halaman Priority Android
- [ ] Login
- [ ] Driver: scan dispatch & deliver (kamera barcode via `expo-camera`)
- [ ] Driver/Kasir: scan sell
- [ ] Driver: buat & submit return
- [ ] Expiry alerts

### Native-only Features
- [ ] Barcode scanner via `expo-barcode-scanner` / `expo-camera`
- [ ] Push notification ekspiry via `expo-notifications`
- [ ] Offline queue scan jika internet putus

---

## Konvensi Koding

```ts
// Naming
components/  → PascalCase  (BarcodeInput.tsx)
hooks/       → camelCase   (useMO.ts)
lib/         → camelCase   (api.ts)
app/         → kebab-case  (buat-mo.tsx)

// API calls — selalu via TanStack Query
const { data, isLoading } = useQuery({
  queryKey: ['mo', id],
  queryFn: () => api.get(`/manufacturing-orders/${id}`),
})

// Format rupiah
formatRupiah(15000) // → "Rp 15.000"

// Status badge warna
READY            → blue
DISPATCHED       → yellow
DELIVERED        → orange
SOLD             → green
EXPIRED          → red
VOID             → gray
RETURNED_GOOD    → teal
RETURNED_DAMAGED → red
```

---

## Urutan Pengerjaan yang Disarankan

```
1.  ✅ Setup project + Axios + Auth (login, guard, token)
2.  ✅ Layout sidebar per role
3.  ✅ Dashboard overview
4.  ✅ Manajemen User (CRUD lengkap)
5.  ✅ Bahan Baku + Stok
6.  ✅ Gerobak
7.  ✅ Manufacturing Order (list + buat)
8.     Generate unit + expiry alerts          ← NEXT
9.     Scan dispatch & deliver (driver)
10.    Scan sell
11.    Return order (driver + review admin)
12.    Laporan shareholder (chart)
---- Phase 2 ----
13.    Setup native components
14.    Port halaman driver & kasir ke Android
15.    Barcode kamera
16.    Push notification
```
