from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db, require_roles
from app.models.user import User, UserRole
from app.models.produksi import Produksi
from app.repositories.base import BaseRepository
from app.schemas.produksi import ProduksiCreate, ProduksiResponse, ProduksiUpdate

router = APIRouter()

PRODUKSI_ROLES = (UserRole.ADMIN, UserRole.PRODUKSI)


@router.get("/", response_model=list[ProduksiResponse])
async def list_produksi(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(*PRODUKSI_ROLES, UserRole.SHAREHOLDER)),
):
    repo = BaseRepository(Produksi, db)
    return await repo.get_all()


@router.post("/", response_model=ProduksiResponse)
async def create_produksi(
    payload: ProduksiCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(*PRODUKSI_ROLES)),
):
    produksi = Produksi(**payload.model_dump(), created_by=current_user.id)
    db.add(produksi)
    await db.commit()
    await db.refresh(produksi)
    return produksi


@router.patch("/{produksi_id}", response_model=ProduksiResponse)
async def update_produksi(
    produksi_id: int,
    payload: ProduksiUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(*PRODUKSI_ROLES)),
):
    repo = BaseRepository(Produksi, db)
    produksi = await repo.get(produksi_id)
    for field, value in payload.model_dump(exclude_none=True).items():
        setattr(produksi, field, value)
    await db.commit()
    await db.refresh(produksi)
    return produksi
