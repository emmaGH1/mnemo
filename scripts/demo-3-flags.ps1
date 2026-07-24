<#
.SYNOPSIS
One-command 3-flag demo for the recording. Calls the checker 3 times
on the Aria eye-color fixture and prints the flags. No image manipulation,
no coordinates, no copying.

.EXAMPLE
npm run demo:3flags
#>

$ErrorActionPreference = "Stop"
$repoRoot = (Resolve-Path "$PSScriptRoot\..").Path

Write-Host ""
Write-Host "============================================================"
Write-Host "  Mnemo - 3-panel demo (uses the Aria eye-color fixture)"
Write-Host "============================================================"
Write-Host ""

& npx tsx scripts/demo-3-flags-check.ts
