"""Jalankan SEKALI: python fix_enums.py

Rename semua nilai enum PostgreSQL dari UPPERCASE ke lowercase
agar sinkron dengan model SQLAlchemy.
"""
import asyncio
from app.db.session import AsyncSessionLocal
from sqlalchemy import text

RENAMES = [
    # (typename, old_value, new_value)
    # statusunit
    ("statusunit", "READY",             "ready"),
    ("statusunit", "DISPATCHED",        "dispatched"),
    ("statusunit", "DELIVERED",         "delivered"),
    ("statusunit", "SOLD",              "sold"),
    ("statusunit", "VOID",              "void"),
    # statusunit values missing from DB - add them
    # kategorireturn
    ("kategorireturn",    "SISA",              "sisa"),
    ("kategorireturn",    "RUSAK",             "rusak"),
    # kondisikonfirmasi
    ("kondisikonfirmasi", "PENDING",           "pending"),
    ("kondisikonfirmasi", "BAIK",              "baik"),
    ("kondisikonfirmasi", "RUSAK_KONFIRMASI",  "rusak_konfirmasi"),
    # statusmo
    ("statusmo", "DRAFT",        "draft"),
    ("statusmo", "CONFIRMED",    "confirmed"),
    ("statusmo", "IN_PROGRESS",  "in_progress"),
    ("statusmo", "DONE",         "done"),
    ("statusmo", "CANCELLED",    "cancelled"),
    # statuspengiriman
    ("statuspengiriman", "PENDING",           "pending"),
    ("statuspengiriman", "DALAM_PERJALANAN",  "dalam_perjalanan"),
    ("statuspengiriman", "TERKIRIM",          "terkirim"),
    ("statuspengiriman", "GAGAL",             "gagal"),
    # statusproduksi
    ("statusproduksi", "DRAFT",    "draft"),
    ("statusproduksi", "PROSES",   "proses"),
    ("statusproduksi", "SELESAI",  "selesai"),
    ("statusproduksi", "BATAL",    "batal"),
    # statusreturnorder
    ("statusreturnorder", "DRAFT",      "draft"),
    ("statusreturnorder", "SUBMITTED",  "submitted"),
    ("statusreturnorder", "REVIEWED",   "reviewed"),
    # tipetransaksistok
    ("tipetransaksistok", "MASUK",   "masuk"),
    ("tipetransaksistok", "KELUAR",  "keluar"),
    # userrole
    ("userrole", "ADMIN",        "admin"),
    ("userrole", "PRODUKSI",     "produksi"),
    ("userrole", "INVENTORI",    "inventori"),
    ("userrole", "DRIVER",       "driver"),
    ("userrole", "SHAREHOLDER",  "shareholder"),
]

# statusunit missing values - need to ADD them
MISSING_STATUSUNIT = ["expired", "returned_good", "returned_damaged"]

async def fix():
    async with AsyncSessionLocal() as db:
        ok = 0
        skip = 0
        for typename, old, new in RENAMES:
            try:
                await db.execute(text(
                    f"ALTER TYPE {typename} RENAME VALUE :{"old_val"!r} TO :{"new_val"!r}"
                    .replace(":{!r}".format("old_val"), f"'{old}'")
                    .replace(":{!r}".format("new_val"), f"'{new}'")
                ))
                print(f"  OK    {typename}.{old} -> {new}")
                ok += 1
            except Exception as e:
                print(f"  SKIP  {typename}.{old}: {e}")
                skip += 1

        # Tambah nilai yang belum ada di DB
        for val in MISSING_STATUSUNIT:
            try:
                await db.execute(text(f"ALTER TYPE statusunit ADD VALUE IF NOT EXISTS '{val}'"))
                print(f"  ADD   statusunit.{val}")
            except Exception as e:
                print(f"  SKIP  statusunit.{val}: {e}")

        await db.commit()
        print(f"\nSelesai: {ok} direname, {skip} dilewati.")

if __name__ == "__main__":
    asyncio.run(fix())
