"""Helper timezone WIB (UTC+7) untuk seluruh aplikasi."""
from datetime import datetime, timezone, timedelta

WIB = timezone(timedelta(hours=7))


def to_wib(dt: datetime | None) -> datetime | None:
    """Konversi datetime apapun ke WIB. Return None jika input None."""
    if dt is None:
        return None
    if dt.tzinfo is None:
        # Anggap UTC kalau naive
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(WIB)


def now_wib() -> datetime:
    """Waktu sekarang dalam WIB."""
    return datetime.now(WIB)


def parse_datetime_wib(s: str) -> datetime:
    """
    Parse string datetime dari frontend.
    Mendukung format:
      - '2026-07-04T19:30'        (naive, dianggap WIB)
      - '2026-07-04T19:30:00'
      - '2026-07-04T12:30:00+07:00'
      - '2026-07-04'              (tanggal saja, jam = 00:00 WIB)
    Selalu return datetime aware WIB.
    """
    s = s.strip()
    # Coba parse ISO dengan timezone
    for fmt in ("%Y-%m-%dT%H:%M:%S%z", "%Y-%m-%dT%H:%M%z"):
        try:
            return datetime.strptime(s, fmt).astimezone(WIB)
        except ValueError:
            pass
    # Naive (anggap WIB)
    for fmt in ("%Y-%m-%dT%H:%M:%S", "%Y-%m-%dT%H:%M", "%Y-%m-%d"):
        try:
            dt = datetime.strptime(s, fmt)
            return dt.replace(tzinfo=WIB)
        except ValueError:
            pass
    raise ValueError(f"Format datetime tidak dikenali: {s}")
