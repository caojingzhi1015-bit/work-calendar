$ErrorActionPreference = 'Stop'
$lines = @()
$p = Get-Process -Name Weixin -ErrorAction SilentlyContinue | Sort-Object WorkingSet64 -Descending | Select-Object -First 1
if ($p) {
    $lines += 'EXE=' + $p.Path
    $v = $p.MainModule.FileVersionInfo
    $lines += 'FILEVERSION=' + $v.FileVersion
    $lines += 'PRODUCTVERSION=' + $v.ProductVersion
    $lines += 'PRODUCTNAME=' + $v.ProductName
}
$lines += 'ACCOUNTS='
Get-ChildItem -Path 'D:\xwechat_files' -Directory -ErrorAction SilentlyContinue | ForEach-Object { $lines += '  ' + $_.Name }
$lines | Set-Content -Path $args[0] -Encoding UTF8
