$ErrorActionPreference = 'Stop'
$lines = @()
$msix = $args[0]
$ext  = $args[1]
$out  = $args[2]

$lines += 'MSIX: ' + $msix + ' exists=' + (Test-Path $msix)
$lines += 'EXT : ' + $ext  + ' exists=' + (Test-Path $ext)
try { $lines += 'EXT files: ' + ((Get-ChildItem $ext -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Name) -join ', ') } catch {}

try {
    $r = Add-AppxPackage -Path $msix -ExternalLocation $ext -ErrorAction Stop 2>&1
    $lines += 'ADD-APPX: OK'
    $lines += ('OUT: ' + ($r | Out-String))
} catch {
    $lines += 'ADD-APPX: FAILED'
    $lines += ('MSG: ' + $_.Exception.Message)
    $lines += ('HRESULT: ' + $_.Exception.HResult)
}

$lines += '--- verify ---'
$pkgs = Get-AppxPackage -ErrorAction SilentlyContinue | Where-Object { $_.Name -like '*WorkBuddy*' -or $_.PackageFullName -like '*WorkBuddy*' }
if ($pkgs) { foreach ($p in $pkgs) { $lines += ('FOUND ' + $p.Name + ' | ' + $p.PackageFullName + ' | status=' + $p.Status + ' | ver=' + $p.Version) } }
else { $lines += 'STILL NOT REGISTERED' }

$lines | Set-Content -Path $out -Encoding UTF8
