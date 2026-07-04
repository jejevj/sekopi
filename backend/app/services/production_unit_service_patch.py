# PATCH NOTES — Tambahkan method ini ke ProductionUnitService yang sudah ada
# File: backend/app/services/production_unit_service.py
#
# Tambahkan import berikut di bagian atas file:
#   from app.models.production_unit import GenerateBatch
#   from app.models.menu import KategoriSelisih
#   from app.schemas.production_unit import GenerateUnitsResponse, GenerateBatchResponse
#
# Lalu tambahkan method generate_units_with_batch di dalam class ProductionUnitService:

"""
async def generate_units_with_batch(
    self,
    mo_id: int,
    jumlah: int,
    expiry_date,
    harga_modal: float | None,
    user_id: int,
    alasan_selisih: str | None = None,
    kategori_selisih = None,
) -> GenerateUnitsResponse:
    from app.models.manufacturing_order import ManufacturingOrder
    from app.models.production_unit import GenerateBatch
    from app.schemas.production_unit import GenerateUnitsResponse, GenerateBatchResponse

    # Ambil MO dan validasi
    mo = await self.db.get(ManufacturingOrder, mo_id)
    if not mo:
        raise ValueError(f"Manufacturing Order ID {mo_id} tidak ditemukan")
    if mo.status.value not in ("confirmed", "in_progress", "done"):
        raise ValueError(f"MO status '{mo.status}' tidak boleh di-generate unit")

    # Ambil harga_jual dari Menu jika ada
    harga_jual = None
    if mo.menu_id:
        from app.models.menu import Menu
        menu = await self.db.get(Menu, mo.menu_id)
        if menu:
            harga_jual = float(menu.harga_jual)

    # Validasi selisih
    jumlah_target = int(mo.target_qty)
    selisih = jumlah - jumlah_target
    if selisih != 0 and not alasan_selisih:
        raise ValueError(
            f"Jumlah aktual ({jumlah}) berbeda dari target MO ({jumlah_target}). "
            "Wajib isi alasan_selisih."
        )

    # Generate unit menggunakan method lama
    units = await self.generate_units(mo_id, jumlah, expiry_date, harga_modal, user_id)

    # Update harga_jual di semua unit yang baru di-generate
    if harga_jual:
        from sqlalchemy import select
        from app.models.production_unit import ProductionUnit
        barcodes = [u.barcode for u in units]
        result = await self.db.execute(
            select(ProductionUnit).where(ProductionUnit.barcode.in_(barcodes))
        )
        for unit_obj in result.scalars().all():
            unit_obj.harga_jual = harga_jual
        await self.db.flush()

    # Simpan GenerateBatch
    batch = GenerateBatch(
        mo_id=mo_id,
        generated_by=user_id,
        jumlah_target=jumlah_target,
        jumlah_aktual=jumlah,
        selisih_qty=selisih,
        alasan_selisih=alasan_selisih,
        kategori_selisih=kategori_selisih,
        expiry_date=expiry_date,
        harga_modal=harga_modal,
        harga_jual=harga_jual,
    )
    self.db.add(batch)
    await self.db.commit()
    await self.db.refresh(batch)

    peringatan = None
    if selisih < 0:
        peringatan = f"Produksi KURANG {abs(selisih)} unit dari target. Alasan: {alasan_selisih}"
    elif selisih > 0:
        peringatan = f"Produksi LEBIH {selisih} unit dari target. Alasan: {alasan_selisih}"

    return GenerateUnitsResponse(
        batch=GenerateBatchResponse(
            id=batch.id,
            mo_id=batch.mo_id,
            jumlah_target=batch.jumlah_target,
            jumlah_aktual=batch.jumlah_aktual,
            selisih_qty=batch.selisih_qty,
            alasan_selisih=batch.alasan_selisih,
            kategori_selisih=batch.kategori_selisih,
            expiry_date=batch.expiry_date,
            harga_modal=float(batch.harga_modal) if batch.harga_modal else None,
            harga_jual=float(batch.harga_jual) if batch.harga_jual else None,
            created_at=batch.created_at,
        ),
        units=units,
        peringatan_selisih=peringatan,
    )
"""
