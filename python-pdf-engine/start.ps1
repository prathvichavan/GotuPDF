<#
.SYNOPSIS
    Start the GotuPDF Python PDF Engine

.DESCRIPTION
    Activates the virtual environment and starts the FastAPI server.

.EXAMPLE
    .\start.ps1
    .\start.ps1 -Dev    # Enable auto-reload
#>

param(
    [switch]$Dev
)

$ErrorActionPreference = "Stop"

# Activate virtual environment
if (Test-Path "venv\Scripts\Activate.ps1") {
    & ".\venv\Scripts\Activate.ps1"
} else {
    Write-Host "Virtual environment not found. Run setup.ps1 first." -ForegroundColor Red
    exit 1
}

# Start the server
Write-Host "Starting GotuPDF PDF Engine..." -ForegroundColor Cyan
Write-Host ""

if ($Dev) {
    Write-Host "Development mode (auto-reload enabled)" -ForegroundColor Yellow
    python -m uvicorn main:app --reload --host 0.0.0.0 --port 8000
} else {
    Write-Host "Production mode" -ForegroundColor Green
    python -m uvicorn main:app --host 0.0.0.0 --port 8000 --workers 4
}
