from pydantic import BaseModel
from app.models.pengiriman import StatusPengiriman
from datetime import datetime


class PengirimanCreate(BaseModel):
    tujuan: str
    catatan: str | None = None


class PengirimanUpdate(BaseModel):
    status: StatusPengiriman | None = None
    catatan: str | None = None
    tanggal_tiba: datetime | None = None


class PengirimanResponse(PengirimanCreate):
    id: int
    driver_id: int
    status: StatusPengiriman

    model_config = {"from_attributes": True}
