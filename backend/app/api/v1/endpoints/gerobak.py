from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from pydantic import BaseModel
from typing import Optional

from app.api.deps import get_db, get_current_user, require_roles
from app.models.gerobak import Gerobak, ShareholderGroup, GroupMembership
from app.models.user import User, UserRole

router = APIRouter()


# ─── Schemas ──────────────────────────────────────────────────────────────

class GerobakCreate(BaseModel):
    nama: str
    kode: str
    lokasi: Optional[str] = None
    driver_id: Optional[int] = None
    shareholder_group_id: Optional[int] = None
    is_active: bool = True

class GerobakUpdate(BaseModel):
    nama: Optional[str] = None
    kode: Optional[str] = None
    lokasi: Optional[str] = None
    driver_id: Optional[int] = None
    shareholder_group_id: Optional[int] = None
    is_active: Optional[bool] = None

class GrupCreate(BaseModel):
    nama: str
    deskripsi: Optional[str] = None

class GrupUpdate(BaseModel):
    nama: Optional[str] = None
    deskripsi: Optional[str] = None

class SetPorsiMember(BaseModel):
    porsi_saham: float  # 0.00 – 100.00, total semua member dalam grup harus <= 100


# ─── Gerobak CRUD ────────────────────────────────────────────────────────

@router.get("")
async def list_gerobak(db: AsyncSession = Depends(get_db), _=Depends(get_current_user)):
    result = await db.execute(select(Gerobak).order_by(Gerobak.id))
    return result.scalars().all()


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_gerobak(
    body: GerobakCreate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_roles(UserRole.ADMIN)),
):
    existing = await db.execute(select(Gerobak).where(Gerobak.kode == body.kode))
    if existing.scalar_one_or_none():
        raise HTTPException(400, f"Kode '{body.kode}' sudah digunakan")
    g = Gerobak(**body.model_dump())
    db.add(g)
    await db.commit()
    await db.refresh(g)
    return g


@router.patch("/{gerobak_id}")
async def update_gerobak(
    gerobak_id: int,
    body: GerobakUpdate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_roles(UserRole.ADMIN)),
):
    g = await db.get(Gerobak, gerobak_id)
    if not g:
        raise HTTPException(404, "Gerobak tidak ditemukan")
    for k, v in body.model_dump(exclude_none=True).items():
        setattr(g, k, v)
    await db.commit()
    await db.refresh(g)
    return g


@router.delete("/{gerobak_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_gerobak(
    gerobak_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_roles(UserRole.ADMIN)),
):
    g = await db.get(Gerobak, gerobak_id)
    if not g:
        raise HTTPException(404, "Gerobak tidak ditemukan")
    await db.delete(g)
    await db.commit()


# ─── ShareholderGroup CRUD ─────────────────────────────────────────────────

@router.get("/groups")
async def list_groups(db: AsyncSession = Depends(get_db), _=Depends(get_current_user)):
    result = await db.execute(select(ShareholderGroup).order_by(ShareholderGroup.id))
    groups = result.scalars().all()
    out = []
    for g in groups:
        total_porsi = sum(m.porsi_saham for m in g.memberships)
        out.append({
            "id": g.id,
            "nama": g.nama,
            "deskripsi": g.deskripsi,
            "total_porsi": float(total_porsi),
            "sisa_porsi": round(100 - float(total_porsi), 2),
            "gerobaks": [{"id": gb.id, "nama": gb.nama, "kode": gb.kode} for gb in g.gerobaks],
            "memberships": [
                {
                    "user_id": m.user_id,
                    "full_name": m.user.full_name,
                    "porsi_saham": float(m.porsi_saham),
                }
                for m in g.memberships
            ],
        })
    return out


@router.post("/groups", status_code=status.HTTP_201_CREATED)
async def create_group(
    body: GrupCreate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_roles(UserRole.ADMIN)),
):
    g = ShareholderGroup(nama=body.nama, deskripsi=body.deskripsi)
    db.add(g)
    await db.commit()
    await db.refresh(g)
    return {"id": g.id, "nama": g.nama, "deskripsi": g.deskripsi, "total_porsi": 0, "sisa_porsi": 100, "memberships": [], "gerobaks": []}


@router.patch("/groups/{group_id}")
async def update_group(
    group_id: int,
    body: GrupUpdate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_roles(UserRole.ADMIN)),
):
    g = await db.get(ShareholderGroup, group_id)
    if not g:
        raise HTTPException(404, "Grup tidak ditemukan")
    for k, v in body.model_dump(exclude_none=True).items():
        setattr(g, k, v)
    await db.commit()
    await db.refresh(g)
    return g


# ─── Member management ───────────────────────────────────────────────────

@router.post("/groups/{group_id}/members/{user_id}", status_code=status.HTTP_201_CREATED)
async def add_member(
    group_id: int, user_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_roles(UserRole.ADMIN)),
):
    g = await db.get(ShareholderGroup, group_id)
    if not g:
        raise HTTPException(404, "Grup tidak ditemukan")
    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(404, "User tidak ditemukan")
    existing = await db.execute(
        select(GroupMembership).where(GroupMembership.group_id == group_id, GroupMembership.user_id == user_id)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(400, "User sudah menjadi anggota grup ini")
    m = GroupMembership(group_id=group_id, user_id=user_id, porsi_saham=0)
    db.add(m)
    await db.commit()
    return {"group_id": group_id, "user_id": user_id, "porsi_saham": 0}


@router.delete("/groups/{group_id}/members/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_member(
    group_id: int, user_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_roles(UserRole.ADMIN)),
):
    await db.execute(
        delete(GroupMembership).where(GroupMembership.group_id == group_id, GroupMembership.user_id == user_id)
    )
    await db.commit()


@router.patch("/groups/{group_id}/members/{user_id}/porsi")
async def set_porsi_member(
    group_id: int, user_id: int,
    body: SetPorsiMember,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_roles(UserRole.ADMIN)),
):
    """Set porsi saham satu member dalam grup. Validasi total seluruh member <= 100."""
    if body.porsi_saham < 0 or body.porsi_saham > 100:
        raise HTTPException(400, "Porsi harus antara 0 dan 100")

    m = await db.execute(
        select(GroupMembership).where(GroupMembership.group_id == group_id, GroupMembership.user_id == user_id)
    )
    membership = m.scalar_one_or_none()
    if not membership:
        raise HTTPException(404, "Member tidak ditemukan dalam grup ini")

    all_members = await db.execute(
        select(GroupMembership).where(
            GroupMembership.group_id == group_id,
            GroupMembership.user_id != user_id
        )
    )
    total_others = sum(float(x.porsi_saham) for x in all_members.scalars().all())
    if total_others + body.porsi_saham > 100.001:
        raise HTTPException(400, f"Total porsi melebihi 100%. Sisa tersedia: {round(100 - total_others, 2)}%")

    membership.porsi_saham = body.porsi_saham
    await db.commit()
    return {"group_id": group_id, "user_id": user_id, "porsi_saham": body.porsi_saham}
