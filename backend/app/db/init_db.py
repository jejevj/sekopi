from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.security import get_password_hash
from app.models.user import User, UserRole
from app.repositories.user_repo import UserRepository


async def init_db(db: AsyncSession) -> None:
    user_repo = UserRepository(db)
    existing = await user_repo.get_by_email(settings.FIRST_SUPERUSER_EMAIL)
    if not existing:
        admin = User(
            email=settings.FIRST_SUPERUSER_EMAIL,
            hashed_password=get_password_hash(settings.FIRST_SUPERUSER_PASSWORD),
            full_name="Super Admin",
            role=UserRole.ADMIN,
            is_active=True,
        )
        db.add(admin)
        await db.commit()
