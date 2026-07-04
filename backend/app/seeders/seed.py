"""Seeder utama SekoPi — jalankan dengan: python -m app.seeders.seed"""
import asyncio
from datetime import date, datetime, time, timedelta, timezone

from passlib.context import CryptContext
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

import app.db.base  # noqa: F401

from app.db.session import AsyncSessionLocal
from app.models.absensi import Absensi, StatusAbsensi
from app.models.bahan_baku import BahanBaku
from app.models.gerobak import Gerobak, ShareholderGroup, GroupMembership
from app.models.loading import LoadingItem, LoadingOrder, StatusLoading
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
        # loading (harus duluan karena FK ke gerobak & users)
        "loading_items",
        "loading_orders",
        # absensi
        "absensi",
        # return
        "return_items",
        "return_orders",
        # produksi
        "generate_batch",
        "production_units",
        # MO
        "mo_bahan_baku",
        "mo_lines",
        "manufacturing_orders",
        # stok & menu
        "stok",
        "resep_bahan",
        "resep",
        "menu",
        "bahan_baku",
        # gerobak & shareholder
        "shareholder_group_members",
        "shareholder_groups",
        "gerobak",
        # users (paling akhir)
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
    # simpan driver1 & driver2 terpisah karena role sama
    await db.flush()
    # re-query untuk dapat semua user by email
    all_users = {ud["email"]: None for ud in users_data}
    for ud in users_data:
        from sqlalchemy import select
        res = await db.execute(select(User).where(User.email == ud["email"]))
        all_users[ud["email"]] = res.scalar_one()
    print(f"✅  {len(users_data)} users dibuat")
    return {
        "admin":       all_users["admin@sekopi.id"],
        "produksi":    all_users["produksi@sekopi.id"],
        "inventori":   all_users["inventori@sekopi.id"],
        "driver1":     all_users["driver1@sekopi.id"],
        "driver2":     all_users["driver2@sekopi.id"],
        "shareholder": all_users["shareholder@sekopi.id"],
    }


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
    menus_data = [
        {
            "nama": "Kopi Susu Robusta 250ml",
            "deskripsi": "Kopi susu dengan biji robusta pilihan, manis gurih",
            "harga_jual": 8_000,
            "resep": [{"nama_versi": "v1", "is_active": True, "catatan": "Resep standar awal"}],
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
                {"nama_versi": "v1",           "is_active": True,  "catatan": "Resep standar awal"},
                {"nama_versi": "v2-less-sugar", "is_active": False, "catatan": "Versi kurangi gula 20%"},
            ],
            "bahan_resep": {
                "v1": [
                    ("Kopi Arabika",      0.02, "kg"),
                    ("Gula Pasir",        0.05, "kg"),
                    ("Susu Kental Manis", 0.1,  "kaleng"),
                    ("Air Mineral",       0.2,  "liter"),
                    ("Cup Plastik 250ml", 1.0,  "pcs"),
                    ("Sedotan",           1.0,  "pcs"),
                    ("Stiker Label",      1.0,  "pcs"),
                ],
                "v2-less-sugar": [
                    ("Kopi Arabika",      0.02, "kg"),
                    ("Gula Pasir",        0.04, "kg"),
                    ("Susu Kental Manis", 0.1,  "kaleng"),
                    ("Air Mineral",       0.2,  "liter"),
                    ("Cup Plastik 250ml", 1.0,  "pcs"),
                    ("Sedotan",           1.0,  "pcs"),
                    ("Stiker Label",      1.0,  "pcs"),
                ],
            },
        },
        {
            "nama": "Kopi Hitam Robusta 250ml",
            "deskripsi": "Kopi hitam tanpa susu, kuat dan pahit",
            "harga_jual": 6_000,
            "resep": [{"nama_versi": "v1", "is_active": True, "catatan": "Resep standar awal"}],
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
            "resep": [{"nama_versi": "v1", "is_active": True, "catatan": "Resep standar awal"}],
            "bahan_resep": {
                "v1": [
                    ("Kopi Arabika",      0.03, "kg"),
                    ("Gula Pasir",        0.06, "kg"),
                    ("Air Mineral",       0.3,  "liter"),
                    ("Cup Plastik 250ml", 1.0,  "pcs"),
                    ("Sedotan",           1.0,  "pcs"),
                    ("Stiker Label",      1.0,  "pcs"),
                ],
            },
        },
    ]

    menu_list: list[Menu] = []
    for md in menus_data:
        menu = Menu(nama=md["nama"], deskripsi=md["deskripsi"], harga_jual=md["harga_jual"], is_active=True)
        db.add(menu)
        await db.flush()
        for rd in md["resep"]:
            resep = Resep(menu_id=menu.id, nama_versi=rd["nama_versi"], is_active=rd["is_active"], catatan=rd.get("catatan"))
            db.add(resep)
            await db.flush()
            for nama_bahan, qty, satuan in md["bahan_resep"][rd["nama_versi"]]:
                db.add(ResepBahan(resep_id=resep.id, bahan_baku_id=bahan[nama_bahan].id, qty_per_unit=qty, satuan=satuan))
        menu_list.append(menu)
    await db.flush()
    print(f"✅  {len(menu_list)} menu dibuat")
    return menu_list


async def seed_gerobak(db: AsyncSession, users: dict[str, User]) -> list[Gerobak]:
    """Seed 2 shareholder group + 3 gerobak dengan driver masing-masing."""
    # Shareholder groups
    grp1 = ShareholderGroup(nama="Grup A — Jakarta Pusat", deskripsi="Gerobak wilayah Jakarta Pusat")
    grp2 = ShareholderGroup(nama="Grup B — Jakarta Selatan", deskripsi="Gerobak wilayah Jakarta Selatan")
    db.add(grp1)
    db.add(grp2)
    await db.flush()

    # Membership: shareholder masuk ke grp1 dengan porsi 100%
    db.add(GroupMembership(group_id=grp1.id, user_id=users["shareholder"].id, porsi_saham=100.0))
    await db.flush()

    gerobak_data = [
        {"nama": "Gerobak Menteng",    "kode": "GRB-001", "lokasi": "Jl. HOS Cokroaminoto, Menteng",    "driver": users["driver1"], "group": grp1},
        {"nama": "Gerobak Sudirman",   "kode": "GRB-002", "lokasi": "Jl. Jenderal Sudirman, Senayan",    "driver": users["driver2"], "group": grp1},
        {"nama": "Gerobak Kemang",     "kode": "GRB-003", "lokasi": "Jl. Kemang Raya, Jakarta Selatan",  "driver": users["driver1"], "group": grp2},
    ]
    gerobak_list: list[Gerobak] = []
    for gd in gerobak_data:
        g = Gerobak(
            nama=gd["nama"],
            kode=gd["kode"],
            lokasi=gd["lokasi"],
            driver_id=gd["driver"].id,
            shareholder_group_id=gd["group"].id,
            is_active=True,
        )
        db.add(g)
        gerobak_list.append(g)
    await db.flush()
    print(f"✅  {len(gerobak_list)} gerobak dibuat (2 shareholder group)")
    return gerobak_list


async def seed_mo(
    db: AsyncSession,
    bahan: dict[str, BahanBaku],
    menu_list: list[Menu],
    users: dict[str, User],
) -> tuple[list[ManufacturingOrder], MOLine]:
    today = date.today()
    admin_id     = users["admin"].id
    produksi_id  = users["produksi"].id
    inventori_id = users["inventori"].id
    menu_by_nama = {m.nama: m for m in menu_list}
    mo_list = []

    mo1 = ManufacturingOrder(
        nomor_mo=f"MO-{today.strftime('%Y%m%d')}-001",
        tanggal_rencana=today, status=StatusMO.DONE,
        catatan="Batch produksi pertama — 2 produk sekaligus",
        created_by=produksi_id, approved_by=admin_id, inventori_by=inventori_id,
    )
    db.add(mo1)
    await db.flush()

    m_robusta = menu_by_nama["Kopi Susu Robusta 250ml"]
    line1a = MOLine(mo_id=mo1.id, menu_id=m_robusta.id, nama_produk=m_robusta.nama, target_qty=100, satuan="unit")
    db.add(line1a)
    await db.flush()
    for nama, qty_r, qty_u, sat in [
        ("Kopi Robusta",      2.0,   0.02,  "kg"),
        ("Gula Pasir",        5.0,   0.05,  "kg"),
        ("Susu Kental Manis", 10.0,  0.1,   "kaleng"),
        ("Air Mineral",       20.0,  0.2,   "liter"),
        ("Cup Plastik 250ml", 100.0, 1.0,   "pcs"),
        ("Sedotan",           100.0, 1.0,   "pcs"),
        ("Stiker Label",      100.0, 1.0,   "pcs"),
    ]:
        db.add(MOBahanBaku(mo_line_id=line1a.id, bahan_baku_id=bahan[nama].id, qty_rencana=qty_r, qty_per_unit=qty_u, satuan=sat))

    m_hitam = menu_by_nama["Kopi Hitam Robusta 250ml"]
    line1b = MOLine(mo_id=mo1.id, menu_id=m_hitam.id, nama_produk=m_hitam.nama, target_qty=80, satuan="unit")
    db.add(line1b)
    await db.flush()
    for nama, qty_r, qty_u, sat in [
        ("Kopi Robusta",      2.0,  0.025, "kg"),
        ("Gula Pasir",        4.0,  0.05,  "kg"),
        ("Air Mineral",       16.0, 0.2,   "liter"),
        ("Cup Plastik 250ml", 80.0, 1.0,   "pcs"),
        ("Sedotan",           80.0, 1.0,   "pcs"),
        ("Stiker Label",      80.0, 1.0,   "pcs"),
    ]:
        db.add(MOBahanBaku(mo_line_id=line1b.id, bahan_baku_id=bahan[nama].id, qty_rencana=qty_r, qty_per_unit=qty_u, satuan=sat))
    mo_list.append(mo1)

    mo2 = ManufacturingOrder(
        nomor_mo=f"MO-{today.strftime('%Y%m%d')}-002",
        tanggal_rencana=today, status=StatusMO.IN_PROGRESS,
        catatan="Sedang diproduksi",
        created_by=produksi_id, approved_by=admin_id, inventori_by=inventori_id,
    )
    db.add(mo2)
    await db.flush()
    m_es = menu_by_nama["Kopi Arabika Es 250ml"]
    line2 = MOLine(mo_id=mo2.id, menu_id=m_es.id, nama_produk=m_es.nama, target_qty=50, satuan="unit")
    db.add(line2)
    await db.flush()
    for nama, qty_r, qty_u, sat in [
        ("Kopi Arabika",      1.5,  0.03, "kg"),
        ("Gula Pasir",        3.0,  0.06, "kg"),
        ("Air Mineral",       15.0, 0.3,  "liter"),
        ("Cup Plastik 250ml", 50.0, 1.0,  "pcs"),
        ("Sedotan",           50.0, 1.0,  "pcs"),
        ("Stiker Label",      50.0, 1.0,  "pcs"),
    ]:
        db.add(MOBahanBaku(mo_line_id=line2.id, bahan_baku_id=bahan[nama].id, qty_rencana=qty_r, qty_per_unit=qty_u, satuan=sat))
    mo_list.append(mo2)

    mo3 = ManufacturingOrder(
        nomor_mo=f"MO-{today.strftime('%Y%m%d')}-003",
        tanggal_rencana=today + timedelta(days=1), status=StatusMO.CONFIRMED,
        catatan="Disetujui, tunggu inventori keluarkan bahan",
        created_by=produksi_id, approved_by=admin_id,
    )
    db.add(mo3)
    await db.flush()
    m_arabika = menu_by_nama["Kopi Susu Arabika 250ml"]
    line3 = MOLine(mo_id=mo3.id, menu_id=m_arabika.id, nama_produk=m_arabika.nama, target_qty=75, satuan="unit")
    db.add(line3)
    await db.flush()
    for nama, qty_r, qty_u, sat in [
        ("Kopi Arabika",      1.8,  0.024, "kg"),
        ("Gula Pasir",        4.0,  0.053, "kg"),
        ("Susu Kental Manis", 8.0,  0.107, "kaleng"),
        ("Air Mineral",       18.0, 0.24,  "liter"),
        ("Cup Plastik 250ml", 75.0, 1.0,   "pcs"),
        ("Sedotan",           75.0, 1.0,   "pcs"),
        ("Stiker Label",      75.0, 1.0,   "pcs"),
    ]:
        db.add(MOBahanBaku(mo_line_id=line3.id, bahan_baku_id=bahan[nama].id, qty_rencana=qty_r, qty_per_unit=qty_u, satuan=sat))
    mo_list.append(mo3)

    mo4 = ManufacturingOrder(
        nomor_mo=f"MO-{today.strftime('%Y%m%d')}-004",
        tanggal_rencana=today + timedelta(days=2), status=StatusMO.DRAFT,
        catatan="Menunggu persetujuan admin",
        created_by=produksi_id,
    )
    db.add(mo4)
    await db.flush()
    line4 = MOLine(mo_id=mo4.id, menu_id=m_hitam.id, nama_produk=m_hitam.nama, target_qty=120, satuan="unit")
    db.add(line4)
    await db.flush()
    for nama, qty_r, qty_u, sat in [
        ("Kopi Robusta",      3.0,   0.025, "kg"),
        ("Gula Pasir",        6.0,   0.05,  "kg"),
        ("Air Mineral",       24.0,  0.2,   "liter"),
        ("Cup Plastik 250ml", 120.0, 1.0,   "pcs"),
        ("Sedotan",           120.0, 1.0,   "pcs"),
        ("Stiker Label",      120.0, 1.0,   "pcs"),
    ]:
        db.add(MOBahanBaku(mo_line_id=line4.id, bahan_baku_id=bahan[nama].id, qty_rencana=qty_r, qty_per_unit=qty_u, satuan=sat))
    mo_list.append(mo4)

    await db.flush()
    print(f"✅  {len(mo_list)} MO dibuat (MO-1 punya 2 line, total 5 MOLine)")
    return mo_list, line1a


async def seed_production_units(
    db: AsyncSession,
    mo: ManufacturingOrder,
    line: MOLine,
) -> list[ProductionUnit]:
    """Generate 10 unit READY dari MO-1 Line-1 (Kopi Susu Robusta)."""
    today  = date.today()
    expiry = today + timedelta(days=2)
    units: list[ProductionUnit] = []
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
    print(f"✅  {len(units)} production units dibuat (status READY, siap di-loading)")
    return units


async def seed_absensi(db: AsyncSession, users: dict[str, User]) -> None:
    """Seed absensi 3 hari terakhir untuk driver1, driver2, dan produksi."""
    today = date.today()
    records = []

    absensi_data = [
        # (user_key, hari_offset, status, jam_masuk, jam_keluar, keterangan)
        ("driver1",  0,  StatusAbsensi.HADIR, time(7, 30), time(17, 0),  None),
        ("driver2",  0,  StatusAbsensi.HADIR, time(7, 45), time(17, 15), None),
        ("produksi", 0,  StatusAbsensi.HADIR, time(8, 0),  time(17, 0),  None),
        ("driver1",  -1, StatusAbsensi.HADIR, time(7, 25), time(17, 5),  None),
        ("driver2",  -1, StatusAbsensi.IZIN,  None,        None,         "Izin keperluan keluarga"),
        ("produksi", -1, StatusAbsensi.HADIR, time(7, 55), time(17, 0),  None),
        ("driver1",  -2, StatusAbsensi.SAKIT, None,        None,         "Demam, ada surat dokter"),
        ("driver2",  -2, StatusAbsensi.HADIR, time(7, 40), time(17, 10), None),
        ("produksi", -2, StatusAbsensi.HADIR, time(8, 5),  time(17, 0),  None),
    ]

    admin = users["admin"]
    for user_key, offset, status, jam_masuk, jam_keluar, ket in absensi_data:
        a = Absensi(
            user_id=users[user_key].id,
            tanggal=today + timedelta(days=offset),
            status=status,
            jam_masuk=jam_masuk,
            jam_keluar=jam_keluar,
            keterangan=ket,
            dicatat_oleh=admin.id,
        )
        db.add(a)
        records.append(a)

    await db.flush()
    print(f"✅  {len(records)} record absensi dibuat (3 hari, 3 karyawan)")


async def seed_loading(
    db: AsyncSession,
    gerobak_list: list[Gerobak],
    users: dict[str, User],
    units: list[ProductionUnit],
) -> None:
    """Seed 2 loading order:
    - LO-1: DRAFT  — Gerobak Menteng, driver1, 3 unit di-scan
    - LO-2: CONFIRMED — Gerobak Sudirman, driver2, 0 item (baru dikonfirmasi)
    """
    today = date.today()
    admin = users["admin"]

    # ── Loading Order 1: DRAFT dengan 3 item
    lo1 = LoadingOrder(
        nomor_loading=f"LD-{today.strftime('%Y%m%d')}-0001",
        gerobak_id=gerobak_list[0].id,
        driver_id=users["driver1"].id,
        dibuat_oleh=admin.id,
        status=StatusLoading.DRAFT,
        catatan="Loading pertama hari ini",
    )
    db.add(lo1)
    await db.flush()

    # Scan 3 unit ke LO-1
    for unit in units[:3]:
        db.add(LoadingItem(
            loading_order_id=lo1.id,
            production_unit_id=unit.id,
            barcode_snapshot=unit.barcode,
            harga_modal_snapshot=unit.harga_modal,
        ))
        # Update status unit jadi DISPATCHED (sudah masuk loading draft)
        unit.status = StatusUnit.DISPATCHED

    await db.flush()

    # ── Loading Order 2: CONFIRMED tanpa item
    lo2 = LoadingOrder(
        nomor_loading=f"LD-{today.strftime('%Y%m%d')}-0002",
        gerobak_id=gerobak_list[1].id,
        driver_id=users["driver2"].id,
        dibuat_oleh=admin.id,
        status=StatusLoading.CONFIRMED,
        catatan="Sudah dikonfirmasi, siap dispatch",
    )
    db.add(lo2)
    await db.flush()

    print(f"✅  2 loading order dibuat (LO-1 DRAFT 3 item, LO-2 CONFIRMED 0 item)")


async def run_seed(fresh: bool = True) -> None:
    async with AsyncSessionLocal() as db:
        if fresh:
            await truncate_all(db)

        users         = await seed_users(db)
        bahan         = await seed_bahan_baku(db)
        await seed_stok(db, bahan, users["admin"])
        menu_list     = await seed_menu(db, bahan)
        gerobak_list  = await seed_gerobak(db, users)
        mo_list, line1a = await seed_mo(db, bahan, menu_list, users)
        units         = await seed_production_units(db, mo_list[0], line1a)
        await seed_absensi(db, users)
        await seed_loading(db, gerobak_list, users, units)

        await db.commit()
        print("\n🎉  Seed selesai!")
        print("\n📋  Akun tersedia:")
        print("   admin@sekopi.id        / admin123")
        print("   produksi@sekopi.id     / produksi123")
        print("   inventori@sekopi.id    / inventori123")
        print("   driver1@sekopi.id      / driver123")
        print("   driver2@sekopi.id      / driver123")
        print("   shareholder@sekopi.id  / shareholder123")
        print("\n🛒  Gerobak tersedia:")
        print("   GRB-001 Gerobak Menteng    (driver: Budi Santoso)")
        print("   GRB-002 Gerobak Sudirman   (driver: Andi Wijaya)")
        print("   GRB-003 Gerobak Kemang     (driver: Budi Santoso)")
        print("\n📦  Loading Order tersedia:")
        print(f"   LD-{date.today().strftime('%Y%m%d')}-0001  DRAFT      — Menteng, 3 unit")
        print(f"   LD-{date.today().strftime('%Y%m%d')}-0002  CONFIRMED  — Sudirman, 0 unit")
        print("\n🗓️  Absensi tersedia: 3 hari x 3 karyawan (driver1, driver2, produksi)")


if __name__ == "__main__":
    asyncio.run(run_seed())
