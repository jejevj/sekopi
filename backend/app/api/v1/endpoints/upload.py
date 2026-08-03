from fastapi import APIRouter, Depends, UploadFile, File

from app.api.deps import get_current_user
from app.models.user import User
from app.services.r2_service import r2_service

router = APIRouter()


@router.post("/image")
async def upload_image(
    file: UploadFile = File(...),
    folder: str = "general",
    current_user: User = Depends(get_current_user),
):
    """
    Upload satu gambar ke Cloudflare R2.
    Mengembalikan URL publik gambar.

    Query param `folder` untuk mengelompokkan file (default: general).
    Contoh folder: absensi, menu, profil, return
    """
    url = await r2_service.upload_image(file, folder=folder)
    return {"url": url}
