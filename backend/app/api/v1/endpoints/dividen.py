from datetime import date
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from pydantic import BaseModel
from typing import Optional

from app.api.deps import get_db, get_current_user, require_roles
from app.models.dividen import DividenDistribusi, StatusDividen
from app.models.gerobak import ShareholderGroup
from app.models.penjualan import Penjualan
from app.models.purchase_order import PurchaseOrder, StatusPO
from app.models.pengeluaran import Pengeluaran
from app.models.user import User, UserRole

router = APIRouter()


# ─── Schemas ──────────────────────────────────────────────────────────────

class KalkulasiInput(BaseModel):
    periode_label:  str
    periode_dari:   date
    periode_sampai: date
    catatan:        Optional[str] = None

class BayarInput(BaseModel):
    tanggal_bayar: date


# ─── Helper: total pengeluaran dalam periode ──────────────────────────────

async def _total_pengeluaran(
    db: AsyncSession,
    dari: date,
    sampai: date,
) -> float:
    res = await db.execute(
        select(func.coalesce(func.sum(Pengeluaran.jumlah), 0))
        .where(Pengeluaran.tanggal >= dari, Pengeluaran.tanggal <= sampai)
    )
    return float(res.scalar())


# ─── Helper: hitung laba per grup ────────────────────────────────────────

async def _hitung_laba_grup(
    db: AsyncSession,
    group_id: int,
    dari: date,
    sampai: date,
    beban_pengeluaran_grup: float,  # total pengeluaran / jumlah_grup
) -> dict:
    from app.models.gerobak import Gerobak

    res = await db.execute(select(Gerobak.id).where(Gerobak.shareholder_group_id == group_id))
    gerobak_ids = [r[0] for r in res.all()]

    if not gerobak_ids:
        return {"total_penjualan": 0, "total_pembelian": 0, "total_pengeluaran": beban_pengeluaran_grup, "laba_bersih": -beban_pengeluaran_grup}

    pjl = await db.execute(
        select(func.coalesce(func.sum(Penjualan.total_harga), 0))
        .where(
            Penjualan.gerobak_id.in_(gerobak_ids),
            func.date(Penjualan.tanggal) >= dari,
            func.date(Penjualan.tanggal) <= sampai,
        )
    )
    total_penjualan = float(pjl.scalar())

    jumlah_grup_res = await db.execute(select(func.count()).select_from(ShareholderGroup))
    jumlah_grup = jumlah_grup_res.scalar() or 1

    po = await db.execute(
        select(func.coalesce(func.sum(PurchaseOrder.total_harga), 0))
        .where(
            PurchaseOrder.status == StatusPO.DITERIMA,
            func.date(PurchaseOrder.tanggal_invoice) >= dari,
            func.date(PurchaseOrder.tanggal_invoice) <= sampai,
        )
    )
    total_pembelian_shared = float(po.scalar()) / jumlah_grup

    laba = total_penjualan - total_pembelian_shared - beban_pengeluaran_grup
    return {
        "total_penjualan": total_penjualan,
        "total_pembelian": total_pembelian_shared,
        "total_pengeluaran": beban_pengeluaran_grup,
        "laba_bersih": laba,
    }


# ─── Preview ──────────────────────────────────────────────────────────────

@router.post("/kalkulasi/preview")
async def preview_dividen(
    body: KalkulasiInput,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_roles(UserRole.ADMIN)),
):
    groups_res = await db.execute(select(ShareholderGroup).order_by(ShareholderGroup.id))
    groups = groups_res.scalars().all()
    if not groups:
        raise HTTPException(400, "Belum ada grup shareholder")

    jumlah_grup = len(groups)
    total_pengeluaran = await _total_pengeluaran(db, body.periode_dari, body.periode_sampai)
    beban_per_grup = total_pengeluaran / jumlah_grup

    per_grup = []
    total_penjualan_all = 0.0
    total_pembelian_all = 0.0

    for grp in groups:
        laba_data = await _hitung_laba_grup(db, grp.id, body.periode_dari, body.periode_sampai, beban_per_grup)
        total_penjualan_all += laba_data["total_penjualan"]
        total_pembelian_all += laba_data["total_pembelian"]
        total_porsi_grup = sum(float(m.porsi_saham) for m in grp.memberships)

        per_member = []
        for m in grp.memberships:
            dividen_user = laba_data["laba_bersih"] * float(m.porsi_saham) / 100
            per_member.append({
                "user_id":       m.user_id,
                "user_nama":     m.user.full_name,
                "porsi_saham":   float(m.porsi_saham),
                "jumlah_dividen": round(dividen_user, 2),
            })

        per_grup.append({
            "group_id":          grp.id,
            "group_nama":        grp.nama,
            "total_penjualan":   laba_data["total_penjualan"],
            "total_pembelian":   laba_data["total_pembelian"],
            "total_pengeluaran_grup": beban_per_grup,
            "laba_bersih_grup":  round(laba_data["laba_bersih"], 2),
            "total_porsi_grup":  round(total_porsi_grup, 2),
            "sisa_porsi":        round(100 - total_porsi_grup, 2),
            "per_member":        per_member,
        })

    return {
        "periode_label":        body.periode_label,
        "periode_dari":         body.periode_dari,
        "periode_sampai":       body.periode_sampai,
        "total_pengeluaran":    total_pengeluaran,
        "beban_pengeluaran_per_grup": beban_per_grup,
        "total_penjualan":      total_penjualan_all,
        "total_pembelian":      total_pembelian_all,
        "jumlah_grup":          jumlah_grup,
        "per_grup":             per_grup,
    }


# ─── Konfirmasi & Simpan ──────────────────────────────────────────────────

@router.post("/kalkulasi/konfirmasi", status_code=status.HTTP_201_CREATED)
async def konfirmasi_dividen(
    body: KalkulasiInput,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN)),
):
    dup = await db.execute(
        select(DividenDistribusi).where(DividenDistribusi.periode_label == body.periode_label).limit(1)
    )
    if dup.scalar_one_or_none():
        raise HTTPException(400, f"Periode '{body.periode_label}' sudah pernah dikonfirmasi")

    groups_res = await db.execute(select(ShareholderGroup).order_by(ShareholderGroup.id))
    groups = groups_res.scalars().all()
    if not groups:
        raise HTTPException(400, "Belum ada grup shareholder")

    jumlah_grup = len(groups)
    total_pengeluaran = await _total_pengeluaran(db, body.periode_dari, body.periode_sampai)
    beban_per_grup = total_pengeluaran / jumlah_grup

    created = []
    for grp in groups:
        laba_data = await _hitung_laba_grup(db, grp.id, body.periode_dari, body.periode_sampai, beban_per_grup)
        for m in grp.memberships:
            dividen_user = laba_data["laba_bersih"] * float(m.porsi_saham) / 100
            record = DividenDistribusi(
                group_id=grp.id,
                user_id=m.user_id,
                periode_label=body.periode_label,
                periode_dari=body.periode_dari,
                periode_sampai=body.periode_sampai,
                total_penjualan=laba_data["total_penjualan"],
                total_pembelian=laba_data["total_pembelian"],
                total_gaji_grup=beban_per_grup,   # kolom lama, simpan total pengeluaran per grup
                laba_bersih_grup=laba_data["laba_bersih"],
                porsi_saham=m.porsi_saham,
                jumlah_dividen=round(dividen_user, 2),
                catatan=body.catatan,
                dibuat_oleh=current_user.id,
            )
            db.add(record)
            created.append(record)

    await db.commit()
    return {"created": len(created), "periode_label": body.periode_label}


# ─── List & Bayar ─────────────────────────────────────────────────────────

@router.get("/")
async def list_dividen(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = select(DividenDistribusi).order_by(
        DividenDistribusi.periode_dari.desc(), DividenDistribusi.group_id
    )
    if current_user.role == UserRole.SHAREHOLDER:
        q = q.where(DividenDistribusi.user_id == current_user.id)
    result = await db.execute(q)
    rows = result.scalars().all()
    return [
        {
            "id":               r.id,
            "group_id":         r.group_id,
            "group_nama":       r.group.nama,
            "user_id":          r.user_id,
            "user_nama":        r.user.full_name,
            "periode_label":    r.periode_label,
            "periode_dari":     r.periode_dari,
            "periode_sampai":   r.periode_sampai,
            "total_penjualan":  float(r.total_penjualan),
            "total_pembelian":  float(r.total_pembelian),
            "total_pengeluaran_grup": float(r.total_gaji_grup),
            "laba_bersih_grup": float(r.laba_bersih_grup),
            "porsi_saham":      float(r.porsi_saham),
            "jumlah_dividen":   float(r.jumlah_dividen),
            "status":           r.status,
            "tanggal_bayar":    r.tanggal_bayar,
            "catatan":          r.catatan,
        }
        for r in rows
    ]


@router.patch("/{dividen_id}/bayar")
async def bayar_dividen(
    dividen_id: int,
    body: BayarInput,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN)),
):
    d = await db.get(DividenDistribusi, dividen_id)
    if not d:
        raise HTTPException(404)
    d.status = StatusDividen.DIBAYAR
    d.tanggal_bayar = body.tanggal_bayar
    await db.commit()
    return {"id": d.id, "status": d.status, "tanggal_bayar": d.tanggal_bayar}
