# 数据源与数据获取 — 调研结论

> wayfinder 票「调研：数据源与数据获取」resolution。日期 2026-08-10，全部 URL 实测。
> ✅=实测可用 ⚠️=实测受限 🔶=推断

## 1. DataV.GeoAtlas 行政区划 GeoJSON（全部实测可用）

| 模式 | 含义 |
|---|---|
| `https://geo.datav.aliyun.com/areas_v3/bound/{adcode}_full.json` | 含下级行政区完整边界（市级→区县） |
| `https://geo.datav.aliyun.com/areas_v3/bound/{adcode}.json` | 仅本级边界 |

实测：福州 `350100_full.json` ~120KB（13 区县）、福建 `350000_full.json` ~114KB（9 市）、杭州 `330100_full.json` ~108KB。

字段：`properties.adcode / name / center / centroid / childrenNum / level / parent / acroutes`，geometry 为已简化 MultiPolygon，前端可直接渲染。

许可：官方无明确许可声明 🔶；社区长期免费用于演示/商业大屏，演示场景无风险，建议标注「数据来源：阿里云 DataV.GeoAtlas」。

## 2. 统计指标数据源

- **国家统计局 API** `data.stats.gov.cn/easyquery.htm`：⚠️ 实测 403（WAF UrlACL 按 IP 信誉拦截）；参数规律已知（dbcode: hgnd/hgyd/hgjd/fsnd，wds 指标编码 A0101=GDP 等），但需完整浏览器头 + cookie，程序化获取有不确定性。
- **福建省统计局** `tjj.fujian.gov.cn`：✅ 可用。2025 公报 HTML（2026-03 发布，GDP 60199.45 亿、人口 4190 万、城镇化率 72.58%）。
- **福州市统计局** `tjj.fuzhou.gov.cn`：✅ 可用。2025 公报（2026-04 发布：GDP 15112.32 亿 +5.6%、人口 852.1 万、城镇化率 74.63%、人均可支配收入 54007 元）。⚠️ 月度数据是图片（需 OCR）；年鉴在线版 ✅。
- **开放数据平台**：福建省平台存在但 API 不公开稳定 🔶；福州无市级平台 ❌；杭州/深圳/浙江平台需注册申请 ❌。

## 3. 候选城市对比

- **福州**（推荐）：公报/年鉴免登录直抓、2026 年更新、客户代入感强。月度数据为图片是唯一短板。
- **杭州/深圳**：开放 API 生态好但全部注册制，不适合无人值守脚本。

## 4. 推荐组合与获取要点

```
行政区数据：DataV.GeoAtlas 免登录直链 GeoJSON（无需转换）
统计指标  ：福州市统计局 2025 统计公报（HTML 解析）
           + 福建省统计局公报（省级对照）
           + 福州统计年鉴在线版（补充细分）
           + 国家统计局 API（可选，需处理 WAF）
```

要点：requests+BeautifulSoup 解析 HTML 表格 → 清洗为静态 JSON（复用 crawler 模式）；月度图片需 OCR 为风险点，降级用年度公报+省级月度文字页；合规：仅公开数据、delay≥1s、标注来源。

## 5. 关键风险

- ⚠️ 国家统计局 API 403（IP 信誉拦截）
- ⚠️ 福州月度数据为图片（需 OCR）
- ⚠️ 所有开放数据平台均需注册
- ✅ GeoAtlas 与省/市统计局公报为零门槛直抓源
