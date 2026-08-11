# NOVA LABS — 30-Day Full-Stack Challenge

A complete LMS platform for a 30-day full-stack developer challenge, with a
Next.js web app, a FastAPI backend, and a Flutter mobile app.

## Tech Stack

- **Frontend**: Next.js 14 (App Router) + TailwindCSS + React Query
- **Backend**: FastAPI (Python) + SQLAlchemy + SQLite (dev) / PostgreSQL (prod)
- **Mobile**: Flutter + Riverpod + go_router + Dio
- **Auth**: JWT + httpOnly refresh cookies (mobile gets the refresh token in the body)
- **Payments**: Razorpay
- **File Storage**: Cloudinary (local-disk fallback in dev)
- **Email**: Resend (console fallback in dev)
- **Code Execution**: Wandbox public API

## Getting Started

### Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --reload
```

Bind to `--host 0.0.0.0` if a phone on your LAN needs to reach it.

**Rate limiting depends on how you launch uvicorn.** Its `ProxyHeadersMiddleware`
is on by default and rewrites the client IP from the *left-most*
`X-Forwarded-For` entry whenever the peer is in `--forwarded-allow-ips`
(default `127.0.0.1`). Behind a same-host reverse proxy, that lets a client
forge its own IP and get a fresh rate-limit bucket per request.

```bash
# Directly exposed (no proxy) — required, or every rate limit can be bypassed
uvicorn app.main:app --no-proxy-headers

# Behind nginx/Cloudflare: trust only the proxy, and set TRUST_PROXY_HEADERS=True
uvicorn app.main:app --forwarded-allow-ips="10.0.0.5"
```

### Frontend

```bash
cd frontend
npm install
cp .env.local.example .env.local
npm run dev
```

API docs at http://localhost:8000/docs · Frontend at http://localhost:3000

### Mobile

```bash
cd mobile
flutter pub get
flutter run
```

The API base URL defaults per platform — `10.0.2.2` on the Android emulator,
`localhost` on the iOS simulator and web. A **physical device** can reach
neither, so pass your machine's LAN IP:

```bash
flutter run --dart-define=API_BASE_URL=http://192.168.1.42:8000
```

iOS allows plaintext HTTP only to local addresses (see the
`NSAppTransportSecurity` block in `ios/Runner/Info.plist`); a non-local API
must be HTTPS.

## Content model

```
Phase  (called "Module" in the admin UI)
 └─ Day  (called "Topic")        — day_number is globally unique, 1..N
     ├─ DayVideo                 — YouTube/Vimeo link or an upload
     ├─ DayMaterial              — notes, PPT, PDF, ZIP
     ├─ MCQQuestion              — quiz
     └─ DayRubricItem            — grading criteria for the assignment
```

Admins build all of this from **Admin → Modules / Topics**: create modules and
topics, attach content, define rubrics, drag to reorder, bulk-import MCQs, and
preview a topic as a learner before publishing.

### ⚠️ Renumbering days

`LearnerDayProgress`, `QuizAttempt`, `Submission` and `LearnerNote` all key off
a bare `day_number` **with no foreign key**, and two of them carry
`UniqueConstraint(learner_id, day_number)`. Changing a day number therefore has
to move learner rows with it, and a direct `UPDATE` collides mid-flight whenever
the mapping contains a cycle (swapping two days is the common case).

**Always go through `app/services/curriculum.py::renumber_days`**, which parks
rows in the negative range first and then writes final values. Do not write
`day_number` directly.

## Third-party setup

### Email (Resend) — required before launch

A new Resend account can **only send to the account owner's address**. Password
resets and signup verification codes will silently fail for everyone else — the
API still returns success so the endpoint can't be used to probe which emails
exist. Verify a domain at [resend.com/domains](https://resend.com/domains) and
set `from` to that domain.

### Google Sign-In

All three OAuth clients must live in the **same** Google Cloud project.

1. **Web client** — add `http://localhost:3000` (and your production domain) to
   *Authorized JavaScript origins*. Set `NEXT_PUBLIC_GOOGLE_CLIENT_ID` in
   `frontend/.env.local` and `GOOGLE_CLIENT_ID` in `backend/.env` to this client.
2. **iOS client** — created against the bundle ID in `project.pbxproj`. Put
   `GoogleService-Info.plist` in `mobile/ios/Runner/` and add its
   `REVERSED_CLIENT_ID` as a `CFBundleURLSchemes` entry in `Info.plist`.
3. **Android client** — package name + keystore SHA-1
   (`keytool -list -v -keystore ~/.android/debug.keystore -alias androiddebugkey -storepass android`).
   Put `google-services.json` in `mobile/android/app/`. Add the **release**
   keystore SHA-1 too, or sign-in works in debug and fails in production.
4. Run the app with the **web** client ID as the server client ID — that's what
   makes the ID token's audience match what `/auth/google` verifies:

```bash
flutter run --dart-define=GOOGLE_SERVER_CLIENT_ID=<web-client-id>.apps.googleusercontent.com
```

## Notifications

In-app only. `notify()` writes a `Notification` row; the web bell polls
`GET /me/notifications` every 60s. Admins can send one from
**Admin → Notifications** (audience: everyone / paid / unpaid / a single user).

There is **no push infrastructure** — no FCM, no APNs. Nothing reaches a phone
as a banner, and the mobile app does not read notifications at all. Announcements
are separate: they render on the dashboard and do *not* reach the bell unless
"also post as announcement" is used from the notifications page.

## Content protection

Paid course media used to be served from an open static mount: the URL was
permanent, unauthenticated, and worked for anyone it was passed to.

**What is enforced**

- **Signed media URLs** — `/media/*` now requires an HMAC signature bound to
  the file, the learner and a 15-minute expiry. A URL copied out of the Network
  tab stops working, and only ever worked for the account it was issued to.
  Path traversal is blocked by resolving inside the uploads directory.
- **Android** — `FLAG_SECURE` in `MainActivity.kt`. The OS refuses to
  screenshot or record the app and blanks it in the recent-apps preview. This
  cannot be disabled from inside the process.
- **Watermarking** — the learner's email is drawn over the video on web and
  mobile, so a leaked capture is attributable.

**What is not, and cannot be**

- **iOS cannot block capture.** There is no API for it. The app detects an
  active recording (`UIScreen.isCaptured`) and hides playback while it runs,
  and is told when a screenshot is taken — detection and attribution, not
  prevention.
- **The web cannot block screenshots, recording, or DevTools.** No browser API
  exists. Scripts claiming to "disable DevTools" are bypassed in seconds and
  break accessibility tools, so none are used here. `controlsList="nodownload"`
  and a suppressed context menu are deterrents, nothing more.
- Anything a browser can decrypt and play, the machine can capture. Preventing
  that needs real DRM (Widevine/FairPlay) and a licensing agreement.

The expiring signed URL is the control that actually limits redistribution;
the watermark is what makes a leak traceable.

## Uploading course video

Videos attach to a topic from **Admin → Topics → open a topic → Class videos**,
either as a YouTube/Vimeo link or a direct upload.

- Limits are configurable: `MAX_VIDEO_UPLOAD_MB` (default 2048) and
  `MAX_MATERIAL_UPLOAD_MB` (default 50).
- An over-limit upload is refused from `Content-Length` before the body is
  read, so a large file fails immediately instead of after a full transfer.
- **Check your storage provider's own per-file cap.** Cloudinary's free tier
  caps video well below these defaults, and that limit wins regardless of what
  is configured here. A rejected upload now returns a 502 naming the failure
  rather than an opaque 500.
- Reverse proxies impose their own body limits — nginx defaults to 1 MB, so
  `client_max_body_size` must be raised to match.

A topic can be moved between modules from its editor; this only regroups it,
leaving the day number and all learner progress untouched.

## Production checklist

- [ ] `DEBUG=False` in `backend/.env`
- [ ] uvicorn launched with `--no-proxy-headers`, or `TRUST_PROXY_HEADERS=True` **and** `--forwarded-allow-ips` set to your proxy — otherwise rate limits are bypassable
- [ ] Fresh `SECRET_KEY` (rotating it invalidates all sessions and reset links)
- [ ] `DATABASE_URL` pointed at PostgreSQL, not SQLite
- [ ] `RAZORPAY_WEBHOOK_SECRET` set — payment webhooks fail signature checks while empty
- [ ] Resend domain verified and `from` updated
- [ ] Google OAuth origins include the production domain
- [ ] `FRONTEND_URL` set — password-reset links are built from it
- [ ] Cloudinary configured, or uploads fall back to local disk and vanish on redeploy

## Database

SQLite for local dev, PostgreSQL in production — set `DATABASE_URL` accordingly:

```
postgresql+asyncpg://user:password@host:5432/novalabs
```

`db_transfer.py` copies every table between any two databases, and covers both
the one-time migration and routine backups:

```bash
# move local SQLite data onto Postgres
python db_transfer.py \
  --source "sqlite+aiosqlite:///./novalabs.db" \
  --target "postgresql+asyncpg://user@host:5432/novalabs" --wipe

# back production up into a timestamped SQLite file under backups/
DATABASE_URL="postgresql+asyncpg://..." python db_transfer.py
```

Rows go through the SQLAlchemy models, so JSON columns, enums and
timezone-aware datetimes are translated between dialects rather than copied as
raw text. Row counts are read back from the target and compared.

**On orphaned rows:** SQLite does not enforce foreign keys by default, so an
old SQLite file can contain rows pointing at deleted parents. Postgres rejects
them. The tool skips such rows and lists exactly what it dropped rather than
failing the whole migration or losing them silently.

## Useful scripts

```bash
python seed_content.py              # seed the 6 phases / 30 days (SQLite only)
python backfill_referral_codes.py   # give every existing user a referral code (idempotent)
python db_transfer.py --help        # migrate or back up
```
