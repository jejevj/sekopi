from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db, require_roles
from app.models.user import User, UserRole
from app.core.scheduler import scheduler

router = APIRouter()


@router.get("/dashboard")
async def admin_dashboard(
    current_user: User = Depends(require_roles(UserRole.ADMIN)),
):
    return {"message": "Admin dashboard", "user": current_user.email}


@router.get("/scheduler/jobs")
async def list_scheduler_jobs(
    current_user: User = Depends(require_roles(UserRole.ADMIN)),
):
    """Lihat semua cron jobs yang terdaftar beserta jadwal berikutnya."""
    jobs = []
    for job in scheduler.get_jobs():
        jobs.append({
            "id": job.id,
            "name": job.name,
            "next_run_time": str(job.next_run_time) if job.next_run_time else "paused",
            "trigger": str(job.trigger),
        })
    return {"jobs": jobs, "total": len(jobs)}


@router.post("/scheduler/run/{job_id}")
async def run_job_now(
    job_id: str,
    current_user: User = Depends(require_roles(UserRole.ADMIN)),
):
    """Jalankan cron job secara manual (untuk testing atau kebutuhan darurat)."""
    job = scheduler.get_job(job_id)
    if not job:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail=f"Job '{job_id}' tidak ditemukan")
    job.modify(next_run_time=__import__('datetime').datetime.now(__import__('datetime').timezone.utc))
    return {"message": f"Job '{job_id}' dijadwalkan untuk jalan sekarang"}
