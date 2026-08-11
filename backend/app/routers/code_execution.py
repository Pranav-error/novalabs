"""Server-side code execution via the public Wandbox API (free, no key required)."""
import httpx
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.core.config import settings
from app.core.dependencies import get_current_user
from app.core.ratelimit import rate_limit
from app.models.user import User

router = APIRouter()

WANDBOX_COMPILE_URL = f"{settings.WANDBOX_URL.rstrip('/')}/compile.json"

# Wandbox compiler identifiers (see https://wandbox.org/api/list.json)
COMPILERS = {
    "python": "cpython-3.12.7",
    "javascript": "nodejs-20.17.0",
}

MAX_CODE_LENGTH = 20_000

exec_rate_limit = rate_limit(
    "code_exec", settings.CODE_EXEC_RATE_LIMIT_PER_HOUR, 3600
)


class CodeRequest(BaseModel):
    code: str
    stdin: str = ""


async def _run_wandbox(language: str, req: CodeRequest) -> dict:
    if len(req.code) > MAX_CODE_LENGTH:
        raise HTTPException(status_code=422, detail="Code is too long (max 20,000 characters)")

    payload = {
        "compiler": COMPILERS[language],
        "code": req.code,
        "stdin": req.stdin,
    }

    try:
        async with httpx.AsyncClient(timeout=35.0) as client:
            resp = await client.post(WANDBOX_COMPILE_URL, json=payload)
    except httpx.HTTPError:
        raise HTTPException(
            status_code=503, detail="Code execution service is unreachable. Try again shortly."
        )

    if resp.status_code == 429:
        raise HTTPException(
            status_code=429, detail="Execution service is busy. Try again in a few seconds."
        )
    if resp.status_code != 200:
        raise HTTPException(status_code=502, detail="Code execution failed. Try again shortly.")

    result = resp.json()
    stderr = result.get("program_error", "") or result.get("compiler_error", "")
    if result.get("signal"):
        stderr = stderr or f"Process terminated ({result['signal']}) — did it run too long?"

    try:
        exit_code = int(result.get("status") or 0)
    except ValueError:
        exit_code = None

    return {
        "stdout": result.get("program_output", ""),
        "stderr": stderr,
        "exit_code": exit_code,
    }


@router.post("/execute/python", dependencies=[Depends(exec_rate_limit)])
async def execute_python(req: CodeRequest, user: User = Depends(get_current_user)):
    return await _run_wandbox("python", req)


@router.post("/execute/js", dependencies=[Depends(exec_rate_limit)])
async def execute_js(req: CodeRequest, user: User = Depends(get_current_user)):
    return await _run_wandbox("javascript", req)
