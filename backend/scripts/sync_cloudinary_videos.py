"""
Run this anytime after manually uploading video files into the Cloudinary
folders novalabs/day-1 .. novalabs/day-30 (via the Cloudinary Media Library
web UI). It lists whatever is actually in each folder, skips anything
already recorded (matched by storage_public_id), and inserts day_videos
rows for the rest -- ordered by the leading number in the original
filename (e.g. "3_final.mp4" sorts before "10_final.mp4"), falling back to
upload time for files with no recognizable numeric prefix.

Any resource still on Cloudinary's public `upload` delivery type is moved to
the `authenticated` type first (with CDN invalidation) -- there is then no
permanent public URL for it at all, only ones the backend signs per request
and that expire after a few hours (see app/core/media_signing.py).

Usage (from the backend/ directory):
  python scripts/sync_cloudinary_videos.py            # sync all 30 days
  python scripts/sync_cloudinary_videos.py 5          # just day 5
  python scripts/sync_cloudinary_videos.py 5 12       # days 5 through 12
"""
import os
import re
import sqlite3
import sys
import uuid
from datetime import datetime, timezone

import cloudinary
import cloudinary.api
import cloudinary.uploader
from dotenv import load_dotenv

BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DB_PATH = os.path.join(BACKEND_DIR, "novalabs.db")

load_dotenv(os.path.join(BACKEND_DIR, ".env"))
cloudinary.config(
    cloud_name=os.getenv("CLOUDINARY_CLOUD_NAME"),
    api_key=os.getenv("CLOUDINARY_API_KEY"),
    api_secret=os.getenv("CLOUDINARY_API_SECRET"),
)

LEADING_NUM = re.compile(r"^(\d+(?:\.\d+)?)")


def sort_key(resource):
    name = resource.get("display_name") or resource["public_id"].rsplit("/", 1)[-1]
    m = LEADING_NUM.match(name.strip())
    if m:
        return (0, float(m.group(1)))
    return (1, resource.get("created_at", ""))


def list_folder(folder_path):
    resources = []
    cursor = None
    while True:
        kwargs = {"max_results": 500}
        if cursor:
            kwargs["next_cursor"] = cursor
        resp = cloudinary.api.resources_by_asset_folder(folder_path, **kwargs)
        resources.extend(resp.get("resources", []))
        cursor = resp.get("next_cursor")
        if not cursor:
            break
    return resources


def log(msg):
    print(f"[{datetime.now().strftime('%H:%M:%S')}] {msg}", flush=True)


def main():
    start_day = int(sys.argv[1]) if len(sys.argv) > 1 else 1
    end_day = int(sys.argv[2]) if len(sys.argv) > 2 else (start_day if len(sys.argv) > 1 else 30)

    con = sqlite3.connect(DB_PATH)
    cur = con.cursor()
    cur.execute("SELECT day_number, id FROM days ORDER BY day_number")
    day_id_by_number = {num: did for num, did in cur.fetchall()}

    total_inserted = 0

    for day_num in range(start_day, end_day + 1):
        day_id = day_id_by_number.get(day_num)
        if not day_id:
            continue

        folder = f"novalabs/day-{day_num}"
        try:
            resources = list_folder(folder)
        except Exception as e:
            log(f"Day {day_num}: could not list {folder}: {e}")
            continue

        if not resources:
            continue

        resources.sort(key=sort_key)

        cur.execute("SELECT storage_public_id FROM day_videos WHERE day_id = ?", (day_id,))
        already = {row[0] for row in cur.fetchall()}

        cur.execute("SELECT COUNT(*) FROM day_videos WHERE day_id = ?", (day_id,))
        next_order = cur.fetchone()[0]

        new_count = 0
        for res in resources:
            if res["public_id"] in already:
                continue
            name = res.get("display_name") or res["public_id"].rsplit("/", 1)[-1]

            # Still sitting on the public delivery type? Move it to Cloudinary's
            # `authenticated` type so no permanent public URL exists for it —
            # only the short-lived signed URLs the backend generates per request.
            public_id = res["public_id"]
            if res["type"] == "upload":
                try:
                    renamed = cloudinary.uploader.rename(
                        public_id, public_id,
                        resource_type="video", type="upload", to_type="authenticated",
                        invalidate=True, overwrite=True,
                    )
                    public_id = renamed["public_id"]
                    log(f"Day {day_num}: '{name}' moved to authenticated delivery")
                except Exception as e:
                    log(f"Day {day_num}: could not convert '{name}' to authenticated ({e}) — leaving it public")

            video_id = str(uuid.uuid4())
            now = datetime.now(timezone.utc).isoformat()
            cur.execute(
                """
                INSERT INTO day_videos
                    (id, day_id, title, video_type, video_url, storage_public_id,
                     duration_minutes, description, display_order, created_at)
                VALUES (?, ?, ?, 'upload', ?, ?, NULL, NULL, ?, ?)
                """,
                (
                    video_id,
                    day_id,
                    f"Part {next_order + 1}",
                    res["secure_url"],
                    public_id,
                    next_order,
                    now,
                ),
            )
            next_order += 1
            new_count += 1
            total_inserted += 1
            log(f"Day {day_num}: added '{name}' as Part {next_order}")

        if new_count == 0:
            log(f"Day {day_num}: {len(resources)} file(s) in Cloudinary, all already synced")

    con.commit()
    log(f"DONE. {total_inserted} new video(s) synced across days {start_day}-{end_day}.")


if __name__ == "__main__":
    main()
