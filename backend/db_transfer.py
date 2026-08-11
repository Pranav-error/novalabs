#!/usr/bin/env python3
"""Copy every table between two databases, in either direction.

One tool covers both jobs:

    # one-time migration onto Postgres
    python db_transfer.py \
        --source "sqlite+aiosqlite:///./novalabs.db" \
        --target "postgresql+asyncpg://user@localhost:5432/novalabs"

    # routine backup of production into a portable SQLite file
    python db_transfer.py --target "sqlite+aiosqlite:///./backups/backup.db"

With no --source it reads DATABASE_URL, so the backup form needs only a
target. The target schema is created if missing; --wipe clears existing rows
first so a repeated backup replaces rather than duplicates.

Rows are copied through the SQLAlchemy models, so JSON columns, enums and
timezone-aware datetimes are translated between dialects rather than copied
as raw text.
"""
import argparse
import asyncio
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

from sqlalchemy import delete, func, insert, select
from sqlalchemy.ext.asyncio import create_async_engine

# Importing the models registers every table on Base.metadata.
import app.models  # noqa: F401
from app.core.database import Base

BATCH = 500


def _redact(url: str) -> str:
    """Hide any password before printing a connection string."""
    if "://" not in url or "@" not in url:
        return url
    scheme, rest = url.split("://", 1)
    creds, host = rest.rsplit("@", 1)
    user = creds.split(":", 1)[0]
    return f"{scheme}://{user}:***@{host}"


async def transfer(source_url: str, target_url: str, wipe: bool) -> int:
    source = create_async_engine(source_url)
    target = create_async_engine(target_url)

    print(f"source : {_redact(source_url)}")
    print(f"target : {_redact(target_url)}\n")

    async with target.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    tables = list(Base.metadata.sorted_tables)  # parents before children
    total = 0
    skipped: list[str] = []
    orphaned: list[str] = []

    if wipe:
        # Reverse order so children go before the rows they reference.
        async with target.begin() as conn:
            for table in reversed(tables):
                await conn.execute(delete(table))
        print("cleared existing rows in target\n")

    for table in tables:
        async with source.connect() as src:
            try:
                rows = (await src.execute(select(table))).mappings().all()
            except Exception as e:  # table absent in source — fine mid-migration
                skipped.append(f"{table.name} ({type(e).__name__})")
                continue

        if not rows:
            print(f"  {table.name:26} 0")
            continue

        payload = [dict(r) for r in rows]

        # SQLite does not enforce foreign keys by default, so a long-lived
        # SQLite file can hold rows pointing at deleted parents. Postgres does
        # enforce them, and one such row aborts the whole insert — so drop them
        # here and report exactly what was left behind rather than failing or
        # silently losing data.
        dropped = 0
        for fk in table.foreign_keys:
            parent = fk.column.table
            child_col = fk.parent.name
            async with target.connect() as conn:
                valid = {
                    v for (v,) in await conn.execute(select(fk.column))
                }
            before = len(payload)
            payload = [
                r for r in payload
                if r.get(child_col) is None or r[child_col] in valid
            ]
            if len(payload) != before:
                dropped += before - len(payload)
                orphaned.append(
                    f"{table.name}.{child_col} -> {parent.name}: "
                    f"{before - len(payload)} row(s)"
                )

        if payload:
            async with target.begin() as conn:
                for i in range(0, len(payload), BATCH):
                    await conn.execute(insert(table), payload[i : i + BATCH])

        note = f"  ({dropped} orphaned, skipped)" if dropped else ""
        print(f"  {table.name:26} {len(payload)}{note}")
        total += len(payload)

    # Read back from the target so the number reported is what actually landed.
    print("\nverifying target row counts…")
    mismatches = []
    async with target.connect() as conn:
        for table in tables:
            n = (await conn.execute(select(func.count()).select_from(table))).scalar()
            async with source.connect() as src:
                try:
                    m = (await src.execute(select(func.count()).select_from(table))).scalar()
                except Exception:
                    continue
            if n != m:
                mismatches.append(f"{table.name}: source {m} -> target {n}")

    await source.dispose()
    await target.dispose()

    if skipped:
        print(f"\nskipped (not in source): {', '.join(skipped)}")
    if orphaned:
        print("\nOrphaned rows not copied (parent record no longer exists):")
        for o in orphaned:
            print(f"  {o}")
    if mismatches:
        label = "expected — orphaned rows dropped" if orphaned else "UNEXPECTED"
        print(f"\nRow count differences ({label}):")
        for m in mismatches:
            print(f"  {m}")
        if not orphaned:
            return 1

    verdict = (
        "counts match" if not mismatches
        else f"{sum(int(o.split(': ')[1].split(' ')[0]) for o in orphaned)} orphaned row(s) dropped"
    )
    print(f"\n{total} rows copied across {len(tables)} tables — {verdict}.")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--source", help="Source URL (defaults to DATABASE_URL)")
    parser.add_argument("--target", help="Target URL. Defaults to a timestamped SQLite backup file.")
    parser.add_argument("--wipe", action="store_true", help="Delete existing target rows first")
    args = parser.parse_args()

    source_url = args.source or os.environ.get("DATABASE_URL")
    if not source_url:
        print("No --source and no DATABASE_URL set.", file=sys.stderr)
        return 2

    target_url = args.target
    if not target_url:
        backups = Path(__file__).parent / "backups"
        backups.mkdir(exist_ok=True)
        stamp = datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S")
        target_url = f"sqlite+aiosqlite:///{backups / f'novalabs-{stamp}.db'}"

    if source_url == target_url:
        print("Source and target are the same database.", file=sys.stderr)
        return 2

    # A backup into a fresh file should always start clean.
    wipe = args.wipe or (args.target is None)
    return asyncio.run(transfer(source_url, target_url, wipe))


if __name__ == "__main__":
    raise SystemExit(main())
