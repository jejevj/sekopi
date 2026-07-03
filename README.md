# SekoPi — Sistem Manajemen Operasional Kopi

> Platform manajemen internal untuk operasional bisnis kopi: produksi, distribusi, penjualan, retur, dan laporan shareholder.

---

## Tech Stack

| Layer | Teknologi |
|-------|-----------|
| Backend | FastAPI + SQLAlchemy (async) + PostgreSQL |
| Frontend | Expo SDK 52 + Expo Router v4 + TanStack Query v5 |
| Auth | JWT (python-jose) |
| Scheduler | APScheduler (AsyncIOScheduler) |
| ORM Migration | Alembic |
| Containerization | Docker + Docker Compose |

---

## Role Pengguna

| Role | Akses |
|------|-------|
| `admin` | Full akses — semua fitur + manajemen pengguna |
| `produksi` | MO, generate unit, expiry alerts |
| `inventori` | Stok bahan baku, review return |
| `driver` | Scan dispatch/deliver, buat return |
| `shareholder` | Laporan keuangan & efisiensi |

> ⚠️ Tidak ada role `kasir`. Role yang valid persis seperti tabel di atas (huruf kecil).

---

## Struktur Proyek

```
sekopi/
├── backend/
│   ├── app/
│   │   ├── api/
│   │   │   ├── deps.py           # get_db, get_current_user, require_roles
│   │   │   └── v1/
│   │   │       ├── router.py
│   │   │       └── endpoints/
│   │   │           ├── auth.py
│   │   │           ├── users.py  # CRUD + reset-password
│   │   │           ├── mo.py
│   │   │           ├── produksi.py
│   │   │           ├── laporan.py
│   │   │           └── ...
│   │   ├── models/
│   │   ├── repositories/
│   │   │   └── user_repo.py      # get_all, get_by_id, get_by_email, create
│   │   ├── schemas/
│   │   ├── db/
│   │   │   └── session.py        # Hanya export AsyncSessionLocal
│   │   └── core/
│   ├── alembic/
│   └── requirements.txt
├── frontend/
│   ├── app/
│   │   ├── (auth)/login.tsx
│   │   ├── (admin)/
│   │   │   ├── dashboard.tsx
│   │   │   ├── users/index.tsx   # Manajemen pengguna
│   │   │   ├── mo/
│   │   │   ├── bahan-baku/
│   │   │   ├── gerobak/
│   │   │   └── pembelian/
│   │   ├── (driver)/
│   │   └── (shareholder)/
│   ├── components/
│   │   └── layout/ (Sidebar, Navbar, AuthGuard)
│   └── lib/ (api.ts, auth.ts)
├── docs/
│   ├── CHANGELOG.md
│   ├── TODO-Frontend.md
│   ├── FLOW.md
│   └── SUMMARY.md
└── docker-compose.yml
```

---

## API Endpoints (Ringkasan)

### Auth
| Method | Path | Deskripsi |
|--------|------|-----------|
| POST | `/api/v1/auth/login` | Login, dapat JWT token |
| GET | `/api/v1/auth/me` | Info user yang login |

### Users (Admin only)
| Method | Path | Deskripsi |
|--------|------|-----------|
| GET | `/api/v1/users/` | List semua pengguna |
| POST | `/api/v1/users/` | Buat pengguna baru |
| PATCH | `/api/v1/users/{id}` | Update nama / role / status aktif |
| POST | `/api/v1/users/{id}/reset-password` | Reset password |
| DELETE | `/api/v1/users/{id}` | Hapus pengguna |

### Manufacturing Order
| Method | Path | Deskripsi |
|--------|------|-----------|
| GET | `/api/v1/manufacturing-orders/` | List MO (paginated) |
| POST | `/api/v1/manufacturing-orders/` | Buat MO baru + BOM |
| PATCH | `/api/v1/manufacturing-orders/{id}/status` | Update status MO |
| GET | `/api/v1/manufacturing-orders/{id}/cek-stok` | Cek ketersediaan bahan |

### Production Unit
| Method | Path | Deskripsi |
|--------|------|-----------|
| POST | `/api/v1/produksi/generate` | Generate unit dari MO |
| POST | `/api/v1/produksi/scan/dispatch` | Scan kirim ke driver |
| POST | `/api/v1/produksi/scan/deliver` | Scan terima di gerobak |
| POST | `/api/v1/produksi/scan/sell` | Scan jual |
| POST | `/api/v1/produksi/scan/void` | Void unit |
| GET | `/api/v1/produksi/expiry-alerts` | Dashboard expiry |

### Laporan
| Method | Path | Deskripsi |
|--------|------|-----------|
| GET | `/api/v1/laporan/shareholder` | Laporan custom date range |
| GET | `/api/v1/laporan/shareholder/minggu-ini` | Laporan minggu ini |
| GET | `/api/v1/laporan/shareholder/bulan-ini` | Laporan bulan ini |

---

## Setup Development

### Backend
```bash
cd backend
python -m venv venv
venv\Scripts\activate        # Windows
source venv/bin/activate     # Mac/Linux
pip install -r requirements.txt
alembic upgrade head
uvicorn app.main:app --reload --port 8000
```

### Frontend
```bash
cd frontend
npm install
npx expo start --web
```

### Docker (Full Stack)
```bash
docker-compose up --build
```

---

## Catatan Penting

- `session.py` hanya export `AsyncSessionLocal`. Function `get_db` didefinisikan di `deps.py`.
- Jangan gunakan `(group)/nama.tsx` dan `(group)/nama/index.tsx` bersamaan di Expo Router — akan conflict.
- Semua role dalam huruf kecil: `admin`, `produksi`, `inventori`, `driver`, `shareholder`.
