#Requires -Version 5.1
<#
.SYNOPSIS
  Contact Lens lab helper (Windows PowerShell).

.DESCRIPTION
  .\scripts\lens.ps1 check
  .\scripts\lens.ps1 check --user YOUR_LOGIN
  .\scripts\lens.ps1 queue --user YOUR_LOGIN            (dry run)
  .\scripts\lens.ps1 queue --user YOUR_LOGIN --apply    (does it)
  .\scripts\lens.ps1 flow [--apply | --print]
  .\scripts\lens.ps1 categories [--apply] [--eventbridge]
  .\scripts\lens.ps1 rule-export [--name NAME]
  .\scripts\lens.ps1 results [--hours 6]

  Anything that changes AWS is a dry run unless you add --apply.
  Set LENS_INSTANCE_ALIAS to your own instance alias first.
#>
Set-StrictMode -Version 2
$ErrorActionPreference = 'Continue'
$global:LASTEXITCODE = 0

if (-not $env:AWS_REGION) { $env:AWS_REGION = 'ap-southeast-2' }
$env:AWS_DEFAULT_REGION = $env:AWS_REGION

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "STOPPED: 'node' is not installed or PowerShell cannot see it." -ForegroundColor Red
    Write-Host "Run:  winget install OpenJS.NodeJS.LTS   then close and reopen PowerShell."
    exit 1
}

$printOnly = ($args -contains '--print')
if (-not $printOnly) {
    if (-not (Get-Command aws -ErrorAction SilentlyContinue)) {
        Write-Host "STOPPED: 'aws' is not installed or PowerShell cannot see it." -ForegroundColor Red
        Write-Host "Run:  winget install Amazon.AWSCLI   then close and reopen PowerShell."
        exit 1
    }
    & aws sts get-caller-identity --query Account --output text 2>$null | Out-Null
    if ($LASTEXITCODE -ne 0) {
        Write-Host "STOPPED: no working AWS login. Run  aws configure  (or  aws sso login ) and try again." -ForegroundColor Red
        exit 1
    }
}

& node (Join-Path $PSScriptRoot 'lens.mjs') @args
exit $LASTEXITCODE
