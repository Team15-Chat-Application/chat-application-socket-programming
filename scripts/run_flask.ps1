param([switch]$SkipEnvironmentFile)
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$pythonExecutable = Join-Path $projectRoot '.venv\Scripts\python.exe'
if (-not (Test-Path -LiteralPath $pythonExecutable)) { throw 'Create .venv and install the Python lock file first; see docs/DEVELOPMENT.md.' }
if (-not $SkipEnvironmentFile) {
    $environmentFile = Join-Path $projectRoot '.env'
    if (Test-Path -LiteralPath $environmentFile) {
        foreach ($line in Get-Content -LiteralPath $environmentFile) {
            if ($line -match '^\s*(FLASK_HOST|FLASK_PORT)\s*=\s*(.+?)\s*$') {
                [Environment]::SetEnvironmentVariable($Matches[1], $Matches[2], 'Process')
            }
        }
    }
}
$env:PYTHONPATH = Join-Path $projectRoot 'python_backend'
& $pythonExecutable -m chat_backend
if ($LASTEXITCODE -ne 0) { throw 'Flask development server exited unsuccessfully.' }
