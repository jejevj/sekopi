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
├── app/                          # Expo Router file-based routing
│   ├── _layout.tsx               # Root layout + auth guard
│   ├── index.tsx                 # Redirect ke login atau dashboard
│   ├── (auth)/
│   │   └── login.tsx             # Halaman login
│   ├── (admin)/
│   │   ├── _layout.tsx           # Sidebar admin layout
│   │   ├── dashboard.tsx         # Overview metrics
│   │   ├── mo/
│   │   │   ├── index.tsx         # List MO
│   │   │   ├── [id].tsx          # Detail MO
│   │   │   └── buat.tsx          # Form buat MO + BOM
│   │   ├── produksi/
│   │   │   ├── index.tsx         # List ProductionUnit
│   │   │   └── generate.tsx      # Generate unit dari MO
│   │   ├── return/
│   │   │   ├── index.tsx         # List return orders
│   │   │   └── [id].tsx          # Review return per item
│   │   └── users.tsx             # Manajemen user
│   ├── (inventori)/
│   │   ├── _layout.tsx
│   │   ├── stok.tsx              # Daftar stok + tambah
│   │   └── expiry.tsx            # Expiry alerts dashboard
│   ├── (driver)/
│   │   ├── _layout.tsx
│   │   ├── pengiriman.tsx        # List pengiriman aktif
│   │   └── return.tsx            # Buat return order
│   ├── (kasir)/
│   │   ├── _layout.tsx
│   │   └── scan.tsx              # Scan jual (web cam / input)
│   └── (shareholder)/
│       ├── _layout.tsx
│       └── laporan.tsx           # Dashboard laporan lengkap
├── components/
│   ├── ui/                       # Shadcn components
│   │   ├── button.tsx
│   │   ├── card.tsx
│   │   ├── dialog.tsx
│   │   ├── input.tsx
│   │   ├── table.tsx
│   │   ├── badge.tsx
│   │   ├── toast.tsx
│   │   └── ...                   # dst sesuai kebutuhan
│   ├── layout/
│   │   ├── Sidebar.tsx
│   │   ├── Navbar.tsx
│   │   └── AuthGuard.tsx
│   └── shared/
│       ├── StatusBadge.tsx       # Badge warna per status MO/unit
│       ├── PaginatedTable.tsx    # Tabel dengan pagination
│       ├── BarcodeInput.tsx      # Input scan barcode
│       └── LaporanChart.tsx      # Grafik penjualan (Recharts)
├── lib/
│   ├── api.ts                    # Axios instance + interceptor JWT
│   ├── auth.ts                   # Login, logout, token refresh
│   └── utils.ts                  # cn(), formatRupiah(), formatDate()
├── hooks/
│   ├── useMO.ts                  # TanStack Query hooks untuk MO
│   ├── useProductionUnit.ts
│   ├── usePenjualan.ts
│   ├── useReturn.ts
│   └── useLaporan.ts
├── stores/
│   └── authStore.ts              # Zustand — simpan user + token
└── types/
    └── api.ts                    # TypeScript types dari response backend
```

---

## Phase 1 — Web (Prioritas)

### 🔐 Auth
- [ ] Setup Axios instance dengan base URL + Bearer token interceptor
- [ ] Halaman login (`/login`) — form email + password
- [ ] Auto redirect ke dashboard sesuai role setelah login
- [ ] Refresh token otomatis jika 401
- [ ] Logout + clear token
- [ ] `AuthGuard` component — proteksi semua route

### 🧭 Layout
- [ ] Root layout dengan sidebar navigasi per role
- [ ] Sidebar collapse di mobile web
- [ ] Navbar atas dengan nama user + tombol logout
- [ ] Toast notification (Sonner) untuk feedback aksi

### 📋 Manufacturing Order (Admin / Produksi)
- [ ] Halaman list MO — tabel paginated, filter by status
- [ ] Form buat MO baru — input nama produk, target qty, tanggal
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

### ☕ Scan Jual (Kasir)
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
- [ ] Indikator `%terjual` dan `%kerugian` dengan warna (hijau/merah)

### 🏦 Stok Inventori
- [ ] List bahan baku + saldo stok saat ini
- [ ] Form tambah stok (MASUK)
- [ ] Badge warning jika saldo < `stok_minimum`

### 👤 Manajemen User (Admin)
- [ ] List user + role
- [ ] Form buat user baru
- [ ] Reset password

---

## Phase 2 — Android (Setelah Web Selesai)

> Port dari web ke native menggunakan **React Native Reusables** + NativeWind.
> Komponen Shadcn diganti dengan padanan native (API sama, render berbeda).

### Setup Native
- [ ] Install React Native Reusables
- [ ] Setup NativeWind di Expo (native target)
- [ ] Buat `components/native/` — mirror dari `components/ui/`
- [ ] Platform-aware imports: `Button.web.tsx` vs `Button.native.tsx`

### Halaman Priority Android
- [ ] Login
- [ ] Driver: scan dispatch & deliver (kamera barcode via `expo-camera`)
- [ ] Kasir: scan sell (kamera barcode)
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
const { data, isLoading, error } = useQuery({
  queryKey: ['mo', id],
  queryFn: () => api.get(`/manufacturing-orders/${id}`),
})

// Format rupiah
formatRupiah(15000) // → "Rp 15.000"

// Status badge warna
READY          → blue
DISPATCHED     → yellow
DELIVERED      → orange
SOLD           → green
EXPIRED        → red
VOID           → gray
RETURNED_GOOD  → teal
RETURNED_DAMAGED → red
```

---

## Urutan Pengerjaan yang Disarankan

```
1. Setup project + Axios + Auth (login, guard, token)
2. Layout sidebar per role
3. Halaman MO (list + buat + update status)
4. Generate unit + expiry alerts
5. Scan dispatch & deliver (driver)
6. Scan sell (kasir)
7. Return order (driver + review admin)
8. Laporan shareholder (chart)
9. Stok inventori
10. Manajemen user
---- Phase 2 ----
11. Setup native components
12. Port halaman driver & kasir ke Android
13. Barcode kamera
14. Push notification
```
