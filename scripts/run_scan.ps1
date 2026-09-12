$ErrorActionPreference = 'Stop'
$dir  = 'D:\KuGou\Lyric\剪映\2026-09-12-13-58-04\WeChatCalendar'
$log  = Join-Path $dir 'data\_err.txt'
$msg  = ''
try {
    & (Join-Path $dir 'scripts\scan_keys2.ps1') -OutPath (Join-Path $dir 'data\_keys2.json')
    $msg = 'OK'
} catch {
    $msg = 'EXCEPTION: ' + $_.Exception.Message + "`n---`n" + $_.ScriptStackTrace
}
Set-Content -Path $log -Value $msg -Encoding UTF8
