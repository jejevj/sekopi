# This file is used by Alembic env.py to discover all models.
from app.db.base_class import Base  # noqa: F401

from app.models.user import User  # noqa: F401
from app.models.bahan_baku import BahanBaku  # noqa: F401
from app.models.stok import Stok  # noqa: F401
from app.models.produksi import Produksi  # noqa: F401
from app.models.pengiriman import Pengiriman  # noqa: F401
from app.models.manufacturing_order import ManufacturingOrder, MOBahanBaku  # noqa: F401
from app.models.production_unit import ProductionUnit  # noqa: F401
from app.models.penjualan import Penjualan  # noqa: F401
