/* 工作日程日历 —— 单页应用（无构建、纯静态）
 * 1) 输入年月 → 自动生成「16 日 ~ 次月 15 日」日历
 * 2) 拖入微信导出的 .txt → 自动解析并按日归纳
 * 3) 可接 OpenAI 兼容大模型做高质量归纳（可选）
 * 4) 可从远端 daily.json 同步（WorkBuddy 更新后 push 到 GitHub 即生效）
 */
'use strict';

const WEEK = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
const LS_DATA = 'wbcal:data:';
const LS_RAW = 'wbcal:raw:';
const LS_SET = 'wbcal:settings';

// 内置种子数据：2026-08-16 ~ 2026-09-15（由 WorkBuddy 从聊天记录整理）
const SEED_START = '2026-08-16';
const SEED = {
  '2026-08-16': '核对考勤天数+晚间两波分发',
  '2026-08-17': '弹卡邮件+粉丝通配置+一键发博页',
  '2026-08-18': '排查发博二维码bug+维护栏目配置',
  '2026-08-19': '整理直播热搜榜效+粉丝通投放',
  '2026-08-20': '整理周边图+歌词文档+扫楼物料分发',
  '2026-08-21': '填活动信息表+做商业物料包',
  '2026-08-22': '晚间临时分发救急',
  '2026-08-23': '做大屏物料包：图+视频+GIF',
  '2026-08-24': '维护榜单条目+确认返京行程',
  '2026-08-25': '写朋友圈文案+发演唱会弹卡邮件',
  '2026-08-26': '发认证修改邮件+写产品玩法方案',
  '2026-08-27': '完善超话彩蛋产品玩法方案',
  '2026-08-28': '提电影长图活动设计需求',
  '2026-08-29': '晚间演唱会物料分发',
  '2026-08-31': '做群星盛典氛围包+物料图包',
  '2026-09-01': '做盛典物料包+活动图+超享购排期',
  '2026-09-02': '发邮件+整理超享购活动细则',
  '2026-09-03': '配置粉条+连续多日粉丝通投放',
  '2026-09-04': '剪视频图包+替换海报+数据盘点',
  '2026-09-05': '做年度推荐系列图+晚间值守',
  '2026-09-06': '直播录屏cut+回放粉丝通投放',
  '2026-09-07': '发生日弹卡邮件+数据核查',
  '2026-09-09': '对接演唱会弹卡+高级话题页素材',
  '2026-09-10': '配高级话题页+申请协管+整理音频',
  '2026-09-11': '剪视频+改话题页+筛热搜话题',
  '2026-09-12': '筛选演唱会热榜数据'
};
const SEED_NOTE = {
  '2026-08-16': '核算上月至本月考勤共10天',
  '2026-08-19': '科目三通过',
  '2026-08-21': '物料未官宣，注意保密',
  '2026-08-22': '★记工时：晚8点后待命，要求记录工作时长',
  '2026-08-24': '告知周四回京、周五上班',
  '2026-08-29': '周末加班',
  '2026-08-31': '凌晨连轴分发，产出三组图包',
  '2026-09-01': '发烧仍在线工作',
  '2026-09-04': '发烧居家办公，回公司取电脑',
  '2026-09-05': '★记工时：晚7点—10点值守分发',
  '2026-09-06': '★记工时：「周末记得算上工作日」',
  '2026-09-10': '提交下周在岗时间表',
  '2026-09-11': '★记工时：「记得工作天数」',
  '2026-09-12': '凌晨仍在处理数据'
};

/* 远端同步默认地址：GitHub raw（WorkBuddy 更新后 push 即生效） */
const DEFAULT_SYNC = 'https://raw.githubusercontent.com/caojingzhi1015-bit/work-calendar/main/data/daily.json';

let state = { start: '', end: '', days: {}, raw: {} };
let settings = { me: '', api: '', model: 'deepseek-chat', key: '', sync: DEFAULT_SYNC };

/* ---------------- 基础工具 ---------------- */
const pad = (n) => String(n).padStart(2, '0');
const fmt = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const addDays = (d, n) => { const x = new Date(d.getTime()); x.setDate(x.getDate() + n); return x; };
const $ = (id) => document.getElementById(id);

function periodOf(monthVal) {
  const [y, m] = monthVal.split('-').map(Number);
  return { s: new Date(y, m - 1, 16), e: new Date(y, m, 15) };
}
function currentMonthVal() {
  const now = new Date();
  return now.getDate() >= 16
    ? `${now.getFullYear()}-${pad(now.getMonth() + 1)}`
    : (() => { const p = new Date(now.getFullYear(), now.getMonth() - 1, 1); return `${p.getFullYear()}-${pad(p.getMonth() + 1)}`; })();
}
function toast(msg) {
  const t = $('toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(t._t); t._t = setTimeout(() => t.classList.remove('show'), 2200);
}

/* ---------------- 存储 ---------------- */
function loadPeriod(start) {
  try {
    const d = JSON.parse(localStorage.getItem(LS_DATA + start) || 'null');
    const r = JSON.parse(localStorage.getItem(LS_RAW + start) || 'null');
    if (d) { state.days = d; state.raw = r || {}; return true; }
  } catch (e) { /* ignore */ }
  state.days = {}; state.raw = {};
  return false;
}
function savePeriod() {
  try {
    localStorage.setItem(LS_DATA + state.start, JSON.stringify(state.days));
    localStorage.setItem(LS_RAW + state.start, JSON.stringify(state.raw));
  } catch (e) { toast('本地存储写入失败'); }
}
function loadSettings() {
  try { Object.assign(settings, JSON.parse(localStorage.getItem(LS_SET) || '{}')); } catch (e) { }
}
function saveSettings() { localStorage.setItem(LS_SET, JSON.stringify(settings)); }

/* ---------------- 渲染 ---------------- */
function render() {
  const { s, e } = periodOf($('monthPick').value);
  state.start = fmt(s); state.end = fmt(e);
  if (!loadPeriod(state.start)) {
    if (state.start === SEED_START) {
      Object.keys(SEED).forEach((k) => { state.days[k] = { text: SEED[k], work: true, note: SEED_NOTE[k] || '' }; });
    } else {
      tryRemote();
    }
  }
  draw();
}

function draw() {
  const grid = $('grid');
  grid.innerHTML = '';
  const today = fmt(new Date());
  const s = new Date(state.start + 'T00:00:00');
  const e = new Date(state.end + 'T00:00:00');
  const cells = [];
  for (let d = new Date(s.getTime()); d <= e; d = addDays(d, 1)) cells.push(new Date(d.getTime()));

  let row = null;
  cells.forEach((d, i) => {
    if (i % 7 === 0) { row = document.createElement('div'); row.className = 'week'; grid.appendChild(row); }
    const k = fmt(d);
    if (k < state.start || k > state.end) { const v = document.createElement('div'); v.className = 'cell void'; row.appendChild(v); return; }
    const rec = state.days[k] || {};
    const text = (rec.text || '').trim();
    const wd = d.getDay();
    const div = document.createElement('div');
    div.className = 'cell' + (wd === 0 || wd === 6 ? ' we' : '') + (k === today ? ' todaybox' : '');
    div.dataset.date = k;
    if (rec.note) div.title = rec.note;
    const label = d.getDate() === 1 ? `${d.getMonth() + 1}月1日` : String(d.getDate());
    div.innerHTML = `<div class="dhead"><span class="wd">${WEEK[wd]}</span>`
      + `<span class="dnum${k === today ? ' today' : ''}">${label}</span></div>`
      + (text
        ? `<div class="ev${String(rec.note || '').includes('★') ? ' star' : ''}">${escapeHtml(text)}</div>`
        : `<div class="ev empty">—</div>`);
    div.addEventListener('click', () => openEditor(k));
    row.appendChild(div);
  });

  // 统计
  let work = 0, filled = 0, last = state.start;
  Object.keys(state.days).sort().forEach((k) => {
    const r = state.days[k];
    if (String(r.text || '').trim()) { filled++; if (r.work) { work++; last = k; } }
  });
  $('statWork').textContent = work;
  $('statRange').textContent = `${state.start.replace(/-/g, '.')} – ${last.replace(/-/g, '.')}`;
  $('statSub').textContent = `共 ${cells.length} 天 · 已记录 ${filled} 天`;
}

function escapeHtml(s) {
  return String(s || '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

/* ---------------- 编辑单日 ---------------- */
let editing = null;
function openEditor(date) {
  editing = date;
  const r = state.days[date] || {};
  $('edTitle').textContent = `${date}（${WEEK[new Date(date + 'T00:00:00').getDay()]}）`;
  $('edText').value = r.text || '';
  $('edWork').checked = !!r.work;
  $('edNote').value = r.note || '';
  const msgs = state.raw[date] || [];
  $('edRaw').textContent = msgs.length
    ? msgs.slice(0, 40).map((m) => `${m.time} ${m.sender}：${m.text}`).join('\n')
    : '（这天没有导入聊天记录原文）';
  $('editor').classList.add('show');
}
$('edCancel').onclick = () => $('editor').classList.remove('show');
$('edSave').onclick = () => {
  if (!editing) return;
  const t = $('edText').value.trim();
  if (t) state.days[editing] = { text: t, work: $('edWork').checked, note: $('edNote').value.trim() };
  else delete state.days[editing];
  savePeriod(); draw(); $('editor').classList.remove('show');
  toast('已保存');
};

/* ---------------- 微信 txt 解析 ---------------- */
const RE_DATE = /^\s*(\d{4})年(\d{1,2})月(\d{1,2})日\s+(\d{1,2}):(\d{2})/;
function parseWechat(txt) {
  const lines = txt.replace(/^﻿/, '').split(/\r?\n/);
  const out = {};
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(RE_DATE);
    if (!m) continue;
    const date = `${m[1]}-${pad(m[2])}-${pad(m[3])}`;
    const sender = (lines[i - 1] || '').trim() || '?';
    const time = `${pad(m[4])}:${m[5]}`;
    const buf = [];
    let j = i + 1;
    while (j < lines.length && !RE_DATE.test(lines[j])) { const t = lines[j].trim(); if (t) buf.push(t); j++; }
    const text = buf.join(' ').replace(/\s+/g, ' ').trim();
    if (!text) continue;
    (out[date] = out[date] || []).push({ sender, time, text });
    i = j - 1;
  }
  return out;
}

const ACTION = /整理|分发|邮件|配置|粉丝通|粉条|物料|图包|视频|cut|剪|填|写|提|排查|维护|对接|筛选|做|核对|统计|申请|弹卡|话题页|海报|录屏|排期|值守|投放|替换|梳理|改|检查|发送|下载|上传|跟进|预约|发布|置顶|加|确认/;
const WORKHIT = /(工时|记上|算上|工作时长|值守|值班|考勤|记得算|工作天数|算工作|你该工作|记录工作)/;

function guessSummary(msgs, me) {
  if (!msgs || !msgs.length) return '';
  let who = me;
  if (!who) {
    const cnt = {};
    msgs.forEach((m) => { cnt[m.sender] = (cnt[m.sender] || 0) + 1; });
    who = Object.keys(cnt).sort((a, b) => cnt[b] - cnt[a])[0];
  }
  let best = '', score = -1;
  msgs.forEach((m) => {
    if (me && m.sender !== me) return;
    let t = m.text.replace(/https?:\/\/\S+/g, '').replace(/\[[^\]]{1,8}\]/g, '').trim();
    if (/^#/.test(t) || t.length < 4) return;
    let s = 0;
    if (ACTION.test(t)) s += 2;
    if (t.length >= 6 && t.length <= 30) s += 1;
    if (s > score) { score = s; best = t; }
  });
  if (!best) {
    const any = msgs.map((m) => m.text).find((t) => t && t.length > 4 && !/^#/.test(t) && !/^https?:/.test(t));
    best = any || '';
  }
  return best.slice(0, 20);
}
function workNoteOf(msgs) {
  const hit = msgs.find((m) => WORKHIT.test(m.text));
  return hit ? hit.text.replace(/\s+/g, ' ').slice(0, 40) : '';
}

/* ---------------- 文件导入 ---------------- */
let pending = null;   // {byDate, file}

function onFile(file) {
  if (!file) return;
  const rd = new FileReader();
  rd.onload = () => {
    const txt = String(rd.result || '');
    if (/\.json$/i.test(file.name) || txt.trim().startsWith('{')) {
      try {
        const j = JSON.parse(txt);
        const days = j.days || j;
        if (days && typeof days === 'object') {
          Object.keys(days).forEach((k) => {
            const v = days[k];
            state.days[k] = (typeof v === 'string') ? { text: v, work: !!v, note: '' } : v;
          });
          savePeriod(); draw(); toast('已导入 JSON 数据');
          return;
        }
      } catch (e) { toast('JSON 解析失败'); return; }
    }
    const byDate = parseWechat(txt);
    const keys = Object.keys(byDate);
    if (!keys.length) { toast('没解析到聊天记录，确认是否为微信导出的 txt'); return; }
    pending = { byDate };
    showPreview(byDate);
  };
  rd.readAsText(file, 'utf-8');
}

function showPreview(byDate) {
  const dates = Object.keys(byDate).sort().filter((d) => d >= state.start && d <= state.end);
  const box = $('pvList'); box.innerHTML = '';
  if (!dates.length) { toast('该文件的日期不落在当前周期内'); }
  dates.forEach((d) => {
    const msgs = byDate[d];
    const g = guessSummary(msgs, settings.me);
    const row = document.createElement('div'); row.className = 'pvrow';
    row.innerHTML = `<div class="d">${d.slice(5)}<div class="cnt">${msgs.length} 条</div></div>`
      + `<div><input type="text" data-d="${d}" value="${escapeHtml(g)}" maxlength="40"></div>`;
    box.appendChild(row);
  });
  $('pvMeta').textContent = `共解析 ${Object.keys(byDate).length} 天，其中 ${dates.length} 天落在当前周期（${state.start} ~ ${state.end}）。确认后填入日历。`;
  $('preview').classList.add('show');
}

$('pvCancel').onclick = () => { pending = null; $('preview').classList.remove('show'); };
$('pvGuess').onclick = () => {
  document.querySelectorAll('#pvList input').forEach((inp) => {
    const d = inp.dataset.d;
    inp.value = guessSummary(pending.byDate[d], settings.me).slice(0, 20);
  });
};
$('pvApply').onclick = () => {
  if (!pending) return;
  document.querySelectorAll('#pvList input').forEach((inp) => {
    const d = inp.dataset.d;
    const t = inp.value.trim();
    if (!t) return;
    const msgs = pending.byDate[d] || [];
    const note = workNoteOf(msgs);
    state.days[d] = { text: t.slice(0, 20), work: true, note: note ? (WORKHIT.test(note) && !note.startsWith('★') ? '★记工时：' + note : note) : '' };
  });
  Object.keys(pending.byDate).forEach((d) => {
    if (d >= state.start && d <= state.end) state.raw[d] = pending.byDate[d];
  });
  savePeriod(); draw();
  $('preview').classList.remove('show'); pending = null;
  toast('已填入日历');
};

/* ---------------- AI 归纳 ---------------- */
async function aiOne(date, msgs) {
  const body = msgs.slice(0, 60).map((m) => `${m.time} ${m.sender}：${m.text}`).join('\n').slice(0, 3500);
  const prompt = `下面是某人在工作中一天的微信聊天记录。请用不超过 20 个汉字，概括"我"这一天主要做了什么工作。
要求：
1. 只输出一句话，不要引号、不要句号、不要日期、不要解释
2. 不要出现任何人名、艺人名、明星名，只写动作和事物，例如"做大屏物料包：图+视频+GIF"
3. 用中文，20 字以内

聊天记录：
${body}`;
  const r = await fetch(settings.api, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + settings.key },
    body: JSON.stringify({ model: settings.model, messages: [{ role: 'user', content: prompt }], temperature: 0.3 })
  });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  const j = await r.json();
  let t = (j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content) || '';
  t = t.replace(/^["'“”「]|["'“”」]$/g, '').replace(/[。.！!]$/, '').trim();
  return t.slice(0, 20);
}

async function runAI() {
  const dates = Object.keys(state.raw).sort().filter((d) => d >= state.start && d <= state.end);
  if (!dates.length) { toast('先导入聊天记录，再进行 AI 归纳'); return; }
  if (!settings.api || !settings.key) { toast('请先在设置里填 AI 接口地址和 Key'); $('settings').classList.add('show'); return; }
  const btn = $('btnAI'); btn.disabled = true;
  let done = 0, fail = 0;
  const queue = dates.slice();
  async function worker() {
    while (queue.length) {
      const d = queue.shift();
      try {
        const t = await aiOne(d, state.raw[d] || []);
        if (t) {
          const note = workNoteOf(state.raw[d] || []);
          state.days[d] = { text: t, work: true, note: note ? '★记工时：' + note : (state.days[d] && state.days[d].note) || '' };
        }
      } catch (e) { fail++; }
      done++;
      btn.textContent = `AI ${done}/${dates.length}`;
      if (done % 3 === 0) { savePeriod(); draw(); }
    }
  }
  await Promise.all([worker(), worker(), worker()]);
  savePeriod(); draw();
  btn.disabled = false; btn.textContent = 'AI 归纳';
  toast(fail ? `完成，${fail} 天失败（检查 Key / 网络）` : `已用 AI 归纳 ${dates.length} 天`);
}

/* ---------------- 同步 / 导出 ---------------- */
async function tryRemote() {
  const url = settings.sync || DEFAULT_SYNC;
  try {
    const r = await fetch(url + (url.includes('?') ? '&' : '?') + 't=' + Date.now());
    if (!r.ok) return;
    const j = await r.json();
    const days = j.days || j;
    const st = (j.meta && j.meta.start) || Object.keys(days).sort()[0];
    if (st !== state.start) return;
    Object.keys(days).forEach((k) => {
      const v = days[k];
      state.days[k] = (typeof v === 'string') ? { text: v, work: !!v, note: '' } : v;
    });
    savePeriod(); draw();
    $('syncState').textContent = '已从远端同步';
  } catch (e) { /* file:// 或离线时静默 */ }
}

async function doSync() {
  if (!settings.sync) settings.sync = DEFAULT_SYNC;
  try {
    const r = await fetch(settings.sync + (settings.sync.includes('?') ? '&' : '?') + 't=' + Date.now());
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const j = await r.json();
    const days = j.days || j;
    const st = (j.meta && j.meta.start) || Object.keys(days).sort()[0];
    if (st !== state.start) { toast(`远端是 ${st} 的数据，与当前周期不一致`); return; }
    Object.keys(days).forEach((k) => {
      const v = days[k];
      state.days[k] = (typeof v === 'string') ? { text: v, work: !!v, note: '' } : v;
    });
    savePeriod(); draw(); toast('同步完成');
  } catch (e) { toast('同步失败：' + e.message); }
}

function doExport() {
  const payload = { meta: { start: state.start, end: state.end, title: '工作日程日历' }, days: state.days };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `daily_${state.start}_${state.end}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
  toast('已导出 daily.json');
}

/* ---------------- 交互绑定 ---------------- */
function bind() {
  $('monthPick').value = currentMonthVal();
  $('monthPick').addEventListener('change', () => { render(); });

  $('btnDrop').onclick = () => $('fileInput').click();
  $('dropzone').onclick = (e) => { if (e.target !== $('fileInput')) $('fileInput').click(); };
  $('fileInput').addEventListener('change', (e) => onFile(e.target.files[0]));
  ['dragenter', 'dragover'].forEach((ev) => $('dropzone').addEventListener(ev, (e) => {
    e.preventDefault(); $('dropzone').classList.add('over');
  }));
  ['dragleave', 'drop'].forEach((ev) => $('dropzone').addEventListener(ev, (e) => {
    e.preventDefault(); $('dropzone').classList.remove('over');
  }));
  $('dropzone').addEventListener('drop', (e) => { if (e.dataTransfer.files[0]) onFile(e.dataTransfer.files[0]); });
  window.addEventListener('dragover', (e) => e.preventDefault());
  window.addEventListener('drop', (e) => {
    e.preventDefault();
    if (e.dataTransfer.files[0]) onFile(e.dataTransfer.files[0]);
  });

  $('btnAI').onclick = runAI;
  $('btnSync').onclick = doSync;
  $('btnExport').onclick = doExport;

  $('btnSettings').onclick = () => {
    $('setMe').value = settings.me; $('setApi').value = settings.api;
    $('setModel').value = settings.model; $('setKey').value = settings.key;
    $('setSync').value = settings.sync; $('settings').classList.add('show');
  };
  $('setSave').onclick = () => {
    settings.me = $('setMe').value.trim(); settings.api = $('setApi').value.trim();
    settings.model = $('setModel').value.trim() || 'deepseek-chat';
    settings.key = $('setKey').value.trim(); settings.sync = $('setSync').value.trim();
    saveSettings(); $('settings').classList.remove('show'); toast('设置已保存');
  };
  $('setClear').onclick = () => {
    if (!confirm('清空当前周期的全部内容？')) return;
    state.days = {}; savePeriod(); draw();
    $('settings').classList.remove('show'); toast('已清空');
  };
  document.querySelectorAll('.modal').forEach((m) => {
    m.addEventListener('click', (e) => { if (e.target === m) m.classList.remove('show'); });
  });
}

/* ---------------- 启动 ---------------- */
loadSettings();
bind();
render();
