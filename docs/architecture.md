# 架构与数据契约

当前优先级见 [README](../README.md)，操作边界见 [AGENTS.md](../AGENTS.md)。本文维护应用责任、数据流和已知限制；字段、配置值和接口参数以对应源码及测试为准。

## 系统全景

```text
Futu / AWTMT
    → ingest-worker
    → data/news/<source>_<time>.json
    → graph-worker → Neo4j
                   ↘ 消费位点 / 失败记录
    → web-app ← web-scheduler（HTTP 调度）
    → 完整简报持久化
    → 钉钉“牛长婷”单聊：原生 Markdown 快讯 + H5 完整详情
```

Drudge 有三个应用包、四个 PM2 进程，全部业务留在 Tide。101 是共享 HTTP 入口，不运行 Drudge 的采集、数据库或 Web 业务。部署位置只在[部署手册](deployment.md)维护。

## 应用责任

| 应用                      | 拥有的行为                                                              | 不承担的行为                            |
| ------------------------- | ----------------------------------------------------------------------- | --------------------------------------- |
| ingest-worker             | 两个来源拉取、源内去重、规范化、文件落盘、采集状态与异常告警            | AI 抽取、图谱写入、业务总结             |
| graph-worker              | 消费文件、抽取实体/事件/关系、写 Neo4j、失败重试、图查询                | 原始源抓取、用户简报展示                |
| web-app                   | 工作台、直接查询 Neo4j、Level 1 扫描、总结编排、简报存储/展示、主动投递 | 原始源抓取                              |
| web-scheduler（Web 包内） | 独立进程按北京时间调用 Web 调度 API                                     | 不直接承载总结逻辑，不嵌入 Next.js 进程 |
| shared/common（库）       | 配置加载、时区、枚举、跨包 LLM 和通知辅助                               | 不独立运行，不作为通用业务平台          |

只有 `futu_live`（富途）和 `awtmt_live`（AWTMT / 华尔街见闻）是已接入来源；没有独立 WSJ /《华尔街日报》采集器。两个 worker 的异常告警 Webhook 与 Web 主动单聊推送是不同通道。

## 新闻与消费契约

### 原始记录

新闻文件当前是 JSON 数组，核心字段为 `id`、`title`、`content`、`source`、`time`；来源提供时保留 `url`、`author`、`category`、`summary`。不要编造来源缺失字段。

Graph 只扫描 `futu_live_*.json` 与 `awtmt_live_*.json`，优先处理修改时间较新的文件。输入兼容含 `data`、`list` 或 `news` 数组的对象，但不是新增平行格式的理由。

### 位点与失败

`data/news/x.json` 对应 `data/news/.processed/x.json.processed`。位点修改时间不早于原文件时才视为已处理；删除位点或修改原文件会触发重放。

当前文件级判定是成功数大于失败数时标记整份文件。失败记录保留原条目和错误证据，默认位于 `data/news/failed/`；单条重试成功后才删除对应失败记录。位点和失败文件都不能当缓存清理。

2026-09-19 起，逐条 AI 抽取每次只尝试一次，SDK 不再隐式重试；千问显式使用
JSON 输出模式，避免旧 SDK 把已有 JSON 正文误判为“未调用工具”。失败条目进入
既有失败目录后，自动批处理根据完整新闻 ID 跳过，进程重启也从原失败文件名恢复
该判断；同一进程内重叠批次的同一新闻共用在途请求。失败记录不会被标记为图谱
成功，也不清理或自动重放旧记录；既有失败重试 CLI 仍允许显式人工重试。

配置 `GRAPH_AI_FALLBACK_PROVIDER=none` 可明确关闭图谱备用模型（空字符串仍沿用
共享默认值，因此不能用留空表达禁用）。成功调用及 API 提供的失败用量在 info
日志记录模型和 Token 数，不记录输入正文；超时会中止在途模型请求。当前生产模型
与开关以[部署记录](deployment.md)为准。

### 本地优先与云端切换

2026-09-19 用户要求优先使用 Windows 已部署的 Ollama `qwen3.5:9b`，质量合格后启用。
设置 `LOCAL_AI_BASE_URL` 后支持本地优先；留空维持云端。可用
`GRAPH_LOCAL_AI_*` / `WEB_LOCAL_AI_*` 分别覆盖。Web 默认
`WEB_LOCAL_AI_ONLY_SIMPLE=true`，只让简单任务（当前为实体历史摘要）使用本地，
最终 Markdown 仍用云端；只有对应质量验证通过后才应关闭此限制。现有
`AI_PROVIDER`、`WEB_AI_PROVIDER`、`SIMPLE_AI_PROVIDER` 继续指定云端模型。

业务代码只请求 `/api/tags` 与 `/api/chat`，不执行 SSH、桌面启动脚本、WSL 或服务
启动命令。桌面手动停止使模型服务不可用，后续任务转云端；不会为了处理新闻把服务
重新拉起。用户再次手动启动后，下一次可用性检查恢复本地，离线检查有 5 秒冷却。
空闲卸载只卸载权重，服务仍可接受推理，和手动停止有不同含义。

本地请求每个应用进程串行，非思考、温度 0，默认 16K 上下文、输出最多 2048 Token。
用 UTF-8 输入字节数保守预留输出及模板空间，过长的完整输入直接交给云端；本地
超时、模型缺失、JSON 不符合 schema 或输出不完整也转云端。本地一次、云端一次，
SDK 不隐式重试；图谱其他备用仍应保持 `GRAPH_AI_FALLBACK_PROVIDER=none`。
日志分别记录模型、Token 和转云原因，不记录新闻正文。

当前质量结论：9B 的历史摘要在收紧“只复述事实、不补写因果”的提示词后，三组
合成时间线保留了否认、未完成审批、未实施计划和数字更正。复杂图谱抽取与最终
Markdown 复测仍出现未确认关系、分级偏差、虚构或错放历史等问题，尚未合格。
因此本轮发布只设置 `WEB_LOCAL_AI_BASE_URL`；全局及 Graph 本地地址留空，最终
汇总继续云端。不能把路由测试或 JSON 合法率当作图谱与最终简报质量验收。

Windows 模型的安装、空闲时间、手动启停与网络权限由 IH 的 `home-llm/README.md`
维护。Drudge 不依赖操作用的 Mac 常驻转发；生产配置与网络生效状态见部署手册。

代码入口：[FileScanner](../packages/graph-worker/src/services/FileScanner.ts)、[NewsProcessor](../packages/graph-worker/src/services/NewsProcessor.ts)、[FailedNewsProcessor](../packages/graph-worker/src/services/FailedNewsProcessor.ts)。改变文件格式或消费规则须说明兼容、重放和迁移影响。

### 时间与图谱

服务间与数据库优先使用 UTC ISO 8601；调度和展示使用 `Asia/Shanghai`。保留原始时间便于追溯，不通过简单截取字符串假定时区。

Neo4j 当前有 `News`、`Event`、`Company`、`Person`、`Organization`、`Location` 六类节点。关系包含新闻归属、LLM 提取的业务关系、带 `inferred=true` 的共现推断。精确主键、字段、约束和迁移规则只维护在[数据库结构](../packages/graph-worker/DATABASE_SCHEMA.md)。

## 调度的真实业务行为

| 进程 / 触发器        | 北京时间           | 行为                                 |
| -------------------- | ------------------ | ------------------------------------ |
| ingest-worker        | 默认每分钟         | 获取两个来源的新增新闻               |
| graph-worker         | 默认每分钟         | 处理未消费文件；上一轮未结束时跳过   |
| `every_5_minutes`    | 每 5 分钟          | 扫描新的 Level 1 新闻并聚合通知      |
| `daytime_05`         | 11:05–22:05 每小时 | 总结上一完整小时并通知               |
| `overnight_05`       | 每天 10:05         | 总结前一天 22:00 至当天 10:00 并通知 |
| `weekly_friday_1605` | 周五 16:05         | 总结截至本周五 16:00 的前七天并通知  |

后四项由 `web-scheduler` 触发。实际时间范围以[调度 API](../packages/web-app/src/app/api/scheduler/route.ts)计算为准，不能把“05 分执行”理解为“范围也截止 05 分”。

[调度脚本](../packages/web-app/src/scripts/scheduler.js)仍注册十类触发器，其余六类只返回占位响应。工作台仅展示 API 的四个 `implemented_triggers`。`GET /api/scheduler` 返回状态说明 API 可用，不能单独证明独立调度进程存活或任务已投递。

## 工作台与公开入口

| 页面              | 已实现行为                                                           |
| ----------------- | -------------------------------------------------------------------- |
| `/`               | 服务/API 状态、四类业务调度入口、明确的扫描与总结/推送操作           |
| `/news`           | 列表、首个关键词搜索、筛选清除、完整详情与安全文本高亮               |
| `/graph`          | 图查询、双击节点扩展邻域、空结果/失败/部分结果提示                   |
| `/summary`        | 北京时间预设/自定义范围、完整报告、复制、显式可选推送（默认不勾选）  |
| `/monitor`        | 工作台/worker/数据库连通性、扫描状态、去重数、通知开关、30 秒刷新    |
| `/stats`          | 实际节点、关系和时间分布；查询失败明确报错                           |
| `/tingzi`         | 现有机器人操作入口；调用可能生成内容或发送消息                       |
| `/briefings/<id>` | 已持久化完整简报；同 ID 的 `image.png` 提供 PNG 图片（默认第 1 页），`page` 参数选择单页；旧 `image.svg` 保持可读 |

新闻和图查询实现位于 Web 的 `src/app/api/` 与 `src/lib/neo4j/`。Worker 另有健康、查询和操作 API，真实路由见各自 `src/http/index.ts`；不在文档重复所有请求字段。

简报与工作台共用 `drudge.microzj.com`，manifest 是 `public/none`。页面和 API 直接访问；中间件保留浏览器跨站操作检查及 `noindex`，这些不是身份认证。钉钉凭据、通知开关和显式收件人规则仍由业务校验。

`/briefings/health` 只返回固定存活响应；监控页连通性不能证明新闻质量、AI 总结质量或消息已送达。涉及真实副作用的 API 见[开发手册](development.md#本地运行与副作用)。

## 配置与消息边界

根 `.env` 为唯一运行配置入口，三个包通过 `@drudge/common` 构造配置；模板只在 `env.example` 维护。默认端口见 README，生产配置值只留在运行环境。

主动消息的职责分为业务格式化、快照存储、Markdown 正文构建、H5/历史图片渲染和钉钉传输。先保存完整快照，再发送原生 Markdown 文字与详情链接。正文用于快捷播报：全部事件句、已有时间、显式核心短语加粗和可选的一句已有历史/背景；详细正文、实体清单和原文入口留在 H5。共用内容选择函数保持新文字与旧图片的事实边界一致；新消息不依赖图片生成或客户端抓图。

可选 `emphasis` 保留总结中的字面短语标记，旧快照缺失时不推断重点，不迁移数据。PNG/SVG 继续提供历史链接兼容。2026-09-08 用户已决定从图片回到原生 Markdown，实际发布状态、字段和验收见[消息手册](dingtalk-briefing.md)与[部署手册](deployment.md)。

## 已知限制

以下是待按实际需求处理的事实，不是本次消息优化的自动扩展范围：

- 调度仍有六个占位任务；脚本内 cron 与公共配置 `CRON_*` 并存，修改配置不等于改变脚本调度。
- Level 1 扫描时间和去重 ID 保存在 Web 进程内存中，重启后丢失；监控显示的是当前进程状态。
- 批量实体写入后，部分业务关系写入失败仅记日志，存在节点与关系完成度不一致的风险。
- Graph Worker 查询 API 与 Web 直接查询 Neo4j 并存，有重复的数据映射。
- 简报快照没有自动保留期。清理前先确认历史消息链接允许失效的时间。
- Neo4j 初始化会创建约束和索引，schema 迁移尚无独立版本流程。

运行环境与部署方面的未验证项仅在部署手册维护。需要处理其中一项时，先界定影响并验证，不顺手重写整条链路。
