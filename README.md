# frontend-showcase — 个人 IP 技术展示案例集合

> 面向客户/访客的**可演示案例集合**，每个案例独立成子项目、共用统一技术栈（Node.js + React 19 + Vite 8 + TypeScript），部署为 GitHub Pages 单站（子路径分案例）。

| 案例 | 目录 | 演示内容 | 在线地址 |
|---|---|---|---|
| 爬虫案例 | `crawler-showcase/` | 政采公告自动采集：真实爬取 → Excel 报表，Win11 桌面场景过程重演 | `/frontend-showcase/` |
| 方块世界 | `minecraft-demo/` | 3D 体素世界：小人自动建造房子 + 玩小天才手表（场景梗） | `/frontend-showcase/minecraft-demo/` |

---

## 案例一 · 爬虫展示（政采公告自动采集）

自动抓取「中国政府采购网 · 中央公告」公开列表页，解析出 **标题 / 公告类型 / 发布时间 / 地域 / 采购人 / 链接**，去重合并后输出 **Excel 报表 + CSV + 采集摘要**。

### 为什么选这个数据源

| 标准 | 说明 |
|------|------|
| 公开 | 政府公开信息，无需登录、无验证码、无个人信息 |
| 合规 | 纯公开数据，不涉及《个人信息保护法》管辖内容 |
| 客户价值直接 | 小企业主/个体户找生意机会（标讯监控）是刚需，对标"标讯通"类产品 |
| 稳定 | 国家级站点，长期在线，解析结构清晰 |

**对客户的讲法**：你的同行每天花 1 小时手动翻网页找招标信息，写个爬虫每天自动跑一遍，打开 Excel 就能看到今天的项目、采购人和链接——这就是本案例演示的事情。

### 根据真实案例改编

本 demo 改编自真实业务需求：**某建材供应商老板每天花 1 小时在多个招标网站手动翻找商机，漏看即错过投标窗口**。改为爬虫自动采集后，每天打开 Excel 报表即可筛选当天项目、直接点链接跟进。

为演示脱敏：采集源为公开渠道（中国政府采购网），业务细节已泛化处理；重演页开场即标注"根据真实案例改编"，数据为真实采集的公开信息。

### 采集脚本（scripts/）

```bash
pip install -r scripts/requirements.txt
python scripts/crawler.py                     # 默认抓 1 页（配置在 scripts/config.json）
python scripts/crawler.py --pages 2           # 抓 2 页（翻页自动停止）
python scripts/crawler.py --limit 100         # 最多采 100 条（数据量自定义）
python scripts/crawler.py --delay 1.5         # 访问间隔 1.5 秒（保持低频礼貌）
python scripts/crawler.py --export-events crawler-showcase/public/events.json
                                              # 导出过程事件流（重演页数据源）
```

脚本基于自身目录定位配置，任意 cwd 可运行；输出默认写入 `output/`。

### 产出物（output/）

- `政采公告_中央.xlsx` — 带表头样式/冻结首行/自动筛选的 Excel 报表（客户交付形态）
- `政采公告_中央.csv` — 通用结构化数据（utf-8-sig，Excel 直接打开不乱码）
- `采集摘要.txt` — 按公告类型/地域分布统计 + 最近条目

重复运行按**链接去重**，新增条目追加在前——"定时增量采集"的基础。

### 网页过程重演（crawler-showcase/，端口 6002）

**Win11 桌面场景动画**：本机壁纸 + PowerShell 跑爬虫 + Excel 打开报表 + 任务栏（真实时钟），重演一次真实爬取：请求 → 解析 → 数据逐条滚入 Excel → 生成报表。

- 数据是**真实抓取**的（`--export-events` 记录事件流，当前 100 条 / 全量 56,785 条）
- 功能：自动播放、暂停/重播、1x/2x/4x、条数（全部/10/5）、跳过看结果
- `prefers-reduced-motion` 自动降级为直接显示结果

```bash
# 前端运行（crawler-showcase/ 目录下）
npm install
npm run dev        # http://localhost:6002
npm run build      # 类型检查 + 生产构建 → dist/
```

---

## 案例二 · 方块世界（minecraft-demo/，端口 6003）

**3D 体素世界**（Three.js 程序化生成，零外部资源），单页连续演出两场景：

1. **自动建造**（约 23s）：Steve 风方块小人绕工地行走，逐块放置 **110 块体素蓝图**（灰石地基 → 原木墙 → 木门/玻璃窗 → 红瓦屋顶），每块从天而降 + 弹性落地
2. **玩小天才手表**（约 10s）：建造完成，小人抬起左手腕的小天才手表看消息 → 橙色小人绕行而来 **并排举表** → 表盘双双闪绿"碰一碰加好友" → 双人蹦跳收尾

**远景**：高度图地形（fbm 噪声 + 距离衰减 + 按高度分带着色 沙/草/石/雪）+ 渐变天空 + FogExp2 指数雾（地平线无缝）+ 方块太阳对齐光照。

- 功能：自动播放、暂停/重播、1x/2x/4x、场景跳转（建造/玩手表）、跳过看结果
- 交互：拖拽旋转视角（自动环绕，交互后停止）、滚轮缩放
- 无穿模：人物路径绕行禁区、关节 pivot 位于肩/髋、站位射线外推

```bash
cd minecraft-demo
npm install
npm run dev        # http://localhost:6003
npm run build      # 类型检查 + 生产构建 → dist/
```

---

## 开发约定

- **技术栈统一**：全部子项目 Node.js + React + Vite + TypeScript，版本与 frontend-homepage 对齐（React 19 / Vite 8），见根 `AGENTS.md`
- **端口规则**：6001 起固定 +1（crawler-showcase=6002、minecraft-demo=6003），`strictPort: true`
- **代理规则**：代理只跑 `npm run build` 验证，不启动 dev、默认不推送（用户本地确认后再推）
- **视觉语言**：爬虫案例 = Win11 桌面仿真；方块世界 = Minecraft 体素风；两者独立自成风格

## 部署（GitHub Pages）

仓库 `arafat5549/frontend-showcase`，`.github/workflows/pages.yml` 在 push 时自动构建两个子项目并**合并部署**：

```
crawler-showcase/dist/*  →  /frontend-showcase/            （爬虫重演页，站点首页）
minecraft-demo/dist/*    →  /frontend-showcase/minecraft-demo/
```

- https://arafat5549.github.io/frontend-showcase/
- https://arafat5549.github.io/frontend-showcase/minecraft-demo/

## 合规说明（可原样放进演示材料）

- 仅采集**公开信息**，不抓登录后内容、不采集个人信息
- 低频访问（默认间隔 ≥1 秒），不冲击目标站点
- 数据仅用于演示与客户交付，不转售原始数据
- 遵守站点 robots 与访问频率要求，站点结构变更时停用而非硬闯

## 目录结构

```
frontend-showcase/
├── scripts/              ← 采集脚本（Python）
│   ├── crawler.py            ← 抓取→解析→去重→报表；--export-events 记录过程
│   ├── config.json           ← 源/频率/输出配置（含 total_count 全量数）
│   └── requirements.txt
├── crawler-showcase/     ← 案例一前端（Win11 桌面场景重演页，6002）
│   ├── public/events.json    ← 事件流数据（--export-events 生成）
│   ├── src/                  ← App.tsx / useReplay.ts / style.css / assets/wallpaper.jpg
│   └── dist/                 ← 构建产物
├── minecraft-demo/       ← 案例二前端（3D 体素方块世界，6003）
│   ├── src/                  ← world.ts（地形/天空/远景）/ sim.ts（编排）/ player.ts / blueprint.ts
│   └── dist/                 ← 构建产物
├── output/               ← 采集运行产物（Excel/CSV/摘要）
├── .github/workflows/pages.yml  ← 双案例合并部署
├── AGENTS.md             ← 项目规则（技术栈/端口/合规/验证）
└── README.md
```
