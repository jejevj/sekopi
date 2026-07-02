# ☕ SekoPi — Sistem Manajemen Kopi Gerobakan

Sistem manajemen operasional untuk bisnis kopi gerobakan dengan gudang terpusat.

## 👥 Role Pengguna

| Role | Akses |
|------|-------|
| **Admin** | Manajemen pengguna, konfigurasi sistem, laporan global |
| **Produksi** | Manajemen resep, batch produksi, output ke gerobak |
| **Inventori** | Stok bahan baku gudang, penerimaan & pengeluaran barang |
| **Driver** | Pengiriman stok dari gudang ke gerobak, konfirmasi delivery |
| **Shareholder** | Akses read-only laporan keuangan & performa bisnis |

---

## 🛠 Tech Stack

### Backend
- **FastAPI** (Python 3.12)
- **PostgreSQL 16**
- **SQLAlchemy 2.x** (async)
- **Alembic** (migrations)
- **JWT** authentication
- **Swagger UI** (built-in `/docs`)

### Frontend
- **Expo SDK 52+** with Expo Router v3
- **NativeWind v4** (Tailwind CSS for RN)
- **react-native-reusables** (shadcn/ui-style components)
- **Zustand** (state management)
- **TanStack Query** (server state)
- **Axios** (HTTP client)
- Web-first, Android-ready

---

## 📁 Project Structure

```
sekopi/
├── backend/          # FastAPI application
├── frontend/         # Expo React Native (web-first)
└── README.md
```

---

## 🚀 Getting Started

### Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
# Edit .env with your PostgreSQL credentials
alembic upgrade head
uvicorn app.main:app --reload
```

API docs available at: `http://localhost:8000/docs`

### Frontend

```bash
cd frontend
npm install
npx expo start --web
```

---

## 🗄 Environment Variables (Backend)

```env
DATABASE_URL=postgresql+asyncpg://user:password@localhost:5432/sekopi
SECRET_KEY=your-secret-key-here
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=60
FIRST_SUPERUSER_EMAIL=admin@sekopi.com
FIRST_SUPERUSER_PASSWORD=changeme
```
