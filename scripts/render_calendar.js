#!/usr/bin/env node
/**
 * render_calendar.js — 固定周期日历（每月 16 日 ~ 次月 15 日）
 *
 * 用法:
 *   node render_calendar.js [startDate] [endDate]
 *   例: node render_calendar.js 2026-08-16 2026-09-15
 *
 * 布局规则（用户定稿）:
 *   - 只渲染周期内的日期，第一格永远是本周期起始日（16 日）
 *   - 7 列顺序排布，末尾不足的空位不画（其他日期直接删除）
 *   - 每格：左上星期、右上日期（月初带月份），有工作 = 蓝色事件条
 *   - 今天红圈；无记录留白；鼠标悬停看备注
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DATA = path.join(ROOT, 'data', 'daily.json');
const OUTDIR = path.join(ROOT, 'output');
const WEEK = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

function parseDate(s) {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}
function fmt(dt) {
  const p = (n) => String(n).padStart(2, '0');
  return `${dt.getFullYear()}-${p(dt.getMonth() + 1)}-${p(dt.getDate())}`;
}
function addDays(dt, n) {
  const d = new Date(dt.getTime());
  d.setDate(d.getDate() + n);
  return d;
}

function main() {
  const raw = JSON.parse(fs.readFileSync(DATA, 'utf8'));
  const meta = raw.meta || {};
  const start = process.argv[2] || meta.start;
  const end = process.argv[3] || meta.end;
  if (!start || !end) { console.error('缺少起始/结束日期'); process.exit(1); }

  const today = fmt(new Date());
  const esc = (t) => String(t || '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const get = (k) => {
    const v = (raw.days && raw.days[k]) || '';
    return (typeof v === 'string') ? { text: v, work: !!v, note: '' } : (v || {});
  };

  // ---- 周期内的所有日期（第一格 = 起始日） ----
  const days = [];
  for (let d = parseDate(start); d <= parseDate(end); d = addDays(d, 1)) days.push(new Date(d.getTime()));

  // ---- 统计 ----
  let filled = 0, workDays = 0, starred = 0, lastActive = start;
  days.forEach((d) => {
    const k = fmt(d);
    const it = get(k);
    if (String(it.text || '').trim()) {
      filled++;
      if (it.work) { workDays++; lastActive = k; }
      if (String(it.note || '').includes('★')) starred++;
    }
  });
  const rangeTxt = `${start.replace(/-/g, '.')} – ${lastActive.replace(/-/g, '.')}`;

  // ---- 渲染格子 ----
  let body = '';
  for (let i = 0; i < days.length; i += 7) {
    body += '<tr>';
    for (let j = 0; j < 7; j++) {
      const d = days[i + j];
      if (!d) { body += '<td class="void"></td>'; continue; }   // 周期结束，不画
      const k = fmt(d);
      const it = get(k);
      const text = String(it.text || '').trim();
      const note = String(it.note || '').trim();
      const star = note.includes('★');
      const wd = d.getDay();
      const cls = ['cell'];
      if (wd === 0 || wd === 6) cls.push('we');
      if (k === today) cls.push('today');
      const tip = note ? ` title="${esc(note)}"` : '';
      const label = d.getDate() === 1 ? `${d.getMonth() + 1}月1日` : String(d.getDate());
      const numCls = k === today ? 'dnum today-num' : 'dnum';
      body += `<td class="${cls.join(' ')}"${tip}>`
        + `<div class="dhead"><span class="wd">${WEEK[wd]}</span>`
        + `<span class="${numCls}">${label}</span></div>`
        + (text ? `<div class="ev${star ? ' star' : ''}">${esc(text)}</div>` : '')
        + `</td>`;
    }
    body += '</tr>';
  }

  const title = `${start.replace(/-/g, '.')} – ${end.replace(/-/g, '.')} 工作日历`;

  const html = `<!DOCTYPE html>
<html lang="zh-CN"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="default">
<meta name="theme-color" content="#ffffff">
<link rel="manifest" href="manifest.webmanifest">
<title>${title}</title>
<style>
  :root{
    --bg:#eef0f3; --card:#ffffff; --line:#ececef; --ink:#1a1a1a;
    --muted:#8a9099;
    --ev-bg:#d6e7ff; --ev-ink:#1b66d6; --star-bg:#b9d7ff;
    --red:#fa5151;
  }
  *{box-sizing:border-box}
  html,body{margin:0;padding:0}
  body{padding:18px 12px;background:var(--bg);color:var(--ink);
    font:14px/1.45 -apple-system,"PingFang SC","Microsoft YaHei","Segoe UI",sans-serif;}
  .wrap{max-width:1020px;margin:0 auto;background:var(--card);border:1px solid var(--line);
    border-radius:16px;padding:18px 18px 12px;box-shadow:0 1px 4px rgba(16,22,26,.05);}

  /* 第一行：出勤天数 */
  .statbar{display:flex;align-items:baseline;gap:12px;flex-wrap:wrap;
    border:1px solid var(--line);border-radius:12px;padding:12px 16px;margin-bottom:14px;
    background:linear-gradient(180deg,#f4f8ff,#eef4ff);}
  .statbar .big{font-size:21px;font-weight:700;letter-spacing:.5px}
  .statbar .big em{font-style:normal;color:var(--ev-ink)}
  .statbar .rng{color:var(--muted);font-size:13px}
  .statbar .sub{margin-left:auto;color:var(--muted);font-size:12px}

  table{width:100%;border-collapse:collapse;table-layout:fixed}
  td.cell{border:1px solid var(--line);vertical-align:top;height:98px;
    padding:5px 7px;background:#fff;overflow:hidden}
  td.cell.we{background:#f7f8fa}
  td.void{border:none;background:transparent}
  .dhead{display:flex;justify-content:space-between;align-items:baseline;gap:4px}
  .wd{font-size:10.5px;color:var(--muted);font-weight:500}
  .dnum{font-size:15px;font-weight:600;color:var(--ink)}
  .dnum.today-num{display:inline-block;width:23px;height:23px;line-height:23px;
    text-align:center;border-radius:50%;background:var(--red);color:#fff;font-size:12.5px}
  .ev{position:relative;margin-top:6px;background:var(--ev-bg);color:var(--ev-ink);
    border-radius:6px;padding:3px 6px 3px 15px;font-size:11.5px;line-height:1.35;word-break:break-word}
  .ev::before{content:'';position:absolute;left:6px;top:8px;width:5px;height:5px;
    border-radius:50%;background:var(--ev-ink)}
  .ev.star{background:var(--star-bg)}

  .legend{margin-top:12px;padding:8px 2px 2px;color:var(--muted);font-size:11.5px;
    display:flex;gap:16px;flex-wrap:wrap;align-items:center}
  .chip{display:inline-block;width:14px;height:10px;border-radius:3px;vertical-align:-1px;margin-right:4px}
  .foot{margin-top:6px;padding:4px 2px 6px;color:var(--muted);font-size:11px;
    display:flex;justify-content:space-between;flex-wrap:wrap;gap:6px}

  @media (max-width:640px){
    body{padding:10px 6px}
    .wrap{padding:12px 10px 8px;border-radius:12px}
    .statbar{padding:10px 12px}
    .statbar .big{font-size:19px}
    td.cell{height:84px;padding:4px 4px}
    .dnum{font-size:13px}
    .wd{font-size:9px}
    .ev{font-size:9.5px;padding:2px 3px 2px 11px;line-height:1.3}
    .ev::before{left:4px;top:7px;width:4px;height:4px}
    .legend{font-size:10.5px;gap:10px}
  }
  @media print{ body{background:#fff;padding:0} .wrap{border:none;box-shadow:none} }
</style></head>
<body><div class="wrap">

  <div class="statbar">
    <span class="big">出勤 <em>${workDays}</em> 天</span>
    <span class="rng">${rangeTxt}</span>
    <span class="sub">共 ${days.length} 天 · 已记录 ${filled} 天 · 蓝条 = 当日工作内容</span>
  </div>

  <table><tbody>${body}</tbody></table>

  <div class="legend">
    <span><span class="chip" style="background:var(--ev-bg)"></span>当日有工作产出</span>
    <span><span class="chip" style="background:var(--star-bg)"></span>聊天中明确要求记工时</span>
    <span>空白格 = 无记录 / 日期未到（悬停看备注）</span>
  </div>
  <div class="foot"><span>周期：每月 16 日 – 次月 15 日 · 数据源：微信（${esc(meta.source || '')}）</span><span>生成于 ${today}</span></div>
</div>
<script>
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(function(){});
}
</script>
</body></html>`;

  if (!fs.existsSync(OUTDIR)) fs.mkdirSync(OUTDIR, { recursive: true });
  const out = path.join(OUTDIR, `calendar_${start}_${end}.html`);
  fs.writeFileSync(out, html, 'utf8');
  console.log('已生成: ' + out);
  console.log(`统计: 出勤 ${workDays} 天 / 记录 ${filled} 天 / ★记工时 ${starred} 天 / 区间 ${rangeTxt}`);
}

main();
