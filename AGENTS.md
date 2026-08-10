# frontend-showcase 项目规则

## 定位

爬虫展示案例：政采公告自动采集（Python 采集层）+ 过程重演网页（前端展示层）。用于向小企业主/个体户客户展示爬虫能力。

## 目录约定

- `scripts/` — 所有采集脚本（Python）：`crawler.py` / `config.json` / `requirements.txt`。脚本基于自身目录定位配置，输出默认 `output/`（项目根）。
- `crawler-showcase/` — 前端（Vite 项目），构建产物 `crawler-showcase/dist/` 用于部署。**命名例外**：本目录是 frontend-showcase 的业务子目录（爬虫案例），不受根规则 `frontend-` 顶层前缀约束（顶层目录已满足 `frontend-showcase`）。
- `output/` — 采集运行产物（Excel/CSV/摘要）。

## 前端技术栈（统一规则）

- 前端一律 **Node.js + React + Vite + TypeScript**（React 19 / Vite 8，与 frontend-homepage 对齐）。
- 前端代码位于 `crawler-showcase/`，构建产物 `crawler-showcase/dist/` 用于部署。
- **开发端口 6002**（前端端口规则：6001 起固定 +1 分配，见根 AGENTS.md；已配置 `strictPort`）。
- `events.json` 由 `python scripts/crawler.py --export-events crawler-showcase/public/events.json` 生成，是重演页的数据源。
- 禁止手写原生 HTML/JS 页面；功能改动先改 React 组件。

## 采集层

- Python 3.10+，requests + BeautifulSoup + openpyxl。
- 数据源：中国政府采购网中央公告（公开信息，无登录、无个人信息）。
- 合规：仅公开数据、低频访问（delay ≥ 1s）、不采集个人信息、不转售数据。

## 验证

- 采集层：`python scripts/crawler.py`（重跑验证增量去重）。
- 前端：`npm run build`（类型检查 + 构建；dev 服务由用户自行启动）。
