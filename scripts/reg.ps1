$ErrorActionPreference = 'Stop'
$lines = @()
$msix = $args[0]
$out   = $args[1]

$lines += 'MSIX path: ' + $msix
$lines += 'exists: ' + (Test-Path $msix)

try {
    $r = Add-AppxPackage -Path $msix -ErrorAction Stop 2>&1
    $lines += 'ADD-APPX: OK'
    $lines += ('OUT: ' + ($r | Out-String))
} catch {
    $lines += 'ADD-APPX: FAILED'
    $lines += ('MSG: ' + $_.Exception.Message)
    $lines += ('HRESULT: ' + $_.Exception.HResult)
    $lines += ('CATEGORY: ' + $_.CategoryInfo.Category)
}

$lines += '--- verify ---'
$pkgs = Get-AppxPackage -ErrorAction SilentlyContinue | Where-Object { $_.Name -like '*WorkBuddy*' -or $_.PackageFullName -like '*WorkBuddy*' }
if ($pkgs) { foreach ($p in $pkgs) { $lines += ('FOUND ' + $p.Name + ' | ' + $p.PackageFullName + ' | status=' + $p.Status) } }
else { $lines += 'STILL NOT REGISTERED' }

$lines | Set-Content -Path $out -Encoding UTF8
