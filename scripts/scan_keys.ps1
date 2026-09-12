# scan_keys.ps1 — 在 Weixin.exe 进程内存中搜索 WCDB 缓存的 SQLCipher raw key
# 只读取进程内存，不修改任何微信数据。结果写入 data/_keys.json
$ErrorActionPreference = 'Stop'
$out = @()

$src = @'
using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;
public class MemScanner {
    [DllImport("kernel32.dll")] public static extern IntPtr OpenProcess(uint a, bool b, int p);
    [DllImport("kernel32.dll")] public static extern bool ReadProcessMemory(IntPtr h, IntPtr a, byte[] buf, int size, out int read);
    [DllImport("kernel32.dll")] public static extern int VirtualQueryEx(IntPtr h, IntPtr a, out MEMINFO lp, uint sz);
    [DllImport("kernel32.dll")] public static extern bool CloseHandle(IntPtr h);
    [StructLayout(LayoutKind.Sequential)]
    public struct MEMINFO {
        public IntPtr BaseAddress, AllocationBase; public uint AllocationProtect;
        public IntPtr RegionSize; public uint State, Protect, Type;
    }
    public const uint PROCESS_QUERY_INFORMATION = 0x0400;
    public const uint PROCESS_VM_READ = 0x0010;
    public const int MEM_COMMIT = 0x1000;
    public const uint PAGE_GUARD = 0x100;
    public const uint PAGE_NOACCESS = 0x01;

    static bool IsHex(byte b){ return (b>=48 && b<=57) || (b>=97 && b<=102) || (b>=65 && b<=70); }

    public static List<string> Scan(int pid, long maxBytes) {
        var res = new List<string>();
        IntPtr h = OpenProcess(PROCESS_QUERY_INFORMATION | PROCESS_VM_READ, false, pid);
        if (h == IntPtr.Zero) { res.Add("__OPEN_FAIL__"); return res; }
        try {
            long addr = 0;
            long scanned = 0;
            MEMINFO mi = new MEMINFO();
            byte[] buf = new byte[1024*1024];
            while (VirtualQueryEx(h, (IntPtr)addr, out mi, (uint)Marshal.SizeOf(typeof(MEMINFO))) != 0) {
                long size = mi.RegionSize.ToInt64();
                if (size <= 0) break;
                bool ok = (mi.State == MEM_COMMIT) &&
                          ((mi.Protect & PAGE_NOACCESS) == 0) &&
                          ((mi.Protect & PAGE_GUARD) == 0);
                if (ok) {
                    long off = 0;
                    while (off < size && scanned < maxBytes) {
                        int want = (int)Math.Min(buf.Length, size - off);
                        int got = 0;
                        if (ReadProcessMemory(h, (IntPtr)(addr + off), buf, want, out got) && got > 80) {
                            for (int i = 0; i < got - 66; i++) {
                                if (buf[i] == (byte)'x' && buf[i+1] == (byte)0x27) {
                                    bool all = true;
                                    for (int k = 0; k < 64; k++) if (!IsHex(buf[i+2+k])) { all = false; break; }
                                    if (all) {
                                        char[] c = new char[64];
                                        for (int k = 0; k < 64; k++) c[k] = (char)buf[i+2+k];
                                        string s = new string(c).ToLowerInvariant();
                                        if (!res.Contains(s)) res.Add(s);
                                    }
                                }
                            }
                        }
                        off += want; scanned += want;
                    }
                }
                addr += size;
                if (scanned >= maxBytes) break;
            }
            res.Add("__SCANNED__" + scanned);
        } finally { CloseHandle(h); }
        return res;
    }
}
'@
Add-Type -TypeDefinition $src -Language CSharp

$procs = Get-Process -Name Weixin -ErrorAction SilentlyContinue
foreach ($p in $procs) {
    $r = [MemScanner]::Scan($p.Id, 900L * 1024 * 1024)
    $keys = @($r | Where-Object { $_ -notmatch '^__' })
    $meta = @($r | Where-Object { $_ -match '^__' })
    $out += [pscustomobject]@{
        pid      = $p.Id
        ws_mb    = [math]::Round($p.WorkingSet64 / 1MB)
        scanned  = ($meta -join ',')
        keyCount = $keys.Count
        keys     = $keys
    }
}
$out | ConvertTo-Json -Depth 4 | Set-Content -Path $args[0] -Encoding UTF8
