import logging
from datetime import date, timedelta

from sqlalchemy import select, and_, func

from app.db.session import AsyncSessionLocal
from app.models.production_unit import ProductionUnit, StatusUnit
from app.models.bahan_baku import BahanBaku
from app.models.stok import Stok, TipeTransaksiStok

logger = logging.getLogger(__name__)


async def task_mark_expired_units() -> None:
    """
    Cron: Setiap hari jam 00:01 WIB
    Tandai semua unit yang melewati expiry date sebagai EXPIRED.
    """
    logger.info("[CRON] Menjalankan task: mark_expired_units")
    async with AsyncSessionLocal() as db:
        try:
            today = date.today()
            result = await db.execute(
                select(ProductionUnit).where(
                    and_(
                        ProductionUnit.expiry_date < today,
                        ProductionUnit.status.in_([
                            StatusUnit.READY,
                            StatusUnit.DISPATCHED,
                            StatusUnit.DELIVERED,
                        ])
                    )
                )
            )
            units = list(result.scalars().all())
            for unit in units:
                unit.status = StatusUnit.EXPIRED
            await db.commit()
            logger.info(f"[CRON] mark_expired_units: {len(units)} unit ditandai EXPIRED")
        except Exception as e:
            logger.error(f"[CRON] mark_expired_units ERROR: {e}")
            await db.rollback()


async def task_expiry_warning_log() -> None:
    """
    Cron: Setiap hari jam 07:00 WIB
    Log warning unit yang akan expired dalam 2 hari ke depan.
    """
    logger.info("[CRON] Menjalankan task: expiry_warning_log")
    async with AsyncSessionLocal() as db:
        try:
            today = date.today()
            threshold = today + timedelta(days=2)
            result = await db.execute(
                select(ProductionUnit).where(
                    and_(
                        ProductionUnit.expiry_date <= threshold,
                        ProductionUnit.expiry_date >= today,
                        ProductionUnit.status.in_([
                            StatusUnit.READY,
                            StatusUnit.DISPATCHED,
                            StatusUnit.DELIVERED,
                        ])
                    )
                ).order_by(ProductionUnit.expiry_date.asc())
            )
            units = list(result.scalars().all())
            if units:
                logger.warning(
                    f"[CRON] expiry_warning: {len(units)} unit akan expired dalam 2 hari!"
                )
                for u in units:
                    hari = (u.expiry_date - today).days
                    logger.warning(
                        f"  -> {u.barcode} | {u.nama_produk} | "
                        f"Expiry: {u.expiry_date} ({hari} hari lagi) | Status: {u.status}"
                    )
            else:
                logger.info("[CRON] expiry_warning: Tidak ada unit yang akan expired dalam 2 hari.")
        except Exception as e:
            logger.error(f"[CRON] expiry_warning_log ERROR: {e}")


async def task_low_stock_alert() -> None:
    """
    Cron: Setiap hari jam 07:00 WIB
    Log warning bahan baku yang saldo-nya di bawah stok_minimum.
    """
    logger.info("[CRON] Menjalankan task: low_stock_alert")
    async with AsyncSessionLocal() as db:
        try:
            result = await db.execute(select(BahanBaku))
            semua_bahan = list(result.scalars().all())

            alerts = []
            for bahan in semua_bahan:
                masuk = await db.execute(
                    select(func.sum(Stok.jumlah)).where(
                        and_(
                            Stok.bahan_baku_id == bahan.id,
                            Stok.tipe == TipeTransaksiStok.MASUK,
                        )
                    )
                )
                keluar = await db.execute(
                    select(func.sum(Stok.jumlah)).where(
                        and_(
                            Stok.bahan_baku_id == bahan.id,
                            Stok.tipe == TipeTransaksiStok.KELUAR,
                        )
                    )
                )
                saldo = float(masuk.scalar() or 0) - float(keluar.scalar() or 0)
                if saldo <= float(bahan.stok_minimum):
                    alerts.append((bahan.nama, saldo, float(bahan.stok_minimum), bahan.satuan))

            if alerts:
                logger.warning(f"[CRON] low_stock_alert: {len(alerts)} bahan baku di bawah minimum!")
                for nama, saldo, minimum, satuan in alerts:
                    logger.warning(
                        f"  -> {nama}: saldo {saldo} {satuan} "
                        f"(minimum: {minimum} {satuan})"
                    )
            else:
                logger.info("[CRON] low_stock_alert: Semua stok aman.")
        except Exception as e:
            logger.error(f"[CRON] low_stock_alert ERROR: {e}")
