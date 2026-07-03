from datetime import datetime
from pydantic import BaseModel


# ── Shareholder Group ─────────────────────────────────────────────────────────

class ShareholderGroupCreate(BaseModel):
    nama: str
    deskripsi: str | None = None

class ShareholderGroupUpdate(BaseModel):
    nama: str | None = None
    deskripsi: str | None = None

class ShareholderMemberResponse(BaseModel):
    id: int
    full_name: str
    email: str
    role: str
    model_config = {"from_attributes": True}

class ShareholderGroupResponse(BaseModel):
    id: int
    nama: str
    deskripsi: str | None = None
    created_at: datetime | None = None
    members: list[ShareholderMemberResponse] = []
    model_config = {"from_attributes": True}


# ── Gerobak ───────────────────────────────────────────────────────────────────

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

class GerobakDriverInfo(BaseModel):
    id: int
    full_name: str
    email: str
    model_config = {"from_attributes": True}

class GerobakGroupInfo(BaseModel):
    id: int
    nama: str
    model_config = {"from_attributes": True}

class GerobakResponse(BaseModel):
    id: int
    nama: str
    kode: str
    lokasi: str | None = None
    is_active: bool
    driver: GerobakDriverInfo | None = None
    shareholder_group: GerobakGroupInfo | None = None
    created_at: datetime | None = None
    model_config = {"from_attributes": True}
