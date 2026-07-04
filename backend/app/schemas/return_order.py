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


class LoadingOrderSnap(BaseModel):
    id: int
    nomor_loading: str

    model_config = {"from_attributes": True}


class ReturnOrderCreate(BaseModel):
    loading_order_id: int          # wajib — driver pilih loading trip miliknya hari ini
    catatan_driver: str | None = None
    items: list[ReturnItemCreate]


class ReturnOrderResponse(BaseModel):
    id: int
    nomor_return: str
    driver_id: int
    loading_order_id: int
    loading_order: LoadingOrderSnap | None = None
    status: StatusReturnOrder
    catatan_driver: str | None = None
    catatan_reviewer: str | None = None
    reviewed_by: int | None = None
    reviewed_at: datetime | None = None
    created_at: datetime
    items: list[ReturnItemResponse] = []
    total_sisa: int = 0
    total_rusak: int = 0

    model_config = {"from_attributes": True}


class ReviewItemRequest(BaseModel):
    return_item_id: int
    kondisi_konfirmasi: KondisiKonfirmasi
    catatan_reviewer: str | None = None


class ReviewReturnOrderRequest(BaseModel):
    catatan_reviewer: str | None = None
    items: list[ReviewItemRequest]


class LoadingOrderForReturnResponse(BaseModel):
    id: int
    nomor_loading: str
    gerobak_nama: str
    total_unit: int
    status: str

    model_config = {"from_attributes": True}
