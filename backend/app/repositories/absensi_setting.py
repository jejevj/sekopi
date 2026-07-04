from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.absensi_setting import AbsensiSetting
from app.schemas.absensi import AbsensiSettingCreate, AbsensiSettingUpdate


class AbsensiSettingRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def list_all(self) -> list[AbsensiSetting]:
        result = await self.db.execute(select(AbsensiSetting).order_by(AbsensiSetting.id))
        return list(result.scalars().all())

    async def list_active(self) -> list[AbsensiSetting]:
        result = await self.db.execute(
            select(AbsensiSetting).where(AbsensiSetting.is_active == True).order_by(AbsensiSetting.id)
        )
        return list(result.scalars().all())

    async def get_by_id(self, setting_id: int) -> Optional[AbsensiSetting]:
        return await self.db.get(AbsensiSetting, setting_id)

    async def create(self, data: AbsensiSettingCreate) -> AbsensiSetting:
        obj = AbsensiSetting(**data.model_dump())
        self.db.add(obj)
        await self.db.commit()
        await self.db.refresh(obj)
        return obj

    async def update(self, obj: AbsensiSetting, data: AbsensiSettingUpdate) -> AbsensiSetting:
        for k, v in data.model_dump(exclude_unset=True).items():
            setattr(obj, k, v)
        await self.db.commit()
        await self.db.refresh(obj)
        return obj

    async def delete(self, obj: AbsensiSetting) -> None:
        await self.db.delete(obj)
        await self.db.commit()
