from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from app.core.config import settings

_is_sqlite = settings.DATABASE_URL.startswith("sqlite")

# SQLite takes no pool arguments; Postgres wants a bounded pool with recycling
# so connections killed by the server (or a proxy idle timeout) aren't handed
# out stale. pool_pre_ping trades one cheap round-trip for that guarantee.
_engine_kwargs: dict = {"echo": settings.DEBUG and _is_sqlite}
if not _is_sqlite:
    _engine_kwargs.update(
        pool_size=10,
        max_overflow=20,
        pool_recycle=1800,
        pool_pre_ping=True,
    )
    # Transaction-mode poolers (Neon's `-pooler` host, PgBouncer, Supabase's
    # 6543 port) hand a different backend to each transaction, so a prepared
    # statement cached against one connection may not exist on the next. That
    # surfaces as an intermittent "prepared statement __asyncpg_stmt_x__ does
    # not exist" under concurrency rather than at startup, so disable the cache
    # rather than wait to be surprised in production.
    if "-pooler." in settings.DATABASE_URL or "pgbouncer=true" in settings.DATABASE_URL:
        _engine_kwargs["connect_args"] = {
            "statement_cache_size": 0,
            "prepared_statement_cache_size": 0,
        }

engine = create_async_engine(settings.DATABASE_URL, **_engine_kwargs)
async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


async def get_db():
    async with async_session() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise


async def init_db():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
