from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db, require_roles
from app.models.menu import Menu, Resep, ResepBahan
from app.models.user import User, UserRole
from app.schemas.menu import (
    MenuCreate, MenuUpdate, MenuResponse,
    ResepCreate, ResepResponse,
)

router = APIRouter()

ADMIN_ONLY  = (UserRole.ADMIN,)
VIEW_ROLES  = (UserRole.ADMIN, UserRole.PRODUKSI, UserRole.INVENTORI, UserRole.SHAREHOLDER)


def _build_menu_response(menu: Menu) -> MenuResponse:
    from app.schemas.menu import ResepBahanResponse
    resep_list = []
    for r in (menu.resep_list or []):
        bahan_list = [
            ResepBahanResponse(
                id=b.id,
                bahan_baku_id=b.bahan_baku_id,
                qty_per_unit=float(b.qty_per_unit),
                satuan=b.satuan,
                nama_bahan=b.bahan_baku.nama if b.bahan_baku else None,
            )
            for b in (r.bahan_list or [])
        ]
        resep_list.append(
            ResepResponse(
                id=r.id,
                menu_id=r.menu_id,
                nama_versi=r.nama_versi,
                is_active=r.is_active,
                catatan=r.catatan,
                bahan_list=bahan_list,
                created_at=r.created_at,
            )
        )
    return MenuResponse(
        id=menu.id,
        nama=menu.nama,
        deskripsi=menu.deskripsi,
        harga_jual=float(menu.harga_jual),
        is_active=menu.is_active,
        resep_list=resep_list,
        created_at=menu.created_at,
        updated_at=menu.updated_at,
    )


# ── MENU CRUD ────────────────────────────────────────────────

@router.get("/", response_model=list[MenuResponse])
async def list_menu(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(*VIEW_ROLES)),
):
    result = await db.execute(select(Menu).order_by(Menu.nama))
    menus = result.scalars().all()
    return [_build_menu_response(m) for m in menus]


@router.post("/", response_model=MenuResponse, status_code=status.HTTP_201_CREATED)
async def create_menu(
    payload: MenuCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(*ADMIN_ONLY)),
):
    existing = await db.execute(select(Menu).where(Menu.nama == payload.nama))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail=f"Menu '{payload.nama}' sudah ada")

    menu = Menu(
        nama=payload.nama,
        deskripsi=payload.deskripsi,
        harga_jual=payload.harga_jual,
    )
    db.add(menu)
    await db.flush()  # dapatkan menu.id

    if payload.resep:
        resep = Resep(
            menu_id=menu.id,
            nama_versi=payload.resep.nama_versi,
            catatan=payload.resep.catatan,
            is_active=True,
        )
        db.add(resep)
        await db.flush()
        for b in payload.resep.bahan_list:
            db.add(ResepBahan(
                resep_id=resep.id,
                bahan_baku_id=b.bahan_baku_id,
                qty_per_unit=b.qty_per_unit,
                satuan=b.satuan,
            ))

    await db.commit()
    await db.refresh(menu)
    return _build_menu_response(menu)


@router.get("/{menu_id}", response_model=MenuResponse)
async def get_menu(
    menu_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(*VIEW_ROLES)),
):
    menu = await db.get(Menu, menu_id)
    if not menu:
        raise HTTPException(status_code=404, detail="Menu tidak ditemukan")
    return _build_menu_response(menu)


@router.patch("/{menu_id}", response_model=MenuResponse)
async def update_menu(
    menu_id: int,
    payload: MenuUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(*ADMIN_ONLY)),
):
    menu = await db.get(Menu, menu_id)
    if not menu:
        raise HTTPException(status_code=404, detail="Menu tidak ditemukan")

    if payload.nama is not None:
        menu.nama = payload.nama
    if payload.deskripsi is not None:
        menu.deskripsi = payload.deskripsi
    if payload.harga_jual is not None:
        menu.harga_jual = payload.harga_jual
    if payload.is_active is not None:
        menu.is_active = payload.is_active

    await db.commit()
    await db.refresh(menu)
    return _build_menu_response(menu)


@router.delete("/{menu_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_menu(
    menu_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(*ADMIN_ONLY)),
):
    menu = await db.get(Menu, menu_id)
    if not menu:
        raise HTTPException(status_code=404, detail="Menu tidak ditemukan")
    await db.delete(menu)
    await db.commit()


# ── RESEP ────────────────────────────────────────────────────

@router.post("/{menu_id}/resep", response_model=ResepResponse, status_code=status.HTTP_201_CREATED)
async def tambah_resep(
    menu_id: int,
    payload: ResepCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(*ADMIN_ONLY)),
):
    """Tambah versi resep baru ke sebuah menu. Secara default tidak langsung aktif."""
    menu = await db.get(Menu, menu_id)
    if not menu:
        raise HTTPException(status_code=404, detail="Menu tidak ditemukan")

    resep = Resep(
        menu_id=menu_id,
        nama_versi=payload.nama_versi,
        catatan=payload.catatan,
        is_active=False,  # harus aktifkan manual via endpoint aktivasi
    )
    db.add(resep)
    await db.flush()

    for b in payload.bahan_list:
        db.add(ResepBahan(
            resep_id=resep.id,
            bahan_baku_id=b.bahan_baku_id,
            qty_per_unit=b.qty_per_unit,
            satuan=b.satuan,
        ))

    await db.commit()
    await db.refresh(resep)
    from app.schemas.menu import ResepBahanResponse
    return ResepResponse(
        id=resep.id,
        menu_id=resep.menu_id,
        nama_versi=resep.nama_versi,
        is_active=resep.is_active,
        catatan=resep.catatan,
        bahan_list=[
            ResepBahanResponse(
                id=b.id,
                bahan_baku_id=b.bahan_baku_id,
                qty_per_unit=float(b.qty_per_unit),
                satuan=b.satuan,
                nama_bahan=b.bahan_baku.nama if b.bahan_baku else None,
            )
            for b in resep.bahan_list
        ],
        created_at=resep.created_at,
    )


@router.post("/{menu_id}/resep/{resep_id}/aktifkan", response_model=ResepResponse)
async def aktifkan_resep(
    menu_id: int,
    resep_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(*ADMIN_ONLY)),
):
    """Set resep ini sebagai aktif. Resep lain di menu yang sama otomatis di-nonaktifkan."""
    resep = await db.get(Resep, resep_id)
    if not resep or resep.menu_id != menu_id:
        raise HTTPException(status_code=404, detail="Resep tidak ditemukan")

    # nonaktifkan semua resep lain di menu ini
    result = await db.execute(select(Resep).where(Resep.menu_id == menu_id, Resep.id != resep_id))
    for r in result.scalars().all():
        r.is_active = False

    resep.is_active = True
    await db.commit()
    await db.refresh(resep)

    from app.schemas.menu import ResepBahanResponse
    return ResepResponse(
        id=resep.id,
        menu_id=resep.menu_id,
        nama_versi=resep.nama_versi,
        is_active=resep.is_active,
        catatan=resep.catatan,
        bahan_list=[
            ResepBahanResponse(
                id=b.id,
                bahan_baku_id=b.bahan_baku_id,
                qty_per_unit=float(b.qty_per_unit),
                satuan=b.satuan,
                nama_bahan=b.bahan_baku.nama if b.bahan_baku else None,
            )
            for b in resep.bahan_list
        ],
        created_at=resep.created_at,
    )
