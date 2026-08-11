"""Fetch a user's public GitHub repos, with a small in-memory TTL cache."""
import re
import time

import httpx

from app.core.config import settings

GITHUB_API = "https://api.github.com"
CACHE_TTL_SECONDS = 900  # 15 minutes
MAX_REPOS = 6

# username -> (fetched_at, repos)
_cache: dict[str, tuple[float, list[dict]]] = {}

_USERNAME_FROM_URL = re.compile(
    r"(?:github\.com/)?([A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?)/?$"
)


def extract_username(github_url: str | None) -> str | None:
    """Accepts a full profile URL ('https://github.com/octocat') or bare username."""
    if not github_url:
        return None
    match = _USERNAME_FROM_URL.search(github_url.strip().rstrip("/"))
    return match.group(1) if match else None


async def fetch_repos(username: str) -> list[dict]:
    """Top public repos by stars. Returns [] on any GitHub error (never raises)."""
    cached = _cache.get(username)
    if cached and time.monotonic() - cached[0] < CACHE_TTL_SECONDS:
        return cached[1]

    headers = {"Accept": "application/vnd.github+json"}
    if settings.GITHUB_TOKEN:
        headers["Authorization"] = f"Bearer {settings.GITHUB_TOKEN}"

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(
                f"{GITHUB_API}/users/{username}/repos",
                params={"sort": "updated", "per_page": 100, "type": "owner"},
                headers=headers,
            )
    except httpx.HTTPError:
        return cached[1] if cached else []

    if resp.status_code != 200:
        return cached[1] if cached else []

    repos = [
        {
            "name": r["name"],
            "description": r.get("description"),
            "html_url": r["html_url"],
            "stars": r.get("stargazers_count", 0),
            "language": r.get("language"),
            "updated_at": r.get("pushed_at"),
        }
        for r in resp.json()
        if not r.get("fork")
    ]
    repos.sort(key=lambda r: (r["stars"], r["updated_at"] or ""), reverse=True)
    repos = repos[:MAX_REPOS]

    _cache[username] = (time.monotonic(), repos)
    return repos
