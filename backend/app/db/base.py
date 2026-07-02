from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    pass


# Import all models here so Alembic can detect them
from app.models.user import User  # noqa: F401, E402
from app.models.bahan_baku import BahanBaku  # noqa: F401, E402
from app.models.stok import Stok  # noqa: F401, E402
from app.models.produksi import Produksi  # noqa: F401, E402
from app.models.pengiriman import Pengiriman  # noqa: F401, E402
