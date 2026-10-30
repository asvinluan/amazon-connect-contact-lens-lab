#Requires -Version 5.1
<#
.SYNOPSIS
  Offline checks for this lab. No AWS. Touches nothing outside this folder.

.EXAMPLE
  .\scripts\check-offline.ps1
#>
Set-StrictMode -Version 2
$ErrorActionPreference = 'Continue'
$global:LASTEXITCODE = 0

$repo = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$results = @()
function Add-Result([string]$name, [string]$verdict) { $script:results += [pscustomobject]@{ Name = $name; Verdict = $verdict } }

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "STOPPED: 'node' is not installed. Run:  winget install OpenJS.NodeJS.LTS   then reopen PowerShell." -ForegroundColor Red
    exit 1
}
Add-Result 'Tools: node is installed' 'PASS'

Write-Host "== Syntax"
& node --check (Join-Path $PSScriptRoot 'lens.mjs')
$a = $LASTEXITCODE
& node --check (Join-Path $PSScriptRoot 'selftest.mjs')
Add-Result 'Script syntax' $(if ($a -eq 0 -and $LASTEXITCODE -eq 0) { 'PASS' } else { 'FAILED' })

Write-Host "== Self-test against a pretend AWS"
& node (Join-Path $PSScriptRoot 'selftest.mjs')
Add-Result 'Self-test (dry runs, apply, repeat, bank guard, flow, categories)' $(if ($LASTEXITCODE -eq 0) { 'PASS' } else { 'FAILED' })

Write-Host ""
Write-Host "== Secret scan (files in this folder)"
$pattern = 'AKIA[0-9A-Z]{16}|BEGIN (RSA|PRIVATE)|dev[0-9]{6}|ghp_[A-Za-z0-9]{20}|github_pa[t]_|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|arn:aws:[a-z]+:[a-z0-9-]*:[0-9]{12}'
$hits = @(Get-ChildItem -Path $repo -Recurse -File -ErrorAction SilentlyContinue |
    Where-Object { $_.FullName -notmatch '\\(\.git|node_modules)\\' } |
    Select-String -Pattern $pattern -ErrorAction SilentlyContinue)
if ($hits.Count -eq 0) { Add-Result 'No keys, tokens, account ids or instance ids in files' 'PASS' }
else {
    $hits | ForEach-Object { Write-Host ("  {0}:{1}" -f $_.Path, $_.LineNumber) }
    Add-Result 'No keys, tokens, account ids or instance ids in files' 'FAILED'
}

Write-Host ""
Write-Host "================ SUMMARY ================"
$failed = 0
foreach ($r in $results) {
    Write-Host ("  {0,-8} {1}" -f $r.Verdict, $r.Name)
    if ($r.Verdict -eq 'FAILED') { $failed++ }
}
Write-Host ""
if ($failed -eq 0) { Write-Host "All stages passed. Nothing was sent to AWS." }
else { Write-Host "$failed stage(s) FAILED. Scroll up to the first FAILED output and send me that part." }
exit $(if ($failed -eq 0) { 0 } else { 1 })
