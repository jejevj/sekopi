# Sekopi Mobile — Progress Tracker

> **Terakhir diperbarui:** 7 Juli 2026  
> **Stack:** React Native (Expo SDK 57) · TypeScript · Expo Router v5 · Zustand · Axios  
> **API Base:** `https://api-sekopi.ourtestcloud.my.id/api/v1`

---

## Legend

| Simbol | Arti |
|--------|------|
| ✅ | Selesai & sudah di-push |
| 🔄 | Sedang dikerjakan / partial |
| ⏳ | Belum dimulai |
| ❌ | Blocked / butuh dependency lain |

---

## 1. Fondasi & Infrastruktur

| # | Item | Status | File |
|---|------|--------|------|
| 1.1 | Project setup Expo + TypeScript | ✅ | `package.json`, `tsconfig.json`, `app.json` |
| 1.2 | Expo Router v5 (file-based navigation) | ✅ | `app/_layout.tsx` |
| 1.3 | Global dark theme setup | ✅ | `global.css`, `app/index.tsx` |
| 1.4 | Axios instance terpusat (`lib/api.ts`) | ✅ | `lib/api.ts` |
| 1.5 | Auto-inject Bearer token via interceptor | ✅ | `lib/api.ts` |
| 1.6 | Auto-logout saat response 401 | ✅ | `lib/api.ts` |
| 1.7 | Environment config (`.env` + `.env.example`) | ✅ | `.env.example` |
| 1.8 | Zustand auth store (`user`, `accessToken`, `refreshToken`) | ✅ | `stores/authStore.ts` |
| 1.9 | Permission config kamera & lokasi (iOS + Android) | ✅ | `app.json` |

---

## 2. Autentikasi

| # | Item | Status | File | Endpoint |
|---|------|--------|------|----------|
| 2.1 | Splash / landing screen | ✅ | `app/index.tsx` | — |
| 2.2 | Halaman Login (UI glassmorphism) | ✅ | `app/(auth)/login.tsx` | — |
| 2.3 | Koneksi API login (`OAuth2PasswordRequestForm`) | ✅ | `app/(auth)/login.tsx` | `POST /auth/login/` |
| 2.4 | Simpan token & user ke Zustand store | ✅ | `stores/authStore.ts` | — |
| 2.5 | Redirect ke dashboard setelah login berhasil | ✅ | `app/(auth)/login.tsx` | — |
| 2.6 | Error handling: salah password, akun nonaktif, network error | ✅ | `app/(auth)/login.tsx` | — |
| 2.7 | Logout (clear store + redirect ke login) | ✅ | `app/(main)/dashboard.tsx` | — |
| 2.8 | Refresh token (auto re-login saat token expire) | ⏳ | — | `POST /auth/refresh` |
| 2.9 | Persist session (token tersimpan setelah app ditutup) | ⏳ | — | — |

---

## 3. Dashboard

| # | Item | Status | File |
|---|------|--------|------|
| 3.1 | Layout dashboard single-screen | ✅ | `app/(main)/dashboard.tsx` |
| 3.2 | Header: nama user + badge role | ✅ | `app/(main)/dashboard.tsx` |
| 3.3 | Grid menu 2 kolom dengan Ionicons flat icons | ✅ | `app/(main)/dashboard.tsx` |
| 3.4 | Menu berbeda per role (admin / produksi / inventori / driver / shareholder) | ✅ | `app/(main)/dashboard.tsx` |
| 3.5 | Animasi staggered masuk kartu menu | ✅ | `app/(main)/dashboard.tsx` |
| 3.6 | Tombol logout di header | ✅ | `app/(main)/dashboard.tsx` |
| 3.7 | Summary card (rekap hari ini: penjualan, stok, dll) | ⏳ | — |
| 3.8 | Notifikasi / badge jumlah pending item | ⏳ | — |

---

## 4. Absensi

| # | Item | Status | File | Endpoint |
|---|------|--------|------|----------|
| 4.1 | Halaman Absensi (layout + topbar) | ✅ | `app/(main)/absensi.tsx` | — |
| 4.2 | Ambil GPS otomatis saat layar dibuka (`expo-location`) | ✅ | `app/(main)/absensi.tsx` | — |
| 4.3 | Peta lokasi embed OpenStreetMap + Leaflet via WebView | ✅ | `app/(main)/absensi.tsx` | — |
| 4.4 | Marker posisi user + lingkaran radius 100m pada peta | ✅ | `app/(main)/absensi.tsx` | — |
| 4.5 | Kamera selfie (front camera, `expo-camera`) | ✅ | `app/(main)/absensi.tsx` | — |
| 4.6 | Frame panduan oval untuk posisi wajah | ✅ | `app/(main)/absensi.tsx` | — |
| 4.7 | Preview & ganti foto setelah diambil | ✅ | `app/(main)/absensi.tsx` | — |
| 4.8 | Submit absensi ke API (`jam_masuk`, `lat`, `lng`, `foto_url`) | ✅ | `app/(main)/absensi.tsx` | `POST /absensi/` |
| 4.9 | Layar sukses: tampilkan status dalam/luar radius | ✅ | `app/(main)/absensi.tsx` | — |
| 4.10 | Upload foto ke storage (bukan base64 inline) | ⏳ | — | TBD |
| 4.11 | Cegah double absensi di hari yang sama | ⏳ | — | — |
| 4.12 | Jam keluar (check-out) | ⏳ | — | `PATCH /absensi/{id}` |
| 4.13 | Riwayat absensi (list per bulan) | ⏳ | — | `GET /absensi/` |

---

## 5. Profil

| # | Item | Status | File | Endpoint |
|---|------|--------|------|----------|
| 5.1 | Halaman profil user | ⏳ | `app/(main)/profile.tsx` | `GET /auth/me` |
| 5.2 | Ubah password | ⏳ | — | TBD |

---

## 6. Modul per Role

### 6A. Admin

| # | Item | Status | Endpoint |
|---|------|--------|----------|
| 6A.1 | Manajemen pengguna (list, tambah, nonaktifkan) | ⏳ | `GET/POST /users/` |
| 6A.2 | Manajemen gerobak | ⏳ | `GET/POST /gerobak/` |
| 6A.3 | Manajemen menu produk | ⏳ | `GET/POST /menu/` |
| 6A.4 | Laporan keuangan | ⏳ | `GET /laporan/` |
| 6A.5 | Manajemen dividen | ⏳ | `GET/POST /dividen/` |
| 6A.6 | Setting lokasi absensi (radius, koordinat) | ⏳ | `GET/POST /absensi/settings` |
| 6A.7 | Rekap absensi harian | ⏳ | `GET /absensi/rekap` |

### 6B. Driver

| # | Item | Status | Endpoint |
|---|------|--------|----------|
| 6B.1 | Info gerobak yang dipegang | ⏳ | `GET /gerobak/` |
| 6B.2 | Input penjualan harian | ⏳ | `POST /penjualan/` |
| 6B.3 | Cek stok harian | ⏳ | `GET /inventori/` |

### 6C. Inventori

| # | Item | Status | Endpoint |
|---|------|--------|----------|
| 6C.1 | Daftar & mutasi stok | ⏳ | `GET /inventori/` |
| 6C.2 | Purchase Order | ⏳ | `GET/POST /purchase-order/` |
| 6C.3 | Return order | ⏳ | `GET/POST /return-order/` |
| 6C.4 | Loading / pengiriman | ⏳ | `GET/POST /loading/` |

### 6D. Produksi

| # | Item | Status | Endpoint |
|---|------|--------|----------|
| 6D.1 | Manufacturing order | ⏳ | `GET/POST /manufacturing-order/` |
| 6D.2 | Input hasil produksi | ⏳ | `POST /produksi/` |
| 6D.3 | Daftar menu produk | ⏳ | `GET /menu/` |

### 6E. Shareholder

| # | Item | Status | Endpoint |
|---|------|--------|----------|
| 6E.1 | Laporan ringkasan | ⏳ | `GET /laporan/` |
| 6E.2 | Riwayat dividen | ⏳ | `GET /dividen/` |

---

## 7. UX & Polish

| # | Item | Status |
|---|------|--------|
| 7.1 | Desain dark theme konsisten (gradient `#0f1117` → `#13151e`) | ✅ |
| 7.2 | Glassmorphism card (BlurView + border transparan) | ✅ |
| 7.3 | Animasi fade + slide masuk (Animated API) | ✅ |
| 7.4 | Flat icon style (Ionicons) — tidak ada emoji | ✅ |
| 7.5 | Loading state & error message di semua form | ✅ |
| 7.6 | Skeleton loading saat fetch data | ⏳ |
| 7.7 | Pull-to-refresh di list screen | ⏳ |
| 7.8 | Toast notification (sukses/gagal) | ⏳ |
| 7.9 | Haptic feedback pada tombol aksi utama | ⏳ |

---

## 8. Kualitas & Deployment

| # | Item | Status |
|---|------|--------|
| 8.1 | TypeScript strict mode | 🔄 |
| 8.2 | Error boundary global | ⏳ |
| 8.3 | EAS Build config (`eas.json`) | ⏳ |
| 8.4 | Build APK via EAS Build | ⏳ |
| 8.5 | Over-the-air update (EAS Update) | ⏳ |
| 8.6 | Unit test komponen kritis | ⏳ |

---

## Ringkasan Progress

```
Fondasi & Infra      ████████████████████  100% (9/9)
Autentikasi          ████████████████░░░░   78% (7/9)
Dashboard            ████████████████░░░░   75% (6/8)
Absensi              ████████████████░░░░   69% (9/13)
Profil               ░░░░░░░░░░░░░░░░░░░░    0% (0/2)
Modul per Role       ░░░░░░░░░░░░░░░░░░░░    0% (0/17)
UX & Polish          ████████░░░░░░░░░░░░   56% (5/9)
Kualitas & Deploy    ░░░░░░░░░░░░░░░░░░░░    8% (1/8 partial)

Total Selesai: 36/75 item  ≈  48%
```

---

## Prioritas Selanjutnya

1. **Persist session** — simpan token ke `SecureStore` agar tidak logout saat app restart
2. **Upload foto** — endpoint storage terpisah, bukan base64 inline
3. **Jam keluar** (check-out absensi)
4. **Halaman profil** — tampilkan data user dari `GET /auth/me`
5. **Modul driver** — paling kritis setelah absensi
6. **Summary card dashboard** — data ringkasan dari API
7. **EAS Build** — siapkan untuk distribusi APK
