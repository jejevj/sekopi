from fastapi import APIRouter

from app.api.v1.endpoints import (
    auth,
    users,
    bahan_baku,
    menu,
    manufacturing_order,
    production_unit,
    pengiriman,
    penjualan,
    return_order,
    laporan,
    gerobak,
    purchase_order,
    dividen,
    loading,
    absensi,
)

api_router = APIRouter()

api_router.include_router(auth.router,                prefix="/auth",               tags=["Auth"])
api_router.include_router(users.router,               prefix="/users",              tags=["Users"])
api_router.include_router(bahan_baku.router,          prefix="/bahan-baku",         tags=["Bahan Baku"])
api_router.include_router(menu.router,                prefix="/menu",               tags=["Menu & Resep"])
api_router.include_router(manufacturing_order.router, prefix="/manufacturing-orders", tags=["Manufacturing Orders"])
api_router.include_router(production_unit.router,     prefix="/production-units",   tags=["Production Units"])
api_router.include_router(pengiriman.router,          prefix="/pengiriman",          tags=["Pengiriman"])
api_router.include_router(penjualan.router,           prefix="/penjualan",           tags=["Penjualan"])
api_router.include_router(return_order.router,        prefix="/return",              tags=["Return Orders"])
api_router.include_router(laporan.router,             prefix="/laporan",             tags=["Laporan"])
api_router.include_router(gerobak.router,             prefix="/gerobak",             tags=["Gerobak & Shareholder Groups"])
api_router.include_router(purchase_order.router,      prefix="/pembelian",           tags=["Pembelian & Supplier"])
api_router.include_router(dividen.router,             prefix="/dividen",             tags=["Dividen & Saham"])
api_router.include_router(loading.router,             prefix="/loading",             tags=["Loading Orders"])
api_router.include_router(absensi.router,             prefix="/absensi",             tags=["Absensi"])
