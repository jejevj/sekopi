"""Seeder utama SekoPi — jalankan dengan: python -m app.seeders.seed"""
import asyncio
from datetime import date, timedelta

from passlib.context import CryptContext
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

# PENTING: import base agar SEMUA model ter-register ke SQLAlchemy mapper registry
# sebelum ada model yang diinstansiasi. Tanpa ini relationship ke model lain
# (misal Pengiriman, ReturnOrder, dll) akan gagal resolve.
import app.db.base  # noqa: F401

from app.db.session import AsyncSessionLocal
from app.models.bahan_baku import BahanBaku
from app.models.manufacturing_order import ManufacturingOrder, MOBahanBaku, StatusMO
from app.models.production_unit import ProductionUnit, StatusUnit
from app.models.stok import Stok, TipeTransaksiStok
from app.models.user import User, UserRole

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def hash_pw(pw: str) -> str:
    return pwd_context.hash(pw)


async def truncate_all(db: AsyncSession) -> None:
    """Hapus semua data seed — urutan aman agar FK tidak conflict."""
    tables = [
        "production_units",
        "mo_bahan_baku",
        "manufacturing_orders",
        "stok",
        "bahan_baku",
        "users",
    ]
    for t in tables:
        await db.execute(text(f'TRUNCATE TABLE "{t}" RESTART IDENTITY CASCADE'))
    await db.commit()
    print("✅  Tabel dikosongkan")


# ---------------------------------------------------------------------------
# Users
# ---------------------------------------------------------------------------

async def seed_users(db: AsyncSession) -> dict[str, User]:
    users_data = [
        {"email": "admin@sekopi.id",       "full_name": "Admin SekoPi",      "role": UserRole.ADMIN,       "password": "admin123"},
        {"email": "produksi@sekopi.id",    "full_name": "Tim Produksi",      "role": UserRole.PRODUKSI,    "password": "produksi123"},
        {"email": "inventori@sekopi.id",   "full_name": "Tim Inventori",     "role": UserRole.INVENTORI,   "password": "inventori123"},
        {"email": "driver1@sekopi.id",     "full_name": "Budi Santoso",      "role": UserRole.DRIVER,      "password": "driver123"},
        {"email": "driver2@sekopi.id",     "full_name": "Andi Wijaya",       "role": UserRole.DRIVER,      "password": "driver123"},
        {"email": "shareholder@sekopi.id", "full_name": "Pak Investor",      "role": UserRole.SHAREHOLDER, "password": "shareholder123"},
    ]
    result: dict[str, User] = {}
    for ud in users_data:
        u = User(
            email=ud["email"],
            full_name=ud["full_name"],
            role=ud["role"],
            hashed_password=hash_pw(ud["password"]),
            is_active=True,
        )
        db.add(u)
        result[ud["role"].value] = u
    await db.flush()
    print(f"✅  {len(users_data)} users dibuat")
    return result


# ---------------------------------------------------------------------------
# Bahan Baku
# ---------------------------------------------------------------------------

async def seed_bahan_baku(db: AsyncSession) -> dict[str, BahanBaku]:
    items = [
        {"nama": "Kopi Robusta",      "satuan": "kg",     "satuan_display": "gram", "konversi_factor": 1000, "stok_minimum": 5},
        {"nama": "Kopi Arabika",      "satuan": "kg",     "satuan_display": "gram", "konversi_factor": 1000, "stok_minimum": 3},
        {"nama": "Gula Pasir",        "satuan": "kg",     "satuan_display": "gram", "konversi_factor": 1000, "stok_minimum": 10},
        {"nama": "Susu Kental Manis", "satuan": "kaleng", "satuan_display": None,   "konversi_factor": None,  "stok_minimum": 20},
        {"nama": "Air Mineral",       "satuan": "liter",  "satuan_display": "ml",   "konversi_factor": 1000, "stok_minimum": 50},
        {"nama": "Cup Plastik 250ml", "satuan": "pcs",    "satuan_display": None,   "konversi_factor": None,  "stok_minimum": 500},
        {"nama": "Sedotan",           "satuan": "pcs",    "satuan_display": None,   "konversi_factor": None,  "stok_minimum": 500},
        {"nama": "Stiker Label",      "satuan": "pcs",    "satuan_display": None,   "konversi_factor": None,  "stok_minimum": 500},
    ]
    result: dict[str, BahanBaku] = {}
    for it in items:
        b = BahanBaku(
            nama=it["nama"],
            satuan=it["satuan"],
            satuan_display=it["satuan_display"],
            konversi_factor=it["konversi_factor"],
            stok_minimum=it["stok_minimum"],
        )
        db.add(b)
        result[it["nama"]] = b
    await db.flush()
    print(f"✅  {len(items)} bahan baku dibuat")
    return result


# ---------------------------------------------------------------------------
# Stok Awal
# ---------------------------------------------------------------------------

async def seed_stok(db: AsyncSession, bahan: dict[str, BahanBaku], admin: User) -> None:
    stok_data = [
        ("Kopi Robusta",      20.0,   "Stok awal"),
        ("Kopi Arabika",      10.0,   "Stok awal"),
        ("Gula Pasir",        50.0,   "Stok awal"),
        ("Susu Kental Manis", 100.0,  "Stok awal"),
        ("Air Mineral",       200.0,  "Stok awal"),
        ("Cup Plastik 250ml", 2000.0, "Stok awal"),
        ("Sedotan",           2000.0, "Stok awal"),
        ("Stiker Label",      2000.0, "Stok awal"),
    ]
    for nama, jumlah, ket in stok_data:
        db.add(Stok(
            bahan_baku_id=bahan[nama].id,
            tipe=TipeTransaksiStok.MASUK,
            jumlah=jumlah,
            keterangan=ket,
            created_by=admin.id,
        ))
    await db.flush()
    print(f"✅  {len(stok_data)} transaksi stok awal dibuat")


# ---------------------------------------------------------------------------
# Manufacturing Orders
# ---------------------------------------------------------------------------

async def seed_mo(
    db: AsyncSession,
    bahan: dict[str, BahanBaku],
    users: dict[str, User],
) -> list[ManufacturingOrder]:
    today = date.today()
    admin_id     = users["admin"].id
    produksi_id  = users["produksi"].id
    inventori_id = users["inventori"].id

    mo_list = []

    # --- MO-1: DONE (siap generate unit)
    mo1 = ManufacturingOrder(
        nomor_mo=f"MO-{today.strftime('%Y%m%d')}-001",
        nama_produk="Kopi Susu Robusta 250ml",
        target_qty=100,
        satuan="cup",
        tanggal_rencana=today,
        status=StatusMO.DONE,
        catatan="Batch pertama hari ini",
        created_by=produksi_id,
        approved_by=admin_id,
        inventori_by=inventori_id,
    )
    db.add(mo1)
    await db.flush()
    for nama, qty_rencana, satuan in [
        ("Kopi Robusta",      2.0,   "kg"),
        ("Gula Pasir",        5.0,   "kg"),
        ("Susu Kental Manis", 10.0,  "kaleng"),
        ("Air Mineral",       20.0,  "liter"),
        ("Cup Plastik 250ml", 100.0, "pcs"),
        ("Sedotan",           100.0, "pcs"),
        ("Stiker Label",      100.0, "pcs"),
    ]:
        db.add(MOBahanBaku(mo_id=mo1.id, bahan_baku_id=bahan[nama].id,
                           qty_rencana=qty_rencana, qty_aktual=None, satuan=satuan))
    mo_list.append(mo1)

    # --- MO-2: IN_PROGRESS
    mo2 = ManufacturingOrder(
        nomor_mo=f"MO-{today.strftime('%Y%m%d')}-002",
        nama_produk="Kopi Arabika Es 250ml",
        target_qty=50,
        satuan="cup",
        tanggal_rencana=today,
        status=StatusMO.IN_PROGRESS,
        catatan="Sedang diproduksi",
        created_by=produksi_id,
        approved_by=admin_id,
        inventori_by=inventori_id,
    )
    db.add(mo2)
    await db.flush()
    for nama, qty_rencana, satuan in [
        ("Kopi Arabika",      1.5,  "kg"),
        ("Gula Pasir",        3.0,  "kg"),
        ("Air Mineral",       15.0, "liter"),
        ("Cup Plastik 250ml", 50.0, "pcs"),
        ("Sedotan",           50.0, "pcs"),
        ("Stiker Label",      50.0, "pcs"),
    ]:
        db.add(MOBahanBaku(mo_id=mo2.id, bahan_baku_id=bahan[nama].id,
                           qty_rencana=qty_rencana, qty_aktual=None, satuan=satuan))
    mo_list.append(mo2)

    # --- MO-3: CONFIRMED
    mo3 = ManufacturingOrder(
        nomor_mo=f"MO-{today.strftime('%Y%m%d')}-003",
        nama_produk="Kopi Susu Arabika 250ml",
        target_qty=75,
        satuan="cup",
        tanggal_rencana=today + timedelta(days=1),
        status=StatusMO.CONFIRMED,
        catatan="Disetujui, tunggu inventori keluarkan bahan",
        created_by=produksi_id,
        approved_by=admin_id,
    )
    db.add(mo3)
    await db.flush()
    for nama, qty_rencana, satuan in [
        ("Kopi Arabika",      1.8,  "kg"),
        ("Gula Pasir",        4.0,  "kg"),
        ("Susu Kental Manis", 8.0,  "kaleng"),
        ("Air Mineral",       18.0, "liter"),
        ("Cup Plastik 250ml", 75.0, "pcs"),
        ("Sedotan",           75.0, "pcs"),
        ("Stiker Label",      75.0, "pcs"),
    ]:
        db.add(MOBahanBaku(mo_id=mo3.id, bahan_baku_id=bahan[nama].id,
                           qty_rencana=qty_rencana, qty_aktual=None, satuan=satuan))
    mo_list.append(mo3)

    # --- MO-4: DRAFT
    mo4 = ManufacturingOrder(
        nomor_mo=f"MO-{today.strftime('%Y%m%d')}-004",
        nama_produk="Kopi Hitam Robusta 250ml",
        target_qty=120,
        satuan="cup",
        tanggal_rencana=today + timedelta(days=2),
        status=StatusMO.DRAFT,
        catatan="Menunggu persetujuan admin",
        created_by=produksi_id,
    )
    db.add(mo4)
    await db.flush()
    for nama, qty_rencana, satuan in [
        ("Kopi Robusta",      3.0,   "kg"),
        ("Gula Pasir",        6.0,   "kg"),
        ("Air Mineral",       24.0,  "liter"),
        ("Cup Plastik 250ml", 120.0, "pcs"),
        ("Sedotan",           120.0, "pcs"),
        ("Stiker Label",      120.0, "pcs"),
    ]:
        db.add(MOBahanBaku(mo_id=mo4.id, bahan_baku_id=bahan[nama].id,
                           qty_rencana=qty_rencana, qty_aktual=None, satuan=satuan))
    mo_list.append(mo4)

    await db.flush()
    print(f"✅  {len(mo_list)} Manufacturing Orders dibuat (DONE, IN_PROGRESS, CONFIRMED, DRAFT)")
    return mo_list


# ---------------------------------------------------------------------------
# Production Units — untuk MO yang sudah DONE
# ---------------------------------------------------------------------------

async def seed_production_units(db: AsyncSession, mo_done: ManufacturingOrder) -> None:
    today  = date.today()
    expiry = today + timedelta(days=2)
    units  = []
    for i in range(1, 11):
        barcode = f"SKP-{today.strftime('%Y%m%d')}-{i:04d}"
        unit = ProductionUnit(
            barcode=barcode,
            mo_id=mo_done.id,
            nama_produk=mo_done.nama_produk,
            expiry_date=expiry,
            harga_modal=3500.0,
            status=StatusUnit.READY,
        )
        db.add(unit)
        units.append(unit)
    await db.flush()
    print(f"✅  {len(units)} production units dibuat (status READY, expiry {expiry})")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

async def run_seed(fresh: bool = True) -> None:
    async with AsyncSessionLocal() as db:
        if fresh:
            await truncate_all(db)

        users   = await seed_users(db)
        bahan   = await seed_bahan_baku(db)
        await seed_stok(db, bahan, users["admin"])
        mo_list = await seed_mo(db, bahan, users)
        await seed_production_units(db, mo_list[0])  # mo_list[0] = DONE

        await db.commit()
        print("\n🎉  Seed selesai!")
        print("\n📋  Akun tersedia:")
        print("   admin@sekopi.id        / admin123")
        print("   produksi@sekopi.id     / produksi123")
        print("   inventori@sekopi.id    / inventori123")
        print("   driver1@sekopi.id      / driver123")
        print("   driver2@sekopi.id      / driver123")
        print("   shareholder@sekopi.id  / shareholder123")


if __name__ == "__main__":
    asyncio.run(run_seed())
