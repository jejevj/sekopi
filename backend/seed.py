"""Seeder - jalankan: python seed.py"""
import asyncio
from app.db.session import AsyncSessionLocal
from app.models.user import User, UserRole
from app.core.security import get_password_hash
from sqlalchemy import select

SEED_USERS = [
    {"nama": "Admin SekoPi",    "email": "admin@sekopi.com",       "password": "admin123",    "role": UserRole.ADMIN},
    {"nama": "Bagian Produksi", "email": "produksi@sekopi.com",    "password": "produksi123", "role": UserRole.PRODUKSI},
    {"nama": "Bagian Inventori","email": "inventori@sekopi.com",   "password": "inventori123","role": UserRole.INVENTORI},
    {"nama": "Driver Kopi",     "email": "driver@sekopi.com",      "password": "driver123",   "role": UserRole.DRIVER},
    {"nama": "Kasir Kopi",      "email": "kasir@sekopi.com",       "password": "kasir123",    "role": UserRole.KASIR},
    {"nama": "Shareholder",     "email": "shareholder@sekopi.com", "password": "holder123",   "role": UserRole.SHAREHOLDER},
]

async def seed():
    async with AsyncSessionLocal() as db:
        created = 0
        skipped = 0
        for u in SEED_USERS:
            result = await db.execute(select(User).where(User.email == u["email"]))
            existing = result.scalar_one_or_none()
            if existing:
                print(f"  SKIP  {u['email']} (sudah ada)")
                skipped += 1
                continue
            user = User(
                nama=u["nama"],
                email=u["email"],
                hashed_password=get_password_hash(u["password"]),
                role=u["role"],
                is_active=True,
            )
            db.add(user)
            created += 1
            print(f"  CREATE {u['email']} [{u['role'].value}]")
        await db.commit()
        print(f"\nSeeder selesai: {created} dibuat, {skipped} dilewati.")
        print("\nAkun tersedia:")
        for u in SEED_USERS:
            print(f"  {u['email']:35s} password: {u['password']}")

if __name__ == "__main__":
    print("Menjalankan seeder...\n")
    asyncio.run(seed())
