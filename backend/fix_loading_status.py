"""
fix_loading_status.py
=====================
One-time EOF script untuk memperbaiki data existing:

  Masalah: LoadingOrder yang semua unit-nya sudah di-review (tidak ada lagi
           unit ON_GEROBAK/DISPATCHED) tapi statusnya masih DISPATCHED.

  Fix: Set LoadingOrder.status = RETURNED untuk semua loading yang memenuhi
       kondisi tersebut.

Cara jalankan (dari folder backend/):
    python fix_loading_status.py

Atau jika pakai docker:
    docker compose exec backend python fix_loading_status.py
"""

import asyncio
from datetime import datetime, timezone

from sqlalchemy import select, func, update
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker

# Import settings dari app
import sys, os
sys.path.insert(0, os.path.dirname(__file__))

from app.core.config import settings
from app.models.loading import LoadingOrder, StatusLoading
from app.models.production_unit import ProductionUnit, StatusUnit


async def fix_loading_status():
    engine = create_async_engine(settings.DATABASE_URL, echo=False)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with async_session() as db:
        # Ambil semua loading yang masih DISPATCHED
        result = await db.execute(
            select(LoadingOrder).where(
                LoadingOrder.status == StatusLoading.DISPATCHED
            )
        )
        dispatched_loadings = list(result.scalars().all())
        print(f"[INFO] Ditemukan {len(dispatched_loadings)} loading berstatus DISPATCHED")

        fixed = 0
        skipped = 0
        now = datetime.now(timezone.utc)

        for lo in dispatched_loadings:
            # Hitung unit yang masih aktif di gerobak dari loading ini
            remaining_result = await db.execute(
                select(func.count(ProductionUnit.id)).where(
                    ProductionUnit.loading_order_id == lo.id,
                    ProductionUnit.status.in_([
                        StatusUnit.ON_GEROBAK,
                        StatusUnit.DISPATCHED,
                    ]),
                )
            )
            count_remaining = remaining_result.scalar() or 0

            if count_remaining == 0:
                lo.status     = StatusLoading.RETURNED
                lo.updated_at = now
                fixed += 1
                print(f"  [FIX] {lo.nomor_loading} → RETURNED (0 unit ON_GEROBAK tersisa)")
            else:
                skipped += 1
                print(f"  [SKIP] {lo.nomor_loading} → masih ada {count_remaining} unit ON_GEROBAK")

        await db.commit()
        print(f"\n[DONE] Fixed: {fixed} loading | Skipped: {skipped} loading")

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(fix_loading_status())
