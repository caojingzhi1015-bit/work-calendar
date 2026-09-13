# 工作日程日历 · Work Calendar

把微信聊天记录变成一张「每月 16 日 ~ 次月 15 日」的工作日历。纯静态单页应用，无后端、无构建，打开即用。

- **在线地址**：https://caojingzhi1015-bit.github.io/work-calendar/
- **仓库**：https://github.com/caojingzhi1015-bit/work-calendar

手机浏览器打开后「添加到主屏幕」即可当 App 用；Windows 桌面可用仓库里的快捷方式入口。

## 能做什么

| 功能 | 说明 |
| --- | --- |
| 输入日期自动生成日历 | 选年月 → 自动算出 16 日 ~ 次月 15 日，首格固定是 16 号，7 列顺序排，多余格子不画 |
| 拖入聊天记录自动整理 | 把微信导出的 `.txt` 拖进页面 → 自动按日解析 → 逐日粗填 ≤20 字事项 |
| AI 归纳（可选） | 填 OpenAI 兼容接口（默认 DeepSeek）+ Key → 一键把每天的聊天归纳成 ≤20 字，不出现人名 |
| 记工时标记 | 自动识别「记工时 / 值守 / 周末算工作日」等原话，深蓝色标注并写进备注 |
| **长按删除** | 手机长按 / 桌面长按某格 0.5 秒 → 水滴形确认弹窗 → 删除；也可点格子右上角的 ×，或桌面端右键 |
| **上一步（多步撤销）** | 顶栏「↩ 上一步」按钮带剩余步数，或按 `Ctrl/⌘ + Z`。删除 / 编辑 / 导入 / AI 归纳 / 同步 / 清空全部可逐步回退，最多 40 步，换周期也能退回去 |
| 出勤统计 | 顶部实时显示出勤天数与统计区间 |
| 点格编辑 | 点任意格子改事项 / 勾选记工时 / 写备注，还能看到当天聊天原文 |
| 同步 WorkBuddy ↔ GitHub | 顶栏「同步」从 GitHub raw 拉最新 `daily.json`；改动用「导出」交回 WorkBuddy push |
| 白/深主题 + 动态背景 | 默认白色，顶栏 ☾/☀ 切主题，◐ 开关视频背景，偏好记在本机 |
| 导入导出 | 导出 `daily.json`，也可直接拖入 json 覆盖 |
| 一键截图 | 顶栏「截图」用 Canvas 把「出勤天数 + 日历表」绘成 PNG 直接下载（纯前端、离线可用，不依赖第三方库） |
| PWA | 手机「添加到主屏幕」，有独立图标、离线可用 |

## 怎么用

**方式一 · 直接在网页里做**

1. 打开页面，选好周期（默认当前所在的 16–15 周期）
2. 把微信聊天记录导出的 `.txt` 拖到页面上的虚线框
3. 弹出的预览里可以逐条修改，点「填入日历」
4. 想更准就填个 AI Key，点「AI 归纳」

**方式二 · 让 WorkBuddy 整理后同步**

1. 在 WorkBuddy 里跑 `wechat-monthly-calendar` 技能，产出 `data/daily.json`
2. push 到本仓库 → GitHub Actions 自动部署（约 30 秒上线）
3. 网页点「同步」，拉 `data/daily.json` 覆盖当前周期

默认同步地址已内置为
`https://raw.githubusercontent.com/caojingzhi1015-bit/work-calendar/main/data/daily.json`
（设置里可改成自己的 raw 链接）。

## 部署

仓库已配置 `.github/workflows/pages.yml`：push 到 `main` 即自动打包部署到 GitHub Pages，
不经过 Jekyll（根目录有 `.nojekyll`）。手动触发：仓库 → Actions → Deploy to GitHub Pages → Run workflow。

## 微信聊天记录怎么导出

微信 4.1.13+ 支持「转发到其他应用」：在会话里拖选消息 → 转发 → 转发到其他应用 → 选 WorkBuddy。
一次可以转发整月，不受 100 条限制。WorkBuddy 收到的 `聊天记录.txt` 格式如下，页面解析器按这个格式识别：

```
    ·纸盒                    ← 发送人
    2026年8月16日 11:44      ← 日期行
    正文内容
```

## 本地开发

```bash
# 起个静态服务看效果（任选其一）
python3 -m http.server 8000
npx serve .
```

目录结构：

```
.
├─ index.html          页面
├─ app.js              全部逻辑（解析 / 归纳 / 渲染 / 同步）
├─ style.css
├─ data/daily.json     当前周期数据（同步源，WorkBuddy 会更新它）
├─ manifest.webmanifest / sw.js / icon.svg   PWA
├─ scripts/            Node 侧脚本（渲染静态版、发布、冒烟测试）
├─ output/             静态版日历产物（可打印/存档）
└─ inbox/              聊天记录原始文件
```

## 数据存在哪

- 每个周期的编辑结果存在浏览器 `localStorage`（键名 `wbcal:data:<起始日>`），换设备不会丢但换浏览器会
- AI Key 只存在本机，不会上传
- 想长期保存就点「导出」，把 `daily.json` 提交回仓库
