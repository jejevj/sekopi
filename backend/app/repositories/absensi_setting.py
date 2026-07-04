from typing import Optional

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.absensi_setting import AbsensiSetting
from app.schemas.absensi import AbsensiSettingCreate, AbsensiSettingUpdate


class AbsensiSettingRepository:
    def __init__(self, db: Session):
        self.db = db

    def list_all(self) -> list[AbsensiSetting]:
        return list(self.db.scalars(select(AbsensiSetting).order_by(AbsensiSetting.id)))

    def list_active(self) -> list[AbsensiSetting]:
        return list(
            self.db.scalars(
                select(AbsensiSetting).where(AbsensiSetting.is_active == True).order_by(AbsensiSetting.id)
            )
        )

    def get_by_id(self, setting_id: int) -> Optional[AbsensiSetting]:
        return self.db.get(AbsensiSetting, setting_id)

    def create(self, data: AbsensiSettingCreate) -> AbsensiSetting:
        obj = AbsensiSetting(**data.model_dump())
        self.db.add(obj)
        self.db.commit()
        self.db.refresh(obj)
        return obj

    def update(self, obj: AbsensiSetting, data: AbsensiSettingUpdate) -> AbsensiSetting:
        for k, v in data.model_dump(exclude_unset=True).items():
            setattr(obj, k, v)
        self.db.commit()
        self.db.refresh(obj)
        return obj

    def delete(self, obj: AbsensiSetting) -> None:
        self.db.delete(obj)
        self.db.commit()
