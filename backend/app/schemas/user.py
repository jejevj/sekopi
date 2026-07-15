from pydantic import BaseModel, EmailStr
from app.models.user import UserRole


class UserBase(BaseModel):
    email: EmailStr
    full_name: str
    role: UserRole


class UserCreate(UserBase):
    password: str


class UserUpdate(BaseModel):
    full_name: str | None = None
    role: UserRole | None = None
    is_active: bool | None = None


# Schema khusus untuk user memperbarui profilnya sendiri
class UserProfileUpdate(BaseModel):
    full_name: str | None = None
    email: EmailStr | None = None


# Schema untuk ganti password sendiri (bukan reset oleh admin)
class ChangePasswordPayload(BaseModel):
    current_password: str
    new_password: str


class UserResponse(UserBase):
    id: int
    is_active: bool

    model_config = {"from_attributes": True}


class Token(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user: UserResponse


class TokenPayload(BaseModel):
    sub: str | None = None
    refresh_token: str | None = None
