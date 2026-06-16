# 智能催收助手 · Release Notes

**版本：** v1.0.0（封板）  
**日期：** 2026-06-15  
**项目路径：** `loan-dashboard-demo/`

---

## 概述

企业金融风格的贷款逾期催收智能看板 Demo。纯前端（HTML / CSS / JavaScript）+ 本地静态服务，无 Node / Python 运行时依赖。规则引擎负责评分与分类，可选 LongCat-2.0-Preview 增强话术与后续对话。

---

## 快速启动

```bat
# 双击或在项目目录运行
start-server.bat
```

浏览器访问：**http://127.0.0.1:8765**

可选：设置环境变量后重启服务，供 LongCat 代理使用：

```bat
set LONGCAT_API_KEY=你的密钥
start-server.bat
```

也可在页面右上角 **API 设置** 中配置 Key，并勾选「通过本地代理 `/api/longcat`」。

> 请勿将 API Key 写入代码或提交到版本库。

---

## 本版本功能

### 合同管理

- 左侧逾期合同列表：搜索（姓名 / 合同号）、风险等级筛选、排序（逾期天数 / 风险评分 / 金额）
- 25 笔 mock 合同，含随机客户画像与沟通历史
- 顶部合同摘要：合同号、客户姓名、逾期天数、**逾期金额**、贷款金额、风险评分、上次沟通、还款意愿、投诉倾向、逾期原因、半圆风险仪表盘

### 规则引擎

- 7 条催收意图规则（`mock-data/collection_rules.yaml`）
- 关键词匹配 → 风险评分变化 → 建议行动类别
- 行动类别加权选取（结合逾期天数）

### 逾期原因标签（v1.1）

- 36 条标签（`mock-data/overdue_reason_tags.yaml`）
- 源字典：`yuqi_reason_tags_merged_v1_1_with_flag.md`
- DPD 过滤、关键词实时匹配、按职业权重分配默认原因
- 命中标签时话术按 **开场 / 共情 / 引导** 三层展示

### AI 对话模式

| 轮次 | 行为 |
|------|------|
| **首轮**（每合同首次提问） | 弹出三列 **分析信息卡**（规则引擎 / 客户特征 / 催收话术） |
| **后续轮次** | 基于合同信息与对话历史的 **自然语言** 回复 |
| 切换合同 / 清空对话 | 重新从首轮信息卡开始 |

- 未配置 LongCat：首轮与后续均使用本地规则引擎结果
- 已配置 LongCat：首轮增强话术与建议行动；后续多轮对话

### LongCat 集成

- 固定模型：**LongCat-2.0-Preview**（不可切换）
- 本地代理：`server.ps1` 转发至 `/api/longcat/v1/chat/completions`
- UTF-8 请求体，修复中文乱码

### 离线回退

- `file://` 或 fetch 失败时，使用 `yamlFallback.js` + `mockDataBundle.js` 内嵌数据

---

## 架构

```
mock-data/*.yaml
    ↓
contractGenerator → dataLayer → ruleEngine ─┐
                         ↑                  │
              reasonTagEngine ──────────────┤
                                            ↓
                                    aiService → longcatClient（可选）
                                            ↓
                                         ui.js
```

| 模块 | 文件 | 职责 |
|------|------|------|
| 启动 | `app.js` | 初始化、对话路由 |
| 数据层 | `js/dataLayer.js` | 合同存储与选中状态 |
| 合同生成 | `js/contractGenerator.js` | Mock 合同、逾期金额计算 |
| 规则引擎 | `js/ruleEngine.js` | 意图匹配、评分、结构化输出 |
| 原因标签 | `js/reasonTagEngine.js` | DPD 过滤、标签匹配、三层话术 |
| AI 服务 | `js/aiService.js` | 首轮信息卡 / 后续对话分流 |
| LongCat | `js/longcatClient.js` | API 客户端、增强与多轮对话 |
| UI | `js/ui.js` | 渲染与交互 |
| 本地服务 | `server.ps1` | 静态资源 + API 代理 |

---

## 配置与数据文件

| 路径 | 说明 |
|------|------|
| `mock-data/dataset_rules.yaml` | 合同数量、客户名、画像、mock 规则 |
| `mock-data/collection_rules.yaml` | 催收意图、关键词、话术模板 |
| `mock-data/overdue_reason_tags.yaml` | 逾期原因标签（由 md 生成） |
| `js/longcatConfig.js` | LongCat 模型与连接配置 |

### 重新生成逾期原因 YAML

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File tools\md-to-reason-tags.ps1
```

### 更新离线回退（可选）

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File tools\inject-reason-tags-fallback.ps1
```

---

## 封板前回归清单

- [ ] 顶部状态：`规则 7 条 · 逾期原因标签 36 条`
- [ ] 选择合同后摘要区显示逾期原因、逾期金额
- [ ] 首次提问 → 三列分析信息卡
- [ ] 继续追问 → 自然语言气泡（非信息卡）
- [ ] 输入「工资拖欠」等关键词 → 三层话术 + 逾期原因匹配
- [ ] 切换合同 → 对话清空，再次首轮出卡
- [ ] LongCat 开启时话术增强；关闭时使用本地规则

---

## 已知限制

- YAML 解析器为精简实现，仅支持本项目 mock 数据结构
- LongCat 直连可能超时，推荐使用本地 `server.ps1` 代理
- 逾期金额为 mock 估算（月供 × 逾期期数 + 罚息），非真实账务
- 合同数据刷新页面后重新生成（除风险评分在会话内持久于内存）

---

## 目录结构

```
loan-dashboard-demo/
├── index.html
├── app.js
├── style.css
├── start-server.bat
├── server.ps1
├── RELEASE.md
├── yuqi_reason_tags_merged_v1_1_with_flag.md
├── mock-data/
│   ├── dataset_rules.yaml
│   ├── collection_rules.yaml
│   └── overdue_reason_tags.yaml
├── js/
│   ├── yamlLoader.js
│   ├── yamlFallback.js
│   ├── mockDataBundle.js
│   ├── overdueReasonTagsBundle.js
│   ├── contractGenerator.js
│   ├── dataLayer.js
│   ├── reasonTagEngine.js
│   ├── ruleEngine.js
│   ├── actionCategoryPicker.js
│   ├── aiService.js
│   ├── longcatConfig.js
│   ├── longcatClient.js
│   └── ui.js
└── tools/
    ├── md-to-reason-tags.ps1
    ├── inject-reason-tags-fallback.ps1
    └── generate-overdue-bundle.js
```

See **[DEPLOY.md](./DEPLOY.md)** for Vercel and GitHub Pages instructions.

---

## 变更摘要（v1.0.0）

- 企业金融 UI：顶栏、合同列表、摘要区、三列一体分析卡
- LongCat-2.0-Preview 集成与本地代理
- 逾期原因标签字典 v1.1 全链路接入
- 合同摘要新增逾期金额
- 首轮信息卡 + 后续自然语言对话
- YamlLoader 修复 `tags:` / `rules:` 列表解析
- 话术 JSON 清洗与三层展示
- 还款意愿 / 投诉倾向移至摘要区

---

**封板声明：** v1.0.0 起不再新增功能，仅接受缺陷修复。
