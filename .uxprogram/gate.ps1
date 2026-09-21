# Project gate: runs every check even after a failure; exit 0 only when all pass.
# A check that cannot run is a failure, never a skip.
$ErrorActionPreference = 'Continue'
Set-Location (git rev-parse --show-toplevel)
$py = if ($env:PY) { $env:PY } else { 'python' }
$base = (Get-Content .uxprogram/base_rev -Raw).Trim()
$script:failed = @()
function Invoke-Check([string]$name, [scriptblock]$cmd) {
  Write-Output "=== CHECK $name"
  $global:LASTEXITCODE = 0
  try { & $cmd } catch { Write-Output $_; $global:LASTEXITCODE = 1 }
  if ($LASTEXITCODE -ne 0) { Write-Output "=== FAIL $name"; $script:failed += $name }
  else { Write-Output "=== PASS $name" }
}
Invoke-Check 'build'      { cmd /c npm run build }
Invoke-Check 'lint'       { cmd /c npm run typecheck }
Invoke-Check 'tests'      { cmd /c npm test }
Invoke-Check 'ux-checks'  { & $py -c "print('permanent UX checks: 0 configured')" }
Invoke-Check 'probe'      { cmd /c npx playwright --version }
Invoke-Check 'authorship' { & $py .uxprogram/kit/tools/authorship_scan.py --base $base }
Invoke-Check 'negative'   { & $py .uxprogram/kit/tools/negative_space.py --base $base }
if ($script:failed.Count -eq 0) { Write-Output 'GATE: PASS'; exit 0 }
Write-Output ('GATE: FAIL ' + ($script:failed -join ' '))
exit 1
