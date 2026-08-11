"""Video URL normalization for day lesson videos."""
import re

YOUTUBE_PATTERNS = [
    r"(?:youtube\.com/watch\?v=|youtu\.be/|youtube\.com/shorts/|youtube\.com/embed/)([A-Za-z0-9_-]{6,20})",
]
VIMEO_PATTERN = r"vimeo\.com/(?:video/)?(\d+)"


def normalize_video_url(url: str) -> tuple[str, str] | None:
    """Return (video_type, embed_url) for a YouTube/Vimeo link, or None if unrecognized."""
    url = url.strip()
    for pat in YOUTUBE_PATTERNS:
        m = re.search(pat, url)
        if m:
            return "youtube", f"https://www.youtube-nocookie.com/embed/{m.group(1)}"
    m = re.search(VIMEO_PATTERN, url)
    if m:
        return "vimeo", f"https://player.vimeo.com/video/{m.group(1)}"
    return None
