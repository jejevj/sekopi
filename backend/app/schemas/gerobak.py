from datetime import datetime
from pydantic import BaseModel


class MemberInfo(BaseModel):
    id: int
    full_name: str
    model_config = {"from_attributes": True}


class ShareholderGroupCreate(BaseModel):
    nama: str
    deskripsi: str | None = None
    porsi_saham: float = 0


class ShareholderGroupUpdate(BaseModel):
    nama: str | None = None
    deskripsi: str | None = None
    porsi_saham: float | None = None


class ShareholderGroupResponse(BaseModel):
    id: int
    nama: str
    deskripsi: str | None = None
    porsi_saham: float = 0
    members: list[MemberInfo] = []
    model_config = {"from_attributes": True}


class GerobakCreate(BaseModel):
    nama: str
    kode: str
    lokasi: str | None = None
    driver_id: int | None = None
    shareholder_group_id: int | None = None
    is_active: bool = True


class GerobakUpdate(BaseModel):
    nama: str | None = None
    kode: str | None = None
    lokasi: str | None = None
    driver_id: int | None = None
    shareholder_group_id: int | None = None
    is_active: bool | None = None


class DriverInfo(BaseModel):
    id: int
    full_name: str
    model_config = {"from_attributes": True}


class GerobakResponse(BaseModel):
    id: int
    nama: str
    kode: str
    lokasi: str | None = None
    driver: DriverInfo | None = None
    shareholder_group: ShareholderGroupResponse | None = None
    is_active: bool
    created_at: datetime | None = None
    model_config = {"from_attributes": True}
