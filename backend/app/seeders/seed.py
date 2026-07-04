"""Seeder utama SekoPi — jalankan dengan: python -m app.seeders.seed"""
import asyncio
from datetime import date, timedelta

from passlib.context import CryptContext
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

import app.db.base  # noqa: F401

from app.db.session import AsyncSessionLocal
from app.models.bahan_baku import BahanBaku
from app.models.manufacturing_order import ManufacturingOrder, MOLine, MOBahanBaku, StatusMO
from app.models.menu import Menu, Resep, ResepBahan
from app.models.production_unit import ProductionUnit, StatusUnit
from app.models.stok import Stok, TipeTransaksiStok
from app.models.user import User, UserRole

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_pw(pw: str) -> str:
    return pwd_context.hash(pw)


async def truncate_all(db: AsyncSession) -> None:
    tables = [
        "return_items",
        "return_orders",
        "generate_batch",
        "production_units",
        "mo_bahan_baku",
        "mo_lines",
        "manufacturing_orders",
        "stok",
        "resep_bahan",
        "resep",
        "menu",
        "bahan_baku",
        "users",
    ]
    for t in tables:
        await db.execute(text(f'TRUNCATE TABLE "{t}" RESTART IDENTITY CASCADE'))
    await db.commit()
    print("✅  Tabel dikosongkan")


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


async def seed_bahan_baku(db: AsyncSession) -> dict[str, BahanBaku]:
    items = [
        {"nama": "Kopi Robusta",      "satuan": "kg",     "satuan_display": "gram", "konversi_factor": 1000, "stok_minimum": 5,   "harga_beli": 80_000},
        {"nama": "Kopi Arabika",      "satuan": "kg",     "satuan_display": "gram", "konversi_factor": 1000, "stok_minimum": 3,   "harga_beli": 120_000},
        {"nama": "Gula Pasir",        "satuan": "kg",     "satuan_display": "gram", "konversi_factor": 1000, "stok_minimum": 10,  "harga_beli": 14_000},
        {"nama": "Susu Kental Manis", "satuan": "kaleng", "satuan_display": None,   "konversi_factor": None, "stok_minimum": 20,  "harga_beli": 12_000},
        {"nama": "Air Mineral",       "satuan": "liter",  "satuan_display": "ml",   "konversi_factor": 1000, "stok_minimum": 50,  "harga_beli": 500},
        {"nama": "Cup Plastik 250ml", "satuan": "pcs",    "satuan_display": None,   "konversi_factor": None, "stok_minimum": 500, "harga_beli": 350},
        {"nama": "Sedotan",           "satuan": "pcs",    "satuan_display": None,   "konversi_factor": None, "stok_minimum": 500, "harga_beli": 50},
        {"nama": "Stiker Label",      "satuan": "pcs",    "satuan_display": None,   "konversi_factor": None, "stok_minimum": 500, "harga_beli": 150},
    ]
    result: dict[str, BahanBaku] = {}
    for it in items:
        b = BahanBaku(
            nama=it["nama"],
            satuan=it["satuan"],
            satuan_display=it["satuan_display"],
            konversi_factor=it["konversi_factor"],
            stok_minimum=it["stok_minimum"],
            harga_beli_per_satuan=it["harga_beli"],
        )
        db.add(b)
        result[it["nama"]] = b
    await db.flush()
    print(f"✅  {len(items)} bahan baku dibuat")
    return result


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


async def seed_menu(db: AsyncSession, bahan: dict[str, BahanBaku]) -> list[Menu]:
    """
    Seed 4 menu kopi beserta resep aktif (v1) dan bahan bakunya.
    """
    menus_data = [
        {
            "nama": "Kopi Susu Robusta 250ml",
            "deskripsi": "Kopi susu dengan biji robusta pilihan, manis gurih",
            "harga_jual": 8_000,
            "resep": [
                {"nama_versi": "v1", "is_active": True, "catatan": "Resep standar awal"},
            ],
            "bahan_resep": {
                "v1": [
                    ("Kopi Robusta",      0.02,  "kg"),
                    ("Gula Pasir",        0.05,  "kg"),
                    ("Susu Kental Manis", 0.1,   "kaleng"),
                    ("Air Mineral",       0.2,   "liter"),
                    ("Cup Plastik 250ml", 1.0,   "pcs"),
                    ("Sedotan",           1.0,   "pcs"),
                    ("Stiker Label",      1.0,   "pcs"),
                ],
            },
        },
        {
            "nama": "Kopi Susu Arabika 250ml",
            "deskripsi": "Kopi susu premium dengan biji arabika, aroma buah segar",
            "harga_jual": 12_000,
            "resep": [
                {"nama_versi": "v1", "is_active": True,  "catatan": "Resep standar awal"},
                {"nama_versi": "v2-less-sugar", "is_active": False, "catatan": "Versi kurangi gula 20%"},
            ],
            "bahan_resep": {
                "v1": [
                    ("Kopi Arabika",      0.02,  "kg"),
                    ("Gula Pasir",        0.05,  "kg"),
                    ("Susu Kental Manis", 0.1,   "kaleng"),
                    ("Air Mineral",       0.2,   "liter"),
                    ("Cup Plastik 250ml", 1.0,   "pcs"),
                    ("Sedotan",           1.0,   "pcs"),
                    ("Stiker Label",      1.0,   "pcs"),
                ],
                "v2-less-sugar": [
                    ("Kopi Arabika",      0.02,  "kg"),
                    ("Gula Pasir",        0.04,  "kg"),
                    ("Susu Kental Manis", 0.1,   "kaleng"),
                    ("Air Mineral",       0.2,   "liter"),
                    ("Cup Plastik 250ml", 1.0,   "pcs"),
                    ("Sedotan",           1.0,   "pcs"),
                    ("Stiker Label",      1.0,   "pcs"),
                ],
            },
        },
        {
            "nama": "Kopi Hitam Robusta 250ml",
            "deskripsi": "Kopi hitam tanpa susu, kuat dan pahit, cocok buat yang suka original",
            "harga_jual": 6_000,
            "resep": [
                {"nama_versi": "v1", "is_active": True, "catatan": "Resep standar awal"},
            ],
            "bahan_resep": {
                "v1": [
                    ("Kopi Robusta",      0.025, "kg"),
                    ("Gula Pasir",        0.05,  "kg"),
                    ("Air Mineral",       0.2,   "liter"),
                    ("Cup Plastik 250ml", 1.0,   "pcs"),
                    ("Sedotan",           1.0,   "pcs"),
                    ("Stiker Label",      1.0,   "pcs"),
                ],
            },
        },
        {
            "nama": "Kopi Arabika Es 250ml",
            "deskripsi": "Kopi arabika dingin tanpa susu, segar dan fruity",
            "harga_jual": 10_000,
            "resep": [
                {"nama_versi": "v1", "is_active": True, "catatan": "Resep standar awal"},
            ],
            "bahan_resep": {
                "v1": [
                    ("Kopi Arabika",      0.03,  "kg"),
                    ("Gula Pasir",        0.06,  "kg"),
                    ("Air Mineral",       0.3,   "liter"),
                    ("Cup Plastik 250ml", 1.0,   "pcs"),
                    ("Sedotan",           1.0,   "pcs"),
                    ("Stiker Label",      1.0,   "pcs"),
                ],
            },
        },
    ]

    menu_list: list[Menu] = []
    for md in menus_data:
        menu = Menu(
            nama=md["nama"],
            deskripsi=md["deskripsi"],
            harga_jual=md["harga_jual"],
            is_active=True,
        )
        db.add(menu)
        await db.flush()

        for rd in md["resep"]:
            resep = Resep(
                menu_id=menu.id,
                nama_versi=rd["nama_versi"],
                is_active=rd["is_active"],
                catatan=rd.get("catatan"),
            )
            db.add(resep)
            await db.flush()

            for nama_bahan, qty, satuan in md["bahan_resep"][rd["nama_versi"]]:
                db.add(ResepBahan(
                    resep_id=resep.id,
                    bahan_baku_id=bahan[nama_bahan].id,
                    qty_per_unit=qty,
                    satuan=satuan,
                ))

        menu_list.append(menu)

    await db.flush()
    total_resep = sum(len(md["resep"]) for md in menus_data)
    print(f"✅  {len(menu_list)} menu dibuat ({total_resep} resep)")
    return menu_list


async def seed_mo(
    db: AsyncSession,
    bahan: dict[str, BahanBaku],
    menu_list: list[Menu],
    users: dict[str, User],
) -> list[ManufacturingOrder]:
    """
    Seed MO dengan struktur baru: 1 MO header bisa punya banyak MOLine.

    MO-1: DONE       — 2 line (Kopi Susu Robusta 100 unit + Kopi Hitam Robusta 80 unit)
    MO-2: IN_PROGRESS— 1 line (Kopi Arabika Es 50 unit)
    MO-3: CONFIRMED  — 1 line (Kopi Susu Arabika 75 unit)
    MO-4: DRAFT      — 1 line (Kopi Hitam Robusta 120 unit)
    """
    today = date.today()
    admin_id     = users["admin"].id
    produksi_id  = users["produksi"].id
    inventori_id = users["inventori"].id

    # Helper: cari menu by nama
    menu_by_nama = {m.nama: m for m in menu_list}

    mo_list = []

    # ----------------------------------------------------------------
    # MO-1: DONE — 2 produk dalam satu MO
    # ----------------------------------------------------------------
    mo1 = ManufacturingOrder(
        nomor_mo=f"MO-{today.strftime('%Y%m%d')}-001",
        tanggal_rencana=today,
        status=StatusMO.DONE,
        catatan="Batch produksi pertama — 2 produk sekaligus",
        created_by=produksi_id, approved_by=admin_id, inventori_by=inventori_id,
    )
    db.add(mo1)
    await db.flush()

    # Line 1: Kopi Susu Robusta 100 unit
    m_robusta = menu_by_nama["Kopi Susu Robusta 250ml"]
    line1a = MOLine(
        mo_id=mo1.id, menu_id=m_robusta.id,
        nama_produk=m_robusta.nama, target_qty=100, satuan="unit"
    )
    db.add(line1a)
    await db.flush()
    for nama, qty_rencana, qty_per_unit, satuan in [
        ("Kopi Robusta",      2.0,   0.02,  "kg"),
        ("Gula Pasir",        5.0,   0.05,  "kg"),
        ("Susu Kental Manis", 10.0,  0.1,   "kaleng"),
        ("Air Mineral",       20.0,  0.2,   "liter"),
        ("Cup Plastik 250ml", 100.0, 1.0,   "pcs"),
        ("Sedotan",           100.0, 1.0,   "pcs"),
        ("Stiker Label",      100.0, 1.0,   "pcs"),
    ]:
        db.add(MOBahanBaku(mo_line_id=line1a.id, bahan_baku_id=bahan[nama].id,
                           qty_rencana=qty_rencana, qty_per_unit=qty_per_unit, satuan=satuan))

    # Line 2: Kopi Hitam Robusta 80 unit
    m_hitam = menu_by_nama["Kopi Hitam Robusta 250ml"]
    line1b = MOLine(
        mo_id=mo1.id, menu_id=m_hitam.id,
        nama_produk=m_hitam.nama, target_qty=80, satuan="unit"
    )
    db.add(line1b)
    await db.flush()
    for nama, qty_rencana, qty_per_unit, satuan in [
        ("Kopi Robusta",      2.0,   0.025, "kg"),
        ("Gula Pasir",        4.0,   0.05,  "kg"),
        ("Air Mineral",       16.0,  0.2,   "liter"),
        ("Cup Plastik 250ml", 80.0,  1.0,   "pcs"),
        ("Sedotan",           80.0,  1.0,   "pcs"),
        ("Stiker Label",      80.0,  1.0,   "pcs"),
    ]:
        db.add(MOBahanBaku(mo_line_id=line1b.id, bahan_baku_id=bahan[nama].id,
                           qty_rencana=qty_rencana, qty_per_unit=qty_per_unit, satuan=satuan))
    mo_list.append(mo1)

    # ----------------------------------------------------------------
    # MO-2: IN_PROGRESS — 1 produk
    # ----------------------------------------------------------------
    mo2 = ManufacturingOrder(
        nomor_mo=f"MO-{today.strftime('%Y%m%d')}-002",
        tanggal_rencana=today,
        status=StatusMO.IN_PROGRESS,
        catatan="Sedang diproduksi",
        created_by=produksi_id, approved_by=admin_id, inventori_by=inventori_id,
    )
    db.add(mo2)
    await db.flush()
    m_es = menu_by_nama["Kopi Arabika Es 250ml"]
    line2 = MOLine(
        mo_id=mo2.id, menu_id=m_es.id,
        nama_produk=m_es.nama, target_qty=50, satuan="unit"
    )
    db.add(line2)
    await db.flush()
    for nama, qty_rencana, qty_per_unit, satuan in [
        ("Kopi Arabika",      1.5,  0.03,  "kg"),
        ("Gula Pasir",        3.0,  0.06,  "kg"),
        ("Air Mineral",       15.0, 0.3,   "liter"),
        ("Cup Plastik 250ml", 50.0, 1.0,   "pcs"),
        ("Sedotan",           50.0, 1.0,   "pcs"),
        ("Stiker Label",      50.0, 1.0,   "pcs"),
    ]:
        db.add(MOBahanBaku(mo_line_id=line2.id, bahan_baku_id=bahan[nama].id,
                           qty_rencana=qty_rencana, qty_per_unit=qty_per_unit, satuan=satuan))
    mo_list.append(mo2)

    # ----------------------------------------------------------------
    # MO-3: CONFIRMED — 1 produk
    # ----------------------------------------------------------------
    mo3 = ManufacturingOrder(
        nomor_mo=f"MO-{today.strftime('%Y%m%d')}-003",
        tanggal_rencana=today + timedelta(days=1),
        status=StatusMO.CONFIRMED,
        catatan="Disetujui, tunggu inventori keluarkan bahan",
        created_by=produksi_id, approved_by=admin_id,
    )
    db.add(mo3)
    await db.flush()
    m_arabika = menu_by_nama["Kopi Susu Arabika 250ml"]
    line3 = MOLine(
        mo_id=mo3.id, menu_id=m_arabika.id,
        nama_produk=m_arabika.nama, target_qty=75, satuan="unit"
    )
    db.add(line3)
    await db.flush()
    for nama, qty_rencana, qty_per_unit, satuan in [
        ("Kopi Arabika",      1.8,  0.024, "kg"),
        ("Gula Pasir",        4.0,  0.053, "kg"),
        ("Susu Kental Manis", 8.0,  0.107, "kaleng"),
        ("Air Mineral",       18.0, 0.24,  "liter"),
        ("Cup Plastik 250ml", 75.0, 1.0,   "pcs"),
        ("Sedotan",           75.0, 1.0,   "pcs"),
        ("Stiker Label",      75.0, 1.0,   "pcs"),
    ]:
        db.add(MOBahanBaku(mo_line_id=line3.id, bahan_baku_id=bahan[nama].id,
                           qty_rencana=qty_rencana, qty_per_unit=qty_per_unit, satuan=satuan))
    mo_list.append(mo3)

    # ----------------------------------------------------------------
    # MO-4: DRAFT — 1 produk
    # ----------------------------------------------------------------
    mo4 = ManufacturingOrder(
        nomor_mo=f"MO-{today.strftime('%Y%m%d')}-004",
        tanggal_rencana=today + timedelta(days=2),
        status=StatusMO.DRAFT,
        catatan="Menunggu persetujuan admin",
        created_by=produksi_id,
    )
    db.add(mo4)
    await db.flush()
    line4 = MOLine(
        mo_id=mo4.id, menu_id=m_hitam.id,
        nama_produk=m_hitam.nama, target_qty=120, satuan="unit"
    )
    db.add(line4)
    await db.flush()
    for nama, qty_rencana, qty_per_unit, satuan in [
        ("Kopi Robusta",      3.0,   0.025, "kg"),
        ("Gula Pasir",        6.0,   0.05,  "kg"),
        ("Air Mineral",       24.0,  0.2,   "liter"),
        ("Cup Plastik 250ml", 120.0, 1.0,   "pcs"),
        ("Sedotan",           120.0, 1.0,   "pcs"),
        ("Stiker Label",      120.0, 1.0,   "pcs"),
    ]:
        db.add(MOBahanBaku(mo_line_id=line4.id, bahan_baku_id=bahan[nama].id,
                           qty_rencana=qty_rencana, qty_per_unit=qty_per_unit, satuan=satuan))
    mo_list.append(mo4)

    await db.flush()
    print(f"✅  {len(mo_list)} MO dibuat (MO-1 punya 2 line, total 5 MOLine)")
    return mo_list


async def seed_production_units(
    db: AsyncSession,
    mo: ManufacturingOrder,
    line: MOLine,
) -> None:
    """Generate 10 unit dari MO-1 Line-1 (Kopi Susu Robusta)."""
    today  = date.today()
    expiry = today + timedelta(days=2)
    units  = []
    for i in range(1, 11):
        barcode = f"SKP-{today.strftime('%Y%m%d')}-{i:04d}"
        unit = ProductionUnit(
            barcode=barcode,
            mo_id=mo.id,
            mo_line_id=line.id,
            nama_produk=line.nama_produk,
            expiry_date=expiry,
            harga_modal=4150.0,
            status=StatusUnit.READY,
        )
        db.add(unit)
        units.append(unit)
    await db.flush()
    print(f"✅  {len(units)} production units dibuat (mo_line_id={line.id}, harga_modal Rp 4.150)")


async def run_seed(fresh: bool = True) -> None:
    async with AsyncSessionLocal() as db:
        if fresh:
            await truncate_all(db)

        users     = await seed_users(db)
        bahan     = await seed_bahan_baku(db)
        await seed_stok(db, bahan, users["admin"])
        menu_list = await seed_menu(db, bahan)
        mo_list   = await seed_mo(db, bahan, menu_list, users)

        # Generate unit dari line pertama MO-1
        mo1    = mo_list[0]
        line1a = mo1.lines[0]  # Kopi Susu Robusta
        await seed_production_units(db, mo1, line1a)

        await db.commit()
        print("\n🎉  Seed selesai!")
        print("\n📋  Akun tersedia:")
        print("   admin@sekopi.id        / admin123")
        print("   produksi@sekopi.id     / produksi123")
        print("   inventori@sekopi.id    / inventori123")
        print("   driver1@sekopi.id      / driver123")
        print("   driver2@sekopi.id      / driver123")
        print("   shareholder@sekopi.id  / shareholder123")
        print("\n🍵  Menu tersedia:")
        print("   - Kopi Susu Robusta 250ml   Rp 8.000")
        print("   - Kopi Susu Arabika 250ml   Rp 12.000")
        print("   - Kopi Hitam Robusta 250ml  Rp 6.000")
        print("   - Kopi Arabika Es 250ml     Rp 10.000")
        print("\n📦  MO tersedia:")
        print("   MO-001 DONE        — 2 line: Robusta 100 unit + Hitam 80 unit")
        print("   MO-002 IN_PROGRESS — 1 line: Arabika Es 50 unit")
        print("   MO-003 CONFIRMED   — 1 line: Susu Arabika 75 unit")
        print("   MO-004 DRAFT       — 1 line: Hitam Robusta 120 unit")


if __name__ == "__main__":
    asyncio.run(run_seed())
