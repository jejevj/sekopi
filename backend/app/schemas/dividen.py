from datetime import date, datetime
from pydantic import BaseModel, model_validator
from app.models.dividen import StatusDividen


# ── Gaji Karyawan ────────────────────────────────────────────────────────────
class GajiCreate(BaseModel):
    periode_label:  str
    periode_dari:   date
    periode_sampai: date
    total_gaji:     float
    catatan:        str | None = None

    @model_validator(mode="after")
    def validate_dates(self):
        if self.periode_sampai < self.periode_dari:
            raise ValueError("periode_sampai tidak boleh sebelum periode_dari")
        return self

class GajiResponse(BaseModel):
    id: int
    periode_label:  str
    periode_dari:   date
    periode_sampai: date
    total_gaji:     float
    catatan:        str | None = None
    dibuat_user:    dict
    created_at:     datetime
    model_config = {"from_attributes": True}


# ── Kalkulasi Preview (sebelum simpan) ───────────────────────────────────────
class KalkulasiRequest(BaseModel):
    periode_label:  str
    periode_dari:   date
    periode_sampai: date
    total_gaji:     float          # total gaji semua karyawan periode ini
    catatan:        str | None = None

class KalkulasiPerGrup(BaseModel):
    group_id:         int
    group_nama:       str
    porsi_saham:      float
    total_penjualan:  float
    total_pembelian:  float
    total_gaji_grup:  float        # total_gaji / jumlah_grup
    laba_bersih_grup: float
    jumlah_dividen:   float

class KalkulasiPreviewResponse(BaseModel):
    periode_label:    str
    periode_dari:     date
    periode_sampai:   date
    jumlah_grup:      int
    total_penjualan:  float        # grand total revenue
    total_pembelian:  float        # grand total PO
    total_gaji:       float
    beban_gaji_per_grup: float
    total_porsi_saham: float       # validasi: harus == 100
    sisa_porsi:       float        # 100 - total_porsi (kas perusahaan)
    per_grup:         list[KalkulasiPerGrup]


# ── Dividen Distribusi ───────────────────────────────────────────────────────
class DividenResponse(BaseModel):
    id: int
    group_id:         int
    group_nama:       str = ""
    periode_label:    str
    periode_dari:     date
    periode_sampai:   date
    total_penjualan:  float
    total_pembelian:  float
    total_gaji_grup:  float
    laba_bersih_grup: float
    porsi_saham:      float
    jumlah_dividen:   float
    status:           StatusDividen
    tanggal_bayar:    date | None = None
    catatan:          str | None = None
    created_at:       datetime
    model_config = {"from_attributes": True}

class DividenBayarRequest(BaseModel):
    tanggal_bayar: date


# ── Porsi Saham Update ───────────────────────────────────────────────────────
class PorsiSahamUpdate(BaseModel):
    porsi_saham: float

    @model_validator(mode="after")
    def validate_range(self):
        if not (0 <= self.porsi_saham <= 100):
            raise ValueError("porsi_saham harus antara 0 dan 100")
        return self
