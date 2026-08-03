import uuid
import mimetypes
from typing import Optional

import boto3
from botocore.config import Config
from botocore.exceptions import ClientError
from fastapi import HTTPException, UploadFile

from app.core.config import settings

# Ekstensi gambar yang diizinkan
ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp", "image/gif"}
MAX_FILE_SIZE = 5 * 1024 * 1024  # 5 MB


def _get_r2_client():
    """Buat boto3 S3 client yang mengarah ke Cloudflare R2."""
    return boto3.client(
        "s3",
        endpoint_url=f"https://{settings.R2_ACCOUNT_ID}.r2.cloudflarestorage.com",
        aws_access_key_id=settings.R2_ACCESS_KEY_ID,
        aws_secret_access_key=settings.R2_SECRET_ACCESS_KEY,
        config=Config(signature_version="s3v4"),
        region_name="auto",
    )


class R2Service:
    def __init__(self):
        self.client = _get_r2_client()
        self.bucket = settings.R2_BUCKET_NAME
        self.public_url = settings.R2_PUBLIC_URL.rstrip("/")

    async def upload_image(
        self,
        file: UploadFile,
        folder: str = "uploads",
    ) -> str:
        """
        Upload file gambar ke Cloudflare R2.
        Mengembalikan public URL file yang diupload.
        """
        content_type = file.content_type or ""
        if content_type not in ALLOWED_IMAGE_TYPES:
            raise HTTPException(
                status_code=400,
                detail=f"Tipe file tidak didukung: {content_type}. Gunakan JPEG, PNG, WebP, atau GIF.",
            )

        contents = await file.read()

        if len(contents) > MAX_FILE_SIZE:
            raise HTTPException(
                status_code=400,
                detail=f"Ukuran file terlalu besar. Maksimal {MAX_FILE_SIZE // (1024*1024)} MB.",
            )

        ext = mimetypes.guess_extension(content_type) or ".jpg"
        if ext == ".jpe":
            ext = ".jpg"
        filename = f"{folder}/{uuid.uuid4().hex}{ext}"

        try:
            self.client.put_object(
                Bucket=self.bucket,
                Key=filename,
                Body=contents,
                ContentType=content_type,
            )
        except ClientError as e:
            raise HTTPException(
                status_code=500,
                detail=f"Gagal upload ke R2: {e.response['Error']['Message']}",
            )

        return f"{self.public_url}/{filename}"

    async def upload_base64_image(
        self,
        base64_data: str,
        folder: str = "uploads",
    ) -> str:
        """
        Upload gambar dari format base64 string (data:image/jpeg;base64,...).
        Cocok untuk migrasi dari sistem lama yang masih kirim base64.
        """
        import base64

        if "," not in base64_data:
            raise HTTPException(400, "Format base64 tidak valid.")

        header, encoded = base64_data.split(",", 1)
        content_type = header.split(":")[1].split(";")[0]

        if content_type not in ALLOWED_IMAGE_TYPES:
            raise HTTPException(400, f"Tipe gambar tidak didukung: {content_type}")

        contents = base64.b64decode(encoded)

        if len(contents) > MAX_FILE_SIZE:
            raise HTTPException(400, f"Ukuran gambar terlalu besar. Maksimal {MAX_FILE_SIZE // (1024*1024)} MB.")

        ext = mimetypes.guess_extension(content_type) or ".jpg"
        if ext == ".jpe":
            ext = ".jpg"
        filename = f"{folder}/{uuid.uuid4().hex}{ext}"

        try:
            self.client.put_object(
                Bucket=self.bucket,
                Key=filename,
                Body=contents,
                ContentType=content_type,
            )
        except ClientError as e:
            raise HTTPException(500, f"Gagal upload ke R2: {e.response['Error']['Message']}")

        return f"{self.public_url}/{filename}"

    def delete_image(self, file_url: str) -> None:
        """
        Hapus file dari R2 berdasarkan URL publiknya.
        """
        if not file_url or not file_url.startswith(self.public_url):
            return

        key = file_url.replace(f"{self.public_url}/", "", 1)
        try:
            self.client.delete_object(Bucket=self.bucket, Key=key)
        except ClientError as e:
            raise HTTPException(500, f"Gagal hapus dari R2: {e.response['Error']['Message']}")


# Singleton instance
r2_service = R2Service()
