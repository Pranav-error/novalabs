import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import select, delete, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models.content import Day
from app.models.social import FeedPost, FeedReply, FeedLike, FeedReport
from app.models.user import User
from app.services.gamification import award_xp, grant_badge, record_activity
from app.core.ratelimit import enforce_rate_limit
from app.services.notifications import notify

EDIT_WINDOW_MINUTES = 30

router = APIRouter()


# --------------- Pydantic schemas ---------------

class CreatePostRequest(BaseModel):
    content: str = Field(..., min_length=1, max_length=2000)
    category: str = Field(default="general")
    # No upper bound here — the curriculum can grow past 30 days, so the day is
    # checked against the days table in the handler instead of a fixed literal.
    day_number: int | None = Field(None, ge=1)


class CreateReplyRequest(BaseModel):
    content: str = Field(..., min_length=1, max_length=2000)


class EditPostRequest(BaseModel):
    content: str = Field(..., min_length=1, max_length=2000)


class ReportRequest(BaseModel):
    target_id: str
    target_type: str = Field(default="post", pattern="^(post|reply)$")
    reason: str = Field(..., pattern="^(spam|harassment|off_topic|inappropriate)$")


class PostOut(BaseModel):
    id: str
    author_id: str
    author_name: str
    author_initials: str
    content: str
    category: str
    day_number: int | None = None
    likes_count: int
    replies_count: int
    is_liked: bool
    created_at: datetime
    updated_at: datetime


class ReplyOut(BaseModel):
    id: str
    post_id: str
    author_id: str
    author_name: str
    author_initials: str
    content: str
    created_at: datetime


class PostDetailOut(PostOut):
    replies: list[ReplyOut] = []


# --------------- Helpers ---------------

def _initials(first: str, last: str) -> str:
    return (first[:1] + last[:1]).upper()


VALID_CATEGORIES = {"progress", "project", "doubt", "general"}


# --------------- Endpoints ---------------

@router.get("")
async def list_posts(
    category: str | None = None,
    day: int | None = Query(None, ge=1),
    offset: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List feed posts with offset pagination, optional category filter."""
    base_where = [FeedPost.is_deleted == False]  # noqa: E712
    if category and category in VALID_CATEGORIES:
        base_where.append(FeedPost.category == category)
    if day is not None:
        base_where.append(FeedPost.day_number == day)

    total = await db.scalar(
        select(func.count()).select_from(FeedPost).where(*base_where)
    )

    stmt = (
        select(
            FeedPost,
            User.first_name,
            User.last_name,
            FeedLike.id.label("like_id"),
        )
        .join(User, FeedPost.author_id == User.id)
        .outerjoin(
            FeedLike,
            (FeedLike.post_id == FeedPost.id) & (FeedLike.user_id == user.id),
        )
        .where(*base_where)
        .order_by(FeedPost.created_at.desc())
        .offset(offset)
        .limit(limit)
    )

    result = await db.execute(stmt)
    rows = result.all()

    posts = []
    for post, first_name, last_name, like_id in rows:
        posts.append(
            PostOut(
                id=post.id,
                author_id=post.author_id,
                author_name=f"{first_name} {last_name}",
                author_initials=_initials(first_name, last_name),
                content=post.content,
                category=post.category,
                day_number=post.day_number,
                likes_count=post.likes_count,
                replies_count=post.replies_count,
                is_liked=like_id is not None,
                created_at=post.created_at,
                updated_at=post.updated_at,
            )
        )

    return {
        "posts": posts,
        "offset": offset,
        "limit": limit,
        "total": total,
        "has_more": offset + len(posts) < total,
    }


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_post(
    body: CreatePostRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a new feed post."""
    # Per-account, not per-IP: the spam that matters here comes from a logged-in
    # user, and one IP can legitimately host a whole cohort.
    enforce_rate_limit("feed_post", user.id, 20, 3600)

    if body.category not in VALID_CATEGORIES:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Invalid category. Must be one of: {', '.join(VALID_CATEGORIES)}",
        )

    if body.day_number is not None:
        exists = (
            await db.execute(select(Day.id).where(Day.day_number == body.day_number))
        ).scalar_one_or_none()
        if not exists:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Day {body.day_number} does not exist",
            )

    now = datetime.now(timezone.utc)
    post = FeedPost(
        id=str(uuid.uuid4()),
        author_id=user.id,
        content=body.content,
        category=body.category,
        day_number=body.day_number,
        created_at=now,
        updated_at=now,
    )
    db.add(post)
    await db.flush()

    await award_xp(
        db, user.id, "community_post",
        reference_id=post.id, reference_type="feed_post", once_per_day=True,
    )
    await grant_badge(db, user.id, "first_post")
    await record_activity(db, user.id)

    return {
        "message": "Post created",
        "post": PostOut(
            id=post.id,
            author_id=post.author_id,
            author_name=f"{user.first_name} {user.last_name}",
            author_initials=_initials(user.first_name, user.last_name),
            content=post.content,
            category=post.category,
            day_number=post.day_number,
            likes_count=0,
            replies_count=0,
            is_liked=False,
            created_at=post.created_at,
            updated_at=post.updated_at,
        ),
    }


@router.get("/{post_id}")
async def get_post(
    post_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get a single post with its replies."""
    # Fetch post with author info and like status
    stmt = (
        select(
            FeedPost,
            User.first_name,
            User.last_name,
            FeedLike.id.label("like_id"),
        )
        .join(User, FeedPost.author_id == User.id)
        .outerjoin(
            FeedLike,
            (FeedLike.post_id == FeedPost.id) & (FeedLike.user_id == user.id),
        )
        .where(FeedPost.id == post_id, FeedPost.is_deleted == False)  # noqa: E712
    )
    result = await db.execute(stmt)
    row = result.first()

    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Post not found")

    post, first_name, last_name, like_id = row

    # Fetch replies with author info
    replies_stmt = (
        select(FeedReply, User.first_name, User.last_name)
        .join(User, FeedReply.author_id == User.id)
        .where(FeedReply.post_id == post_id, FeedReply.is_deleted == False)  # noqa: E712
        .order_by(FeedReply.created_at.asc())
    )
    replies_result = await db.execute(replies_stmt)
    reply_rows = replies_result.all()

    replies = [
        ReplyOut(
            id=r.id,
            post_id=r.post_id,
            author_id=r.author_id,
            author_name=f"{fn} {ln}",
            author_initials=_initials(fn, ln),
            content=r.content,
            created_at=r.created_at,
        )
        for r, fn, ln in reply_rows
    ]

    return {
        "post": PostDetailOut(
            id=post.id,
            author_id=post.author_id,
            author_name=f"{first_name} {last_name}",
            author_initials=_initials(first_name, last_name),
            content=post.content,
            category=post.category,
            day_number=post.day_number,
            likes_count=post.likes_count,
            replies_count=post.replies_count,
            is_liked=like_id is not None,
            created_at=post.created_at,
            updated_at=post.updated_at,
            replies=replies,
        )
    }


@router.delete("/{post_id}")
async def delete_post(
    post_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Soft delete own post only."""
    result = await db.execute(
        select(FeedPost).where(FeedPost.id == post_id, FeedPost.is_deleted == False)  # noqa: E712
    )
    post = result.scalar_one_or_none()

    if post is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Post not found")
    if post.author_id != user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Cannot delete another user's post")

    post.is_deleted = True
    post.updated_at = datetime.now(timezone.utc)
    await db.flush()

    return {"message": "Post deleted"}


@router.post("/{post_id}/like")
async def toggle_like(
    post_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Toggle like on a post (insert or remove)."""
    # Verify post exists
    result = await db.execute(
        select(FeedPost).where(FeedPost.id == post_id, FeedPost.is_deleted == False)  # noqa: E712
    )
    post = result.scalar_one_or_none()
    if post is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Post not found")

    # Check existing like
    like_result = await db.execute(
        select(FeedLike).where(FeedLike.post_id == post_id, FeedLike.user_id == user.id)
    )
    existing_like = like_result.scalar_one_or_none()

    if existing_like:
        await db.delete(existing_like)
        post.likes_count = max(0, post.likes_count - 1)
        liked = False
    else:
        new_like = FeedLike(
            id=str(uuid.uuid4()),
            post_id=post_id,
            user_id=user.id,
            created_at=datetime.now(timezone.utc),
        )
        db.add(new_like)
        post.likes_count = post.likes_count + 1
        liked = True

    post.updated_at = datetime.now(timezone.utc)
    await db.flush()

    return {"liked": liked, "likes_count": post.likes_count}


@router.post("/{post_id}/replies", status_code=status.HTTP_201_CREATED)
async def create_reply(
    post_id: str,
    body: CreateReplyRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a reply on a post."""
    enforce_rate_limit("feed_reply", user.id, 60, 3600)

    result = await db.execute(
        select(FeedPost).where(FeedPost.id == post_id, FeedPost.is_deleted == False)  # noqa: E712
    )
    post = result.scalar_one_or_none()
    if post is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Post not found")

    reply = FeedReply(
        id=str(uuid.uuid4()),
        post_id=post_id,
        author_id=user.id,
        content=body.content,
        created_at=datetime.now(timezone.utc),
    )
    db.add(reply)
    post.replies_count = post.replies_count + 1
    post.updated_at = datetime.now(timezone.utc)
    await db.flush()

    await award_xp(
        db, user.id, "doubt_reply",
        reference_id=reply.id, reference_type="feed_reply", once_per_day=True,
    )
    if post.author_id != user.id:
        await notify(
            db, post.author_id, "reply_to_post",
            title=f"{user.first_name} replied to your post",
            body=body.content[:200],
            reference_id=post.id, reference_type="feed_post",
        )
    my_replies = (
        await db.execute(
            select(func.count()).select_from(FeedReply).where(
                FeedReply.author_id == user.id, FeedReply.is_deleted == False  # noqa: E712
            )
        )
    ).scalar_one()
    if my_replies >= 10:
        await grant_badge(db, user.id, "community_builder")
    await record_activity(db, user.id)

    return {
        "message": "Reply posted",
        "reply": ReplyOut(
            id=reply.id,
            post_id=reply.post_id,
            author_id=reply.author_id,
            author_name=f"{user.first_name} {user.last_name}",
            author_initials=_initials(user.first_name, user.last_name),
            content=reply.content,
            created_at=reply.created_at,
        ),
    }


@router.delete("/{post_id}/replies/{reply_id}")
async def delete_reply(
    post_id: str,
    reply_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Soft delete own reply and decrement replies_count."""
    result = await db.execute(
        select(FeedReply).where(
            FeedReply.id == reply_id,
            FeedReply.post_id == post_id,
            FeedReply.is_deleted == False,  # noqa: E712
        )
    )
    reply = result.scalar_one_or_none()

    if reply is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Reply not found")
    if reply.author_id != user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Cannot delete another user's reply")

    reply.is_deleted = True

    # Decrement replies_count on the parent post
    post_result = await db.execute(
        select(FeedPost).where(FeedPost.id == post_id)
    )
    post = post_result.scalar_one_or_none()
    if post:
        post.replies_count = max(0, post.replies_count - 1)
        post.updated_at = datetime.now(timezone.utc)

    await db.flush()

    return {"message": "Reply deleted"}


@router.patch("/{post_id}")
async def edit_post(
    post_id: str,
    body: EditPostRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Edit own post within 30 minutes of posting."""
    result = await db.execute(
        select(FeedPost).where(FeedPost.id == post_id, FeedPost.is_deleted == False)  # noqa: E712
    )
    post = result.scalar_one_or_none()
    if post is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Post not found")
    if post.author_id != user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Cannot edit another user's post")

    created = post.created_at
    if created.tzinfo is None:
        created = created.replace(tzinfo=timezone.utc)
    if datetime.now(timezone.utc) - created > timedelta(minutes=EDIT_WINDOW_MINUTES):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Posts can only be edited within {EDIT_WINDOW_MINUTES} minutes of posting",
        )

    post.content = body.content
    post.updated_at = datetime.now(timezone.utc)
    await db.flush()
    return {"message": "Post updated", "content": post.content, "updated_at": post.updated_at}


@router.post("/report", status_code=status.HTTP_201_CREATED)
async def report_content(
    body: ReportRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Report a post or reply to the admin moderation queue."""
    # Report-bombing is a moderation-queue DoS as much as a harassment vector.
    enforce_rate_limit("feed_report", user.id, 20, 3600)

    if body.target_type == "post":
        exists = await db.execute(select(FeedPost.id).where(FeedPost.id == body.target_id))
    else:
        exists = await db.execute(select(FeedReply.id).where(FeedReply.id == body.target_id))
    if not exists.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Reported content not found")

    duplicate = await db.execute(
        select(FeedReport.id).where(
            FeedReport.reporter_id == user.id,
            FeedReport.target_id == body.target_id,
            FeedReport.status == "pending",
        ).limit(1)
    )
    if duplicate.scalar_one_or_none():
        return {"message": "Already reported"}

    db.add(FeedReport(
        reporter_id=user.id,
        target_id=body.target_id,
        target_type=body.target_type,
        reason=body.reason,
    ))
    return {"message": "Report submitted"}
