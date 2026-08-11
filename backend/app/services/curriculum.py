"""Curriculum structure helpers — the single chokepoint for changing day numbers.

Learner data does not reference `days.id`. `LearnerDayProgress`, `QuizAttempt`,
`Submission` and `LearnerNote` each store a bare `day_number` integer with no
foreign key, so renumbering a day silently re-points a learner's progress at a
different topic unless those tables move with it. Everything that touches
`day_number` goes through `renumber_days` so that cascade can't be forgotten.
"""
from sqlalchemy import case, func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.content import Day
from app.models.progress import LearnerDayProgress, LearnerNote, QuizAttempt, Submission

# Every table keyed by day_number. Order is irrelevant — all of it moves together
# inside the caller's transaction.
_DAY_NUMBER_TABLES = (
    ("days", Day),
    ("learner_day_progress", LearnerDayProgress),
    ("quiz_attempts", QuizAttempt),
    ("submissions", Submission),
    ("learner_notes", LearnerNote),
)


async def next_day_number(db: AsyncSession) -> int:
    """The number a newly appended day should take."""
    highest = (await db.execute(select(func.max(Day.day_number)))).scalar()
    return (highest or 0) + 1


async def learner_data_counts(db: AsyncSession, day_number: int) -> dict[str, int]:
    """How many learner-owned rows point at this day.

    Drives the delete guard and the reorder confirmation, so an admin is told
    what they're about to move or destroy rather than finding out afterwards.
    """
    counts: dict[str, int] = {}
    for name, model in _DAY_NUMBER_TABLES:
        if model is Day:
            continue
        counts[name] = (
            await db.execute(
                select(func.count()).select_from(model).where(model.day_number == day_number)
            )
        ).scalar() or 0
    return counts


async def renumber_days(db: AsyncSession, mapping: dict[int, int]) -> dict[str, int]:
    """Apply {old_day_number: new_day_number} across every day-numbered table.

    Done in two passes. `days.day_number` is unique, and both
    `learner_day_progress` and `learner_notes` carry a
    UniqueConstraint(learner_id, day_number) — so a direct update collides
    mid-flight whenever the mapping contains a cycle (swapping 5 and 6 is the
    common case). Parking the affected rows in the negative range first means
    no intermediate state can collide with a final value.

    Returns rows touched per table. Caller owns the transaction.
    """
    mapping = {old: new for old, new in mapping.items() if old != new}
    if not mapping:
        return {name: 0 for name, _ in _DAY_NUMBER_TABLES}

    targets = list(mapping.values())
    if len(set(targets)) != len(targets):
        raise ValueError("renumber mapping assigns two days the same number")
    if any(n < 1 for n in targets):
        raise ValueError("day numbers must be positive")

    # A day may only move onto a number that is either free or vacated by this
    # same mapping; anything else would silently overwrite an existing day.
    landing_on_others = set(targets) - set(mapping)
    if landing_on_others:
        occupied = set(
            (
                await db.execute(
                    select(Day.day_number).where(Day.day_number.in_(landing_on_others))
                )
            ).scalars()
        )
        if occupied:
            raise ValueError(f"renumber would overwrite day(s) {sorted(occupied)}")

    counts: dict[str, int] = {}
    for name, model in _DAY_NUMBER_TABLES:
        # Pass 1: park in the negative range, which no real row occupies.
        await db.execute(
            update(model)
            .where(model.day_number.in_(mapping))
            .values(day_number=-model.day_number)
        )
        # Pass 2: negative placeholder -> final number, one CASE per table.
        result = await db.execute(
            update(model)
            .where(model.day_number.in_([-old for old in mapping]))
            .values(
                day_number=case(
                    {-old: new for old, new in mapping.items()},
                    value=model.day_number,
                )
            )
        )
        counts[name] = result.rowcount or 0

    return counts
