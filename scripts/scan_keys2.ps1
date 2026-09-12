# scan_keys2.ps1 - multi-pattern memory scan (ASCII only; paths passed as args)
param([string]$OutPath)

$ErrorActionPreference = 'Stop'

$src = @'
using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;
public class M2 {
    [DllImport("kernel32.dll")] public static extern IntPtr OpenProcess(uint a, bool b, int p);
    [DllImport("kernel32.dll")] public static extern bool ReadProcessMemory(IntPtr h, IntPtr a, byte[] buf, int size, out int read);
    [DllImport("kernel32.dll")] public static extern int VirtualQueryEx(IntPtr h, IntPtr a, out MEMINFO lp, uint sz);
    [DllImport("kernel32.dll")] public static extern bool CloseHandle(IntPtr h);
    [StructLayout(LayoutKind.Sequential)]
    public struct MEMINFO { public IntPtr BaseAddress, AllocationBase; public uint AllocationProtect; public IntPtr RegionSize; public uint State, Protect, Type; }
    const uint Q = 0x0400, R = 0x0010; const int COMMIT = 0x1000; const uint GUARD = 0x100, NOACC = 0x01;

    static bool IsHex(byte b){ return (b>=48&&b<=57)||(b>=97&&b<=102)||(b>=65&&b<=70); }

    public static Dictionary<string,List<string>> Scan(int pid, long maxBytes) {
        var d = new Dictionary<string,List<string>>();
        d["p64"]=new List<string>(); d["p128"]=new List<string>(); d["u16"]=new List<string>();
        d["bare"]=new List<string>(); d["meta"]=new List<string>();
        IntPtr h = OpenProcess(Q|R, false, pid);
        if (h==IntPtr.Zero){ d["meta"].Add("OPEN_FAIL"); return d; }
        try {
            long addr=0, scanned=0; MEMINFO mi=new MEMINFO(); byte[] buf=new byte[4*1024*1024];
            while (VirtualQueryEx(h,(IntPtr)addr,out mi,(uint)Marshal.SizeOf(typeof(MEMINFO)))!=0) {
                long size=mi.RegionSize.ToInt64(); if(size<=0) break;
                bool ok=(mi.State==COMMIT)&&((mi.Protect&NOACC)==0)&&((mi.Protect&GUARD)==0);
                if(ok){
                    long off=0;
                    while(off<size && scanned<maxBytes){
                        int want=(int)Math.Min(buf.Length,size-off); int got=0;
                        if(ReadProcessMemory(h,(IntPtr)(addr+off),buf,want,out got)&&got>200){
                            for(int i=0;i<got-140;i++){
                                if(buf[i]==0x78&&buf[i+1]==0&&buf[i+2]==0x27&&buf[i+3]==0){
                                    bool all=true; char[] c=new char[64];
                                    for(int k=0;k<64;k++){ byte lo=buf[i+4+k*2]; byte hi=buf[i+5+k*2]; if(hi!=0||!IsHex(lo)){all=false;break;} c[k]=(char)lo; }
                                    if(all){ string s=new string(c).ToLowerInvariant(); if(!d["u16"].Contains(s)) d["u16"].Add(s); }
                                }
                                if(buf[i]==(byte)'x'&&buf[i+1]==(byte)0x27){
                                    bool a64=true; char[] c64=new char[64];
                                    for(int k=0;k<64;k++){ if(!IsHex(buf[i+2+k])){a64=false;break;} c64[k]=(char)buf[i+2+k]; }
                                    if(a64){
                                        bool a128=true; char[] c128=new char[128];
                                        for(int k=0;k<128;k++){ if(!IsHex(buf[i+2+k])){a128=false;break;} c128[k]=(char)buf[i+2+k]; }
                                        if(a128){ string s=new string(c128).ToLowerInvariant(); if(!d["p128"].Contains(s)) d["p128"].Add(s); }
                                        else { string s=new string(c64).ToLowerInvariant(); if(!d["p64"].Contains(s)) d["p64"].Add(s); }
                                    }
                                }
                                if(IsHex(buf[i])){
                                    bool run=true; for(int k=0;k<64;k++) if(!IsHex(buf[i+k])){run=false;break;}
                                    if(run && i+64<got && !IsHex(buf[i+64])){
                                        char[] c=new char[64]; for(int k=0;k<64;k++) c[k]=(char)buf[i+k];
                                        string s=new string(c).ToLowerInvariant();
                                        if(d["bare"].Count<2000 && !d["bare"].Contains(s)) d["bare"].Add(s);
                                    }
                                }
                            }
                        }
                        off+=want; scanned+=want;
                    }
                }
                addr+=size; if(scanned>=maxBytes) break;
            }
            d["meta"].Add("SCANNED="+scanned);
        } finally { CloseHandle(h); }
        return d;
    }
}
'@
Add-Type -TypeDefinition $src -Language CSharp

$res = @()
$procs = Get-Process -Name Weixin -ErrorAction SilentlyContinue | Sort-Object -Property WorkingSet64 -Descending
foreach ($p in $procs) {
    $exe = ''
    try { $exe = $p.Path } catch {}
    $d = [M2]::Scan($p.Id, 1200L * 1024 * 1024)
    $res += [pscustomobject]@{
        pid = $p.Id; ws_mb = [math]::Round($p.WorkingSet64 / 1MB); exe = $exe
        meta = $d['meta']; p64 = $d['p64']; p128 = $d['p128']; u16 = $d['u16']
        bareCount = $d['bare'].Count
        bareSample = @($d['bare'] | Select-Object -First 30)
    }
}
$res | ConvertTo-Json -Depth 5 | Set-Content -Path $OutPath -Encoding UTF8
