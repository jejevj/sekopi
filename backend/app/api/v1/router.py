from fastapi import APIRouter

from app.api.v1.endpoints import (
    auth, users, inventori, produksi, driver,
    admin, manufacturing_order, production_unit,
    penjualan, return_order, laporan, gerobak,
    purchase_order, dividen, pengeluaran,
)

api_router = APIRouter()

api_router.include_router(auth.router,                prefix="/auth",                 tags=["Authentication"])
api_router.include_router(users.router,               prefix="/users",                tags=["Users"])
api_router.include_router(admin.router,               prefix="/admin",                tags=["Admin"])
api_router.include_router(inventori.router,           prefix="/inventori",            tags=["Inventori"])
api_router.include_router(produksi.router,            prefix="/produksi",             tags=["Produksi"])
api_router.include_router(driver.router,              prefix="/driver",               tags=["Driver"])
api_router.include_router(manufacturing_order.router, prefix="/manufacturing-orders", tags=["Manufacturing Orders"])
api_router.include_router(production_unit.router,     prefix="/production-units",     tags=["Production Units"])
api_router.include_router(penjualan.router,           prefix="/penjualan",            tags=["Penjualan"])
api_router.include_router(return_order.router,        prefix="/returns",              tags=["Return Orders"])
api_router.include_router(laporan.router,             prefix="/laporan",              tags=["Laporan"])
api_router.include_router(gerobak.router,             prefix="/gerobak",              tags=["Gerobak & Shareholder Groups"])
api_router.include_router(purchase_order.router,      prefix="/pembelian",            tags=["Pembelian & Supplier"])
api_router.include_router(dividen.router,             prefix="/dividen",              tags=["Dividen & Saham"])
api_router.include_router(pengeluaran.router,         prefix="/pengeluaran",          tags=["Pengeluaran"])
