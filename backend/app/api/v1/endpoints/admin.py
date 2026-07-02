from fastapi import APIRouter, Depends
from app.api.deps import require_roles
from app.models.user import User, UserRole

router = APIRouter()


@router.get("/dashboard")
async def admin_dashboard(
    current_user: User = Depends(require_roles(UserRole.ADMIN)),
):
    return {"message": "Admin dashboard", "user": current_user.email}
