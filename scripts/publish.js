#!/usr/bin/env node
/**
 * publish.js — 把最新渲染结果同步为「工作台」入口
 *   1) output/calendar_<start>_<end>.html  ->  output/index.html（发布/手机访问用）
 *   2) 复制一份到 Windows 桌面：工作日历.html（双击即开，离线可用）
 *
 * 用法: node publish.js [可选: 桌面开关 on/off，默认 on]
 */
const fs = require('fs');
const path = require('path');
const os = require('os');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'output');

function main() {
  const files = fs.readdirSync(OUT)
    .filter((f) => /^calendar_.+\.html$/.test(f))
    .sort();
  if (!files.length) { console.error('output 下没有日历文件，先跑 render_calendar.js'); process.exit(1); }
  const latest = files[files.length - 1];
  const src = path.join(OUT, latest);

  // 1) index.html
  const idx = path.join(OUT, 'index.html');
  fs.copyFileSync(src, idx);
  console.log('index.html  <- ' + latest);

  // 2) 桌面副本
  if (process.argv[2] === 'off') return;
  const home = os.homedir();
  const cands = [
    path.join(home, 'Desktop'),
    path.join(home, 'OneDrive', 'Desktop'),
    path.join(home, 'OneDrive - 个人', 'Desktop'),
    path.join(home, 'Documents', 'Desktop')
  ];
  const desk = cands.find((p) => fs.existsSync(p));
  if (!desk) { console.log('未找到桌面目录，跳过'); return; }
  const target = path.join(desk, '工作日历.html');
  fs.copyFileSync(src, target);
  console.log('桌面副本    -> ' + target);
}

main();
