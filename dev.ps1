# Starts the backend (FastAPI/uvicorn, port 8570) and frontend (Next.js, port 8569)
# dev servers, each in its own window.
#
# Usage: .\dev.ps1

$ErrorActionPreference = "Stop"

$root = $PSScriptRoot
$backend = Join-Path $root "backend"
$frontend = Join-Path $root "frontend"
$backendPort = 8570
$frontendPort = 8569

$venvPython = Join-Path $backend ".venv\Scripts\python.exe"
if (-not (Test-Path $venvPython)) {
    Write-Host "No backend/.venv found - creating one and installing requirements..." -ForegroundColor Yellow
    python -m venv $venvPython.Replace("\Scripts\python.exe", "")
    & $venvPython -m pip install --quiet --upgrade pip
    & $venvPython -m pip install --quiet -r (Join-Path $backend "requirements.txt")
}

Write-Host "Starting backend  -> http://localhost:$backendPort" -ForegroundColor Cyan
Start-Process powershell -ArgumentList @(
    "-NoExit", "-Command",
    "Set-Location `"$backend`"; .\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --port $backendPort"
)

Write-Host "Starting frontend -> http://localhost:$frontendPort" -ForegroundColor Cyan
Start-Process powershell -ArgumentList @(
    "-NoExit", "-Command",
    "Set-Location `"$frontend`"; npm run dev -- -p $frontendPort"
)

Write-Host "Both dev servers are launching in separate windows. Close those windows (or Ctrl+C in each) to stop them." -ForegroundColor Green
