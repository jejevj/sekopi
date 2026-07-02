from datetime import datetime
from pydantic import BaseModel
from app.models.return_order import StatusReturnOrder, KategoriReturn, KondisiKonfirmasi


class ReturnItemCreate(BaseModel):
    barcode: str
    kategori: KategoriReturn
    catatan_driver: str | None = None


class ReturnItemResponse(BaseModel):
    id: int
    barcode: str
    mo_id: int
    nama_produk: str | None = None
    kategori: KategoriReturn
    kondisi_konfirmasi: KondisiKonfirmasi
    catatan_driver: str | None = None
    catatan_reviewer: str | None = None

    model_config = {"from_attributes": True}


class ReturnOrderCreate(BaseModel):
    pengiriman_id: int
    catatan_driver: str | None = None
    items: list[ReturnItemCreate]


class ReturnOrderResponse(BaseModel):
    id: int
    nomor_return: str
    pengiriman_id: int
    driver_id: int
    status: StatusReturnOrder
    catatan_driver: str | None = None
    catatan_reviewer: str | None = None
    reviewed_by: int | None = None
    reviewed_at: datetime | None = None
    created_at: datetime
    items: list[ReturnItemResponse] = []
    # Summary counts
    total_sisa: int = 0
    total_rusak: int = 0

    model_config = {"from_attributes": True}


class ReviewItemRequest(BaseModel):
    return_item_id: int
    kondisi_konfirmasi: KondisiKonfirmasi  # BAIK atau RUSAK_KONFIRMASI
    catatan_reviewer: str | None = None


class ReviewReturnOrderRequest(BaseModel):
    catatan_reviewer: str | None = None
    items: list[ReviewItemRequest]
