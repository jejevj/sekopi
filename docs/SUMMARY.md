# SekoPi — Backend Summary

> Status: **Backend Complete** 
> Last updated: 2026-07-03 WIB

---

## Stack Teknologi

| Layer | Teknologi |
|-------|-----------|
| Framework | FastAPI 0.115 + Python 3.12 |
| ORM | SQLAlchemy 2.0 Async |
| Database | PostgreSQL (via asyncpg) |
| Migration | Alembic |
| Auth | JWT (python-jose + passlib bcrypt) |
| Scheduler | APScheduler 3.10 (AsyncIOScheduler) |
| Validation | Pydantic v2 |
| Testing | pytest + pytest-asyncio |

---

## Struktur Direktori

```
backend/
├── app/
│   ├── api/v1/endpoints/     # REST endpoints per domain
│   ├── core/                 # config, security, exceptions, scheduler, tasks
│   ├── db/                   # base class, session, alembic base
│   ├── models/               # SQLAlchemy ORM models
│   ├── repositories/         # Data access layer
│   ├── schemas/              # Pydantic request/response schemas
│   ├── services/             # Business logic layer
│   └── main.py               # FastAPI app + lifespan
├── alembic/                  # Migration files
├── tests/                    # Unit & integration tests
└── requirements.txt
```

---

## Models & Tabel Database

| Model | Tabel | Deskripsi |
|-------|-------|-----------|
| `User` | `users` | Semua user dengan role |
| `BahanBaku` | `bahan_baku` | Master bahan baku + stok_minimum |
| `Stok` | `stok` | Transaksi stok MASUK/KELUAR (ledger) |
| `Produksi` | `produksi` | Data produksi lama (legacy) |
| `Pengiriman` | `pengiriman` | Order pengiriman per driver |
| `ManufacturingOrder` | `manufacturing_orders` | Perintah produksi dengan status flow |
| `MOBahanBaku` | `mo_bahan_baku` | Bill of Materials per MO |
| `ProductionUnit` | `production_units` | 1 record = 1 item fisik dengan barcode unik |
| `Penjualan` | `penjualan` | Transaksi penjualan per scan |
| `ReturnOrder` | `return_orders` | Header retur dari driver |
| `ReturnItem` | `return_items` | Detail item per retur |

---

## API Endpoints

### Authentication
| Method | Path | Deskripsi |
|--------|------|-----------|
| POST | `/api/v1/auth/login` | Login, dapat JWT token |
| POST | `/api/v1/auth/refresh` | Refresh token |

### Manufacturing Orders
| Method | Path | Deskripsi |
|--------|------|-----------|
| GET | `/manufacturing-orders/` | List semua MO (paginated) |
| POST | `/manufacturing-orders/` | Buat MO baru + BOM |
| GET | `/manufacturing-orders/{id}` | Detail MO |
| PATCH | `/manufacturing-orders/{id}` | Edit MO (hanya DRAFT) |
| POST | `/manufacturing-orders/{id}/status` | Update status MO |
| GET | `/manufacturing-orders/{id}/cek-stok` | Cek ketersediaan bahan |

### Production Units & Barcode
| Method | Path | Deskripsi |
|--------|------|-----------|
| POST | `/production-units/generate` | Generate barcode dari MO DONE |
| GET | `/production-units/mo/{mo_id}` | List unit per MO (FEFO, paginated) |
| GET | `/production-units/ready-fefo` | List unit READY urut expiry (paginated) |
| GET | `/production-units/barcode/{barcode}` | Cek 1 barcode |
| GET | `/production-units/expiry-alerts` | Alert unit hampir/sudah expired |
| POST | `/production-units/trigger-mark-expired` | Manual mark expired |
| POST | `/production-units/scan/dispatch` | Driver scan loading |
| POST | `/production-units/scan/deliver` | Driver scan terima |
| POST | `/production-units/scan/sell` | Kasir scan jual |
| POST | `/production-units/scan/void` | Void unit |

### Return Orders
| Method | Path | Deskripsi |
|--------|------|-----------|
| GET | `/returns/` | List semua return |
| POST | `/returns/` | Buat return order |
| GET | `/returns/{id}` | Detail return |
| POST | `/returns/{id}/submit` | Driver submit |
| POST | `/returns/{id}/review` | Admin/Inventori review |
| GET | `/returns/{id}/summary` | Summary per batch |

### Penjualan
| Method | Path | Deskripsi |
|--------|------|-----------|
| GET | `/penjualan/` | List penjualan (filter by tanggal) |
| GET | `/penjualan/summary` | Total penjualan & pendapatan |

### Laporan
| Method | Path | Deskripsi |
|--------|------|-----------|
| GET | `/laporan/shareholder` | Laporan periode bebas |
| GET | `/laporan/shareholder/minggu-ini` | Shortcut 7 hari terakhir |
| GET | `/laporan/shareholder/bulan-ini` | Shortcut bulan berjalan |

### Admin & Scheduler
| Method | Path | Deskripsi |
|--------|------|-----------|
| GET | `/admin/scheduler/jobs` | List cron jobs |
| POST | `/admin/scheduler/run/{job_id}` | Jalankan job manual |

---

## Fitur Kunci

- **FEFO (First Expired, First Out)** — semua list unit diurutkan expiry terdekat
- **Barcode unik per item** — format `SKP-YYYYMMDD-XXXX`, race-condition safe
- **Auto stok deduction** — bahan baku otomatis berkurang saat MO → IN_PROGRESS
- **Expiry protection** — scan dispatch/deliver/sell ditolak jika produk expired
- **Return flow** — driver retur → review gudang → unit READY atau VOID
- **Laporan kerugian** — expired + rusak + void dengan harga modal atau fallback avg harga jual
- **Pagination** — semua list endpoint support `page` & `per_page`
- **Cron jobs** — auto mark expired jam 00:01, alert jam 07:00 (WIB)

---

## Quick Start

```bash
cd backend
python -m venv venv && source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env  # isi DATABASE_URL & SECRET_KEY
alembic upgrade head
uvicorn app.main:app --reload
# Swagger: http://localhost:8000/docs
```
