from fastapi import APIRouter

from app.api.v1.endpoints import auth, users, inventori, produksi, driver, admin

api_router = APIRouter()

api_router.include_router(auth.router, prefix="/auth", tags=["Authentication"])
api_router.include_router(users.router, prefix="/users", tags=["Users"])
api_router.include_router(admin.router, prefix="/admin", tags=["Admin"])
api_router.include_router(inventori.router, prefix="/inventori", tags=["Inventori"])
api_router.include_router(produksi.router, prefix="/produksi", tags=["Produksi"])
api_router.include_router(driver.router, prefix="/driver", tags=["Driver"])
