from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db, require_roles
from app.models.gerobak import Gerobak, ShareholderGroup, shareholder_group_members
from app.models.user import User, UserRole
from app.schemas.gerobak import (
    GerobakCreate, GerobakUpdate, GerobakResponse,
    ShareholderGroupCreate, ShareholderGroupUpdate, ShareholderGroupResponse,
)

router = APIRouter()
ADMIN_ONLY = (UserRole.ADMIN,)


# ── Shareholder Groups ────────────────────────────────────────────────────────

@router.get("/groups", response_model=list[ShareholderGroupResponse])
async def list_groups(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(*ADMIN_ONLY)),
):
    result = await db.execute(select(ShareholderGroup).order_by(ShareholderGroup.nama))
    return result.scalars().all()


@router.post("/groups", response_model=ShareholderGroupResponse, status_code=201)
async def create_group(
    payload: ShareholderGroupCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(*ADMIN_ONLY)),
):
    grp = ShareholderGroup(**payload.model_dump())
    db.add(grp)
    await db.commit()
    await db.refresh(grp)
    return grp


@router.patch("/groups/{group_id}", response_model=ShareholderGroupResponse)
async def update_group(
    group_id: int,
    payload: ShareholderGroupUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(*ADMIN_ONLY)),
):
    grp = await db.get(ShareholderGroup, group_id)
    if not grp:
        raise HTTPException(404, "Grup tidak ditemukan")
    for k, v in payload.model_dump(exclude_none=True).items():
        setattr(grp, k, v)
    await db.commit()
    await db.refresh(grp)
    return grp


@router.post("/groups/{group_id}/members/{user_id}", status_code=204)
async def add_member(
    group_id: int, user_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(*ADMIN_ONLY)),
):
    grp = await db.get(ShareholderGroup, group_id)
    user = await db.get(User, user_id)
    if not grp or not user:
        raise HTTPException(404, "Grup atau user tidak ditemukan")
    if user.role != UserRole.SHAREHOLDER:
        raise HTTPException(400, "User bukan shareholder")
    await db.execute(
        shareholder_group_members.insert().prefix_with("OR IGNORE").values(group_id=group_id, user_id=user_id)
    )
    await db.commit()


@router.delete("/groups/{group_id}/members/{user_id}", status_code=204)
async def remove_member(
    group_id: int, user_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(*ADMIN_ONLY)),
):
    await db.execute(
        delete(shareholder_group_members).where(
            shareholder_group_members.c.group_id == group_id,
            shareholder_group_members.c.user_id == user_id,
        )
    )
    await db.commit()


# ── Gerobak CRUD ──────────────────────────────────────────────────────────────

@router.get("", response_model=list[GerobakResponse])
async def list_gerobak(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.SHAREHOLDER)),
):
    result = await db.execute(select(Gerobak).order_by(Gerobak.nama))
    return result.scalars().all()


@router.post("", response_model=GerobakResponse, status_code=201)
async def create_gerobak(
    payload: GerobakCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(*ADMIN_ONLY)),
):
    gerobak = Gerobak(**payload.model_dump())
    db.add(gerobak)
    await db.commit()
    await db.refresh(gerobak)
    return gerobak


@router.get("/{gerobak_id}", response_model=GerobakResponse)
async def get_gerobak(
    gerobak_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.SHAREHOLDER)),
):
    g = await db.get(Gerobak, gerobak_id)
    if not g:
        raise HTTPException(404, "Gerobak tidak ditemukan")
    return g


@router.patch("/{gerobak_id}", response_model=GerobakResponse)
async def update_gerobak(
    gerobak_id: int,
    payload: GerobakUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(*ADMIN_ONLY)),
):
    g = await db.get(Gerobak, gerobak_id)
    if not g:
        raise HTTPException(404, "Gerobak tidak ditemukan")
    for k, v in payload.model_dump(exclude_none=True).items():
        setattr(g, k, v)
    await db.commit()
    await db.refresh(g)
    return g


@router.delete("/{gerobak_id}", status_code=204)
async def delete_gerobak(
    gerobak_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(*ADMIN_ONLY)),
):
    g = await db.get(Gerobak, gerobak_id)
    if not g:
        raise HTTPException(404, "Gerobak tidak ditemukan")
    await db.delete(g)
    await db.commit()
