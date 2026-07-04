# Import semua model agar Alembic & Base.metadata mengenali semua tabel
from app.db.base_class import Base  # noqa: F401
from app.models.user import User  # noqa: F401
from app.models.bahan_baku import BahanBaku  # noqa: F401
from app.models.menu import Menu, Resep, ResepBahan  # noqa: F401
from app.models.manufacturing_order import ManufacturingOrder, MOLine, MOBahanBaku  # noqa: F401
from app.models.production_unit import ProductionUnit, GenerateBatch  # noqa: F401
from app.models.stok import Stok  # noqa: F401
from app.models.pengiriman import Pengiriman  # noqa: F401
from app.models.penjualan import Penjualan  # noqa: F401
from app.models.return_order import ReturnOrder, ReturnItem  # noqa: F401
from app.models.purchase_order import PurchaseOrder, PurchaseOrderItem  # noqa: F401
from app.models.pengeluaran import Pengeluaran  # noqa: F401
from app.models.gerobak import Gerobak, ShareholderGroup, GroupMembership  # noqa: F401
from app.models.dividen import GajiKaryawan, DividenDistribusi  # noqa: F401
from app.models.produksi import Produksi  # noqa: F401
from app.models.supplier import Supplier  # noqa: F401
