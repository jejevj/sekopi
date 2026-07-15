from fastapi import APIRouter

from app.api.v1.endpoints import auth
from app.api.v1.endpoints import users
from app.api.v1.endpoints import profile
from app.api.v1.endpoints import inventori
from app.api.v1.endpoints import menu
from app.api.v1.endpoints import manufacturing_order
from app.api.v1.endpoints import production_unit
from app.api.v1.endpoints import penjualan
from app.api.v1.endpoints import return_order
from app.api.v1.endpoints import laporan
from app.api.v1.endpoints import gerobak
from app.api.v1.endpoints import purchase_order
from app.api.v1.endpoints import dividen
from app.api.v1.endpoints import loading
from app.api.v1.endpoints import absensi
from app.api.v1.endpoints import driver
from app.api.v1.endpoints import admin
from app.api.v1.endpoints import pengeluaran
from app.api.v1.endpoints import produksi

api_router = APIRouter()

api_router.include_router(auth.router,                prefix="/auth",                tags=["Auth"])
api_router.include_router(profile.router,             prefix="/profile",             tags=["Profile"])
api_router.include_router(users.router,               prefix="/users",               tags=["Users"])
api_router.include_router(inventori.router,           prefix="/inventori",            tags=["Inventori & Bahan Baku"])
api_router.include_router(menu.router,                prefix="/menu",                tags=["Menu & Resep"])
api_router.include_router(manufacturing_order.router, prefix="/manufacturing-orders", tags=["Manufacturing Orders"])
api_router.include_router(production_unit.router,     prefix="/production-units",     tags=["Production Units"])
api_router.include_router(penjualan.router,           prefix="/penjualan",            tags=["Penjualan"])
api_router.include_router(return_order.router,        prefix="/return",               tags=["Return Orders"])
api_router.include_router(laporan.router,             prefix="/laporan",              tags=["Laporan"])
api_router.include_router(gerobak.router,             prefix="/gerobak",              tags=["Gerobak & Shareholder Groups"])
api_router.include_router(purchase_order.router,      prefix="/pembelian",            tags=["Pembelian & Supplier"])
api_router.include_router(dividen.router,             prefix="/dividen",              tags=["Dividen & Saham"])
api_router.include_router(loading.router,             prefix="/loading",              tags=["Loading Orders"])
api_router.include_router(absensi.router,             prefix="/absensi",              tags=["Absensi"])
api_router.include_router(driver.router,              prefix="/driver",               tags=["Driver"])
api_router.include_router(admin.router,               prefix="/admin",                tags=["Admin"])
api_router.include_router(pengeluaran.router,         prefix="/pengeluaran",          tags=["Pengeluaran"])
api_router.include_router(produksi.router,            prefix="/produksi",             tags=["Produksi"])
