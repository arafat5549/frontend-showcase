# frontend-showcase — 爬虫展示案例（政采公告自动采集）

> 一句话：自动抓取「中国政府采购网 · 中央公告」公开列表页，解析出 **标题 / 公告类型 / 发布时间 / 地域 / 采购人 / 链接**，去重合并后输出 **Excel 报表 + CSV + 采集摘要**。
>
> 演示能力：requests 抓取 → BeautifulSoup 解析 → 数据清洗去重 → 结构化报表交付（Scrapy/Playwright 可扩展）。

## 为什么选这个数据源

| 标准 | 说明 |
|------|------|
| 公开 | 政府公开信息，无需登录、无验证码、无个人信息 |
| 合规 | 纯公开数据，不涉及《个人信息保护法》管辖内容 |
| 客户价值直接 | 小企业主/个体户找生意机会（标讯监控）是刚需，市面上"标讯通"类产品就是这个模式 |
| 稳定 | 国家级站点，长期在线，解析结构清晰 |

**对客户的讲法**：你的同行每天花 1 小时手动翻网页找招标信息，写个爬虫每天自动跑一遍，打开 Excel 就能看到今天的项目、采购人和链接——这就是本案例演示的事情。

## 运行

```bash
pip install -r scripts/requirements.txt
python scripts/crawler.py                    # 默认抓 1 页（配置在 scripts/config.json）
python scripts/crawler.py --pages 2          # 抓 2 页（翻页自动停止）
python scripts/crawler.py --limit 5          # 最多采 5 条（数据量自定义）
python scripts/crawler.py --delay 1.5        # 访问间隔 1.5 秒（保持低频礼貌）
```

> 所有采集脚本统一在 `scripts/` 目录；输出默认写入 `output/`。脚本基于自身目录定位配置，任意 cwd 可运行。

## 产出物（output/）

- `政采公告_中央.xlsx` — 带表头样式/冻结首行/自动筛选的 Excel 报表（客户最常要的交付形态）
- `政采公告_中央.csv` — 通用结构化数据（utf-8-sig，Excel 直接打开不乱码）
- `采集摘要.txt` — 按公告类型/地域分布统计 + 最近条目

重复运行按**链接去重**，新增条目追加在前——这就是"定时增量采集"的基础。

## 网页过程重演（给客户看的可视化演示）

把一次真实爬取过程做成**Win11 桌面场景动画网页**（本机壁纸 + PowerShell 跑爬虫 + Excel 打开报表 + 任务栏）：请求 → 解析 → 数据逐条滚入 Excel → 生成报表，逐步重演。
前端技术栈：**Node.js + React 19 + Vite 8 + TypeScript**（与名片主页统一，见 AGENTS.md）。

```bash
# 1. 导出过程事件流（真实爬取记录，生成 crawler-showcase/public/events.json）
python scripts/crawler.py --export-events crawler-showcase/public/events.json

# 2. 前端运行（crawler-showcase/ 目录下，端口 6002）
npm install
npm run dev        # 开发预览（用户自行启动）
npm run build      # 类型检查 + 生产构建 → crawler-showcase/dist/
npm run preview    # 预览构建产物
```

部署：`crawler-showcase/dist/` 即静态站点（`base: './'`，可部署到任意子路径，如 GitHub Pages `/crawler-showcase/`）。

页面功能：播放/暂停/重播、1x/2x/4x 速度、**条数可选（全部/10/5 条）**、跳过动画直接看结果；纯静态、无外部依赖（事件流 JSON + React 单页）。

**演示要点**：数据是真实抓取的（事件流由 `--export-events` 记录），页面只重演动画——"爬虫怎么工作的"一目了然，适合当面给客户播。

## 合规说明（可原样放进演示材料）

- 仅采集**公开信息**，不抓登录后内容、不采集个人信息
- 低频访问（默认间隔 ≥1 秒），不冲击目标站点
- 数据仅用于演示与客户交付，不转售原始数据
- 遵守站点 robots 与访问频率要求，站点结构变更时停用而非硬闯

## 技术栈与可扩展方向

- 现状：requests + BeautifulSoup + openpyxl（零框架，演示"最小闭环"）
- 生产化：Scrapy 分布式多源采集、Playwright 处理 JS 渲染/复杂反爬、关键词订阅推送、定时任务（Windows 计划任务 / cron）
- 换源：改 `config.json` 的 `list_url` + `parse_items()` 里的选择器即可

## 目录结构

```
frontend-showcase/
├── scripts/            ← 所有采集脚本（Python）
│   ├── crawler.py          ← 主程序（抓取→解析→去重→报表；--export-events 记录过程）
│   ├── config.json         ← 源/频率/输出配置
│   └── requirements.txt
├── crawler-showcase/   ← 过程重演页（React 19 + Vite 8 + TS，Win11 桌面场景动画，端口 6002）
│   ├── package.json / vite.config.ts / tsconfig.json
│   ├── public/events.json   ← 由 --export-events 生成的事件流（真数据）
│   ├── src/                 ← App.tsx / useReplay.ts / style.css / assets/wallpaper.jpg
│   └── dist/                ← npm run build 产物（可部署）
├── output/             ← 运行产物（Excel/CSV/摘要）
├── AGENTS.md           ← 项目规则（技术栈/合规/验证）
└── README.md
```
