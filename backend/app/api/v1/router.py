from fastapi import APIRouter

from app.api.v1.endpoints import (
    auth,
    users,
    inventori,
    produksi,
    driver,
    admin,
    manufacturing_order,
    production_unit,
    penjualan,
)

api_router = APIRouter()

api_router.include_router(auth.router, prefix="/auth", tags=["Authentication"])
api_router.include_router(users.router, prefix="/users", tags=["Users"])
api_router.include_router(admin.router, prefix="/admin", tags=["Admin"])
api_router.include_router(inventori.router, prefix="/inventori", tags=["Inventori"])
api_router.include_router(produksi.router, prefix="/produksi", tags=["Produksi"])
api_router.include_router(driver.router, prefix="/driver", tags=["Driver"])
api_router.include_router(manufacturing_order.router, prefix="/manufacturing-orders", tags=["Manufacturing Orders"])
api_router.include_router(production_unit.router, prefix="/production-units", tags=["Production Units & Barcode"])
api_router.include_router(penjualan.router, prefix="/penjualan", tags=["Penjualan"])
