$ErrorActionPreference = 'Stop'
$lines = @()
$lines += '=== Appx packages matching WorkBuddy ==='
$pkgs = Get-AppxPackage -ErrorAction SilentlyContinue | Where-Object { $_.Name -like '*WorkBuddy*' -or $_.PackageFullName -like '*WorkBuddy*' }
if ($pkgs) {
    foreach ($p in $pkgs) {
        $lines += ('NAME=' + $p.Name)
        $lines += ('FULL=' + $p.PackageFullName)
        $lines += ('VER=' + $p.Version)
        $lines += ('STATUS=' + $p.Status)
        $lines += ('INSTALL=' + $p.InstallLocation)
    }
} else { $lines += 'NONE' }

$lines += '=== All sparse/external packages ==='
$all = Get-AppxPackage -ErrorAction SilentlyContinue | Where-Object { $_.SignatureKind -eq 'Developer' -or $_.IsFramework -eq $false } | Select-Object -First 40
foreach ($p in $all) { $lines += ('  ' + $p.Name + ' | ' + $p.PackageFullName) }

$lines += '=== Registry: Share Targets ==='
$k = 'HKCU:\Software\Classes\Local Settings\Software\Microsoft\Windows\CurrentVersion\AppModel\Repository\Packages'
if (Test-Path $k) {
    Get-ChildItem -Path $k -ErrorAction SilentlyContinue | ForEach-Object {
        if ($_.PSChildName -like '*WorkBuddy*') { $lines += ('  PKG ' + $_.PSChildName) }
    }
} else { $lines += '  (key missing)' }

$lines += '=== Shell: SendTo / Share ==='
$lines += ('AppResolver OK')

$lines | Set-Content -Path $args[0] -Encoding UTF8
