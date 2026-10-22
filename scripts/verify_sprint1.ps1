# Reproduce component evidence; this does not certify working-product acceptance.
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
Push-Location -LiteralPath $projectRoot
$evidence = [ordered]@{ startedAt = [DateTime]::UtcNow.ToString('o'); status = 'RUNNING'; workingProductVerified = $false }
try {
    New-Item -ItemType Directory -Path 'reports/sprint1' -Force | Out-Null
    $evidence.checkoutCommit = (git rev-parse HEAD)
    if ($LASTEXITCODE -ne 0) { throw 'Cannot identify checkout commit' }
    $evidence.dirtyCheckout = [bool](git status --porcelain)
    if ($LASTEXITCODE -ne 0) { throw 'Cannot inspect checkout state' }
    npm run build
    if ($LASTEXITCODE -ne 0) { throw 'Node build failed' }
    & .\.venv\Scripts\python.exe -m compileall -q python_backend/chat_backend scripts/smoke_startup.py
    if ($LASTEXITCODE -ne 0) { throw 'Python build check failed' }
    npm test -- --json --outputFile=reports/sprint1/node.json
    if ($LASTEXITCODE -ne 0) { throw 'Node tests failed' }
    & .\.venv\Scripts\python.exe -m pytest --junitxml=reports/sprint1/python.xml -p no:cacheprovider
    if ($LASTEXITCODE -ne 0) { throw 'Python tests failed' }
    & .\.venv\Scripts\python.exe scripts/smoke_startup.py --report reports/sprint1/launchers.json
    if ($LASTEXITCODE -ne 0) { throw 'Real launcher smoke checks failed' }
    git diff --check
    if ($LASTEXITCODE -ne 0) { throw 'Whitespace check failed' }
    $nodeResult = Get-Content -LiteralPath 'reports/sprint1/node.json' -Raw | ConvertFrom-Json
    $evidence.nodePassed = $nodeResult.numPassedTests
    [xml]$pythonResult = Get-Content -LiteralPath 'reports/sprint1/python.xml' -Raw
    $evidence.pythonPassed = ($pythonResult.SelectNodes('//testsuite') | ForEach-Object { [int]$_.tests - [int]$_.failures - [int]$_.errors - [int]$_.skipped } | Measure-Object -Sum).Sum
    $evidence.status = 'PASS'
} catch {
    $evidence.status = 'FAIL'
    throw
} finally {
    $evidence.finishedAt = [DateTime]::UtcNow.ToString('o')
    if (Test-Path -LiteralPath 'reports/sprint1') {
        $evidence | ConvertTo-Json | Set-Content -LiteralPath 'reports/sprint1/run.json' -Encoding utf8
    }
    Pop-Location
}
