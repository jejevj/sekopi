"""Seeder — jalankan: python seed.py

Seeder ini bersifat idempotent: aman dijalankan berulang kali.
Data yang sudah ada akan di-skip (tidak di-overwrite).
"""
import asyncio
from app.db.session import AsyncSessionLocal
from app.models.user import User, UserRole
from app.models.bahan_baku import BahanBaku
from app.models.menu import Menu, Resep, ResepBahan
from app.core.security import get_password_hash
from sqlalchemy import select


# ─── DATA ───────────────────────────────────────────────────────────────

SEED_USERS = [
    {"full_name": "Admin SekoPi",     "email": "admin@sekopi.com",       "password": "admin123",    "role": UserRole.ADMIN},
    {"full_name": "Bagian Produksi",  "email": "produksi@sekopi.com",    "password": "produksi123", "role": UserRole.PRODUKSI},
    {"full_name": "Bagian Inventori", "email": "inventori@sekopi.com",   "password": "inventori123","role": UserRole.INVENTORI},
    {"full_name": "Driver Kopi",      "email": "driver@sekopi.com",      "password": "driver123",   "role": UserRole.DRIVER},
    {"full_name": "Shareholder",      "email": "shareholder@sekopi.com", "password": "holder123",   "role": UserRole.SHAREHOLDER},
]

# Bahan baku kopi siap saji (satuan = satuan referensi untuk harga beli)
SEED_BAHAN_BAKU = [
    {
        "nama": "Kopi Robusta",
        "satuan": "kg",
        "satuan_display": "gram",
        "konversi_factor": 1000.0,   # 1 kg = 1000 gram
        "stok_minimum": 5.0,
        "harga_beli_per_satuan": 80000.0,   # Rp 80.000 / kg
        "deskripsi": "Kopi robusta pilihan untuk cold brew",
    },
    {
        "nama": "Susu Full Cream",
        "satuan": "liter",
        "satuan_display": "ml",
        "konversi_factor": 1000.0,   # 1 liter = 1000 ml
        "stok_minimum": 10.0,
        "harga_beli_per_satuan": 18000.0,   # Rp 18.000 / liter
        "deskripsi": "Susu full cream untuk campuran minuman",
    },
    {
        "nama": "Gula Pasir",
        "satuan": "kg",
        "satuan_display": "gram",
        "konversi_factor": 1000.0,
        "stok_minimum": 5.0,
        "harga_beli_per_satuan": 14000.0,   # Rp 14.000 / kg
        "deskripsi": None,
    },
    {
        "nama": "Air Mineral",
        "satuan": "liter",
        "satuan_display": "ml",
        "konversi_factor": 1000.0,
        "stok_minimum": 20.0,
        "harga_beli_per_satuan": 3000.0,   # Rp 3.000 / liter
        "deskripsi": None,
    },
    {
        "nama": "Botol Plastik 250ml",
        "satuan": "pcs",
        "satuan_display": None,
        "konversi_factor": None,
        "stok_minimum": 100.0,
        "harga_beli_per_satuan": 800.0,    # Rp 800 / pcs
        "deskripsi": "Kemasan botol plastik 250ml beserta tutup",
    },
    {
        "nama": "Sedotan",
        "satuan": "pcs",
        "satuan_display": None,
        "konversi_factor": None,
        "stok_minimum": 200.0,
        "harga_beli_per_satuan": 100.0,
        "deskripsi": None,
    },
]

# Menu produk + resep aktif
# format resep_bahan: {"bahan_nama": ..., "qty_per_unit": ..., "satuan": ...}
# satuan di sini = satuan_display (gram, ml, pcs)
SEED_MENU = [
    {
        "nama": "Kopi Susu Cold Brew",
        "deskripsi": "Cold brew kopi robusta dengan susu full cream",
        "harga_jual": 15000.0,
        "resep": {
            "nama_versi": "v1",
            "bahan": [
                {"bahan_nama": "Kopi Robusta",    "qty_per_unit": 0.012,  "satuan": "kg"},   # 12 gram
                {"bahan_nama": "Susu Full Cream", "qty_per_unit": 0.100,  "satuan": "liter"}, # 100 ml
                {"bahan_nama": "Gula Pasir",      "qty_per_unit": 0.015,  "satuan": "kg"},   # 15 gram
                {"bahan_nama": "Air Mineral",     "qty_per_unit": 0.150,  "satuan": "liter"}, # 150 ml
                {"bahan_nama": "Botol Plastik 250ml", "qty_per_unit": 1.0, "satuan": "pcs"},
                {"bahan_nama": "Sedotan",         "qty_per_unit": 1.0,    "satuan": "pcs"},
            ],
        },
    },
    {
        "nama": "Kopi Original Cold Brew",
        "deskripsi": "Cold brew kopi robusta tanpa susu, less sugar",
        "harga_jual": 12000.0,
        "resep": {
            "nama_versi": "v1",
            "bahan": [
                {"bahan_nama": "Kopi Robusta",    "qty_per_unit": 0.015,  "satuan": "kg"},   # 15 gram
                {"bahan_nama": "Gula Pasir",      "qty_per_unit": 0.010,  "satuan": "kg"},   # 10 gram
                {"bahan_nama": "Air Mineral",     "qty_per_unit": 0.230,  "satuan": "liter"}, # 230 ml
                {"bahan_nama": "Botol Plastik 250ml", "qty_per_unit": 1.0, "satuan": "pcs"},
                {"bahan_nama": "Sedotan",         "qty_per_unit": 1.0,    "satuan": "pcs"},
            ],
        },
    },
]


# ─── SEED FUNCTIONS ──────────────────────────────────────────────────

async def seed_users(db) -> None:
    print("\n👤 Seeding users...")
    for u in SEED_USERS:
        result = await db.execute(select(User).where(User.email == u["email"]))
        if result.scalar_one_or_none():
            print(f"  SKIP   {u['email']}")
            continue
        db.add(User(
            full_name=u["full_name"],
            email=u["email"],
            hashed_password=get_password_hash(u["password"]),
            role=u["role"],
            is_active=True,
        ))
        print(f"  CREATE {u['email']} [{u['role'].value}]")
    await db.commit()


async def seed_bahan_baku(db) -> dict[str, int]:
    """Returns {nama: id} map for use in resep seeding."""
    print("\n🌾 Seeding bahan baku...")
    nama_to_id: dict[str, int] = {}
    for b in SEED_BAHAN_BAKU:
        result = await db.execute(select(BahanBaku).where(BahanBaku.nama == b["nama"]))
        existing = result.scalar_one_or_none()
        if existing:
            print(f"  SKIP   {b['nama']}")
            nama_to_id[b["nama"]] = existing.id
            continue
        bahan = BahanBaku(
            nama=b["nama"],
            satuan=b["satuan"],
            satuan_display=b.get("satuan_display"),
            konversi_factor=b.get("konversi_factor"),
            stok_minimum=b.get("stok_minimum", 0),
            harga_beli_per_satuan=b.get("harga_beli_per_satuan"),
            deskripsi=b.get("deskripsi"),
        )
        db.add(bahan)
        await db.flush()
        nama_to_id[b["nama"]] = bahan.id
        print(f"  CREATE {b['nama']} [{b['satuan']}] Rp {b.get('harga_beli_per_satuan', '-'):,}")
    await db.commit()
    return nama_to_id


async def seed_menu(db, bahan_id_map: dict[str, int]) -> None:
    print("\n☕ Seeding menu + resep...")
    for m in SEED_MENU:
        result = await db.execute(select(Menu).where(Menu.nama == m["nama"]))
        existing_menu = result.scalar_one_or_none()
        if existing_menu:
            print(f"  SKIP   Menu: {m['nama']}")
            continue

        menu = Menu(
            nama=m["nama"],
            deskripsi=m.get("deskripsi"),
            harga_jual=m["harga_jual"],
            is_active=True,
        )
        db.add(menu)
        await db.flush()

        resep_data = m["resep"]
        resep = Resep(
            menu_id=menu.id,
            nama_versi=resep_data["nama_versi"],
            is_active=True,
            catatan=None,
        )
        db.add(resep)
        await db.flush()

        for bahan_line in resep_data["bahan"]:
            bahan_id = bahan_id_map.get(bahan_line["bahan_nama"])
            if bahan_id is None:
                print(f"  WARN   Bahan '{bahan_line['bahan_nama']}' tidak ditemukan, lewati")
                continue
            db.add(ResepBahan(
                resep_id=resep.id,
                bahan_baku_id=bahan_id,
                qty_per_unit=bahan_line["qty_per_unit"],
                satuan=bahan_line["satuan"],
            ))

        await db.commit()
        print(f"  CREATE Menu: {m['nama']} (Rp {m['harga_jual']:,.0f}) + resep {resep_data['nama_versi']} ({len(resep_data['bahan'])} bahan)")


async def seed():
    async with AsyncSessionLocal() as db:
        await seed_users(db)
        bahan_id_map = await seed_bahan_baku(db)
        await seed_menu(db, bahan_id_map)

    print("\n" + "-" * 65)
    print("✅ Seeder selesai!")
    print("\nAkun tersedia:")
    print(f"  {'Email':40s} {'Password':15s} Role")
    print(f"  {'-'*70}")
    for u in SEED_USERS:
        print(f"  {u['email']:40s} {u['password']:15s} {u['role'].value}")


if __name__ == "__main__":
    print("Menjalankan seeder...")
    asyncio.run(seed())
