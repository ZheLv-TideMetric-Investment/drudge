# Drudge Monorepo 工程逻辑总览（基于当前主干代码）

> 目标：给后续“功能增强 + 重构”提供统一、可执行的工程认知底稿。  
> 范围：`packages/web-app`、`packages/ingest-worker`、`packages/graph-worker`、`shared/common`。

## 1. 工程定位与核心流程

这是一个以“新闻 -> 知识图谱 -> 分析/通知/展示”为主线的多包系统，核心链路是：

1. `ingest-worker` 定时抓取新闻（富途 + AWTMT），落盘到 `data/news/*.json`
2. `graph-worker` 定时扫描未处理文件，调用 LLM 提取六要素，写入 Neo4j
3. `web-app` 直接读 Neo4j 提供检索、图谱、统计、高级别扫描和总结能力，并负责消息通知与页面展示

可抽象为两层：

- 数据生产层：`ingest-worker` + `graph-worker`
- 数据消费与运营层：`web-app`

---

## 2. Monorepo 结构与职责边界

## 2.1 Workspace

- 根管理：`pnpm-workspace.yaml`
- 包范围：`packages/*` + `shared/*`
- 根脚本：`pnpm -r run build/test/lint/format`

## 2.2 包级职责

### `shared/common`

共享基础能力，当前是全仓“事实标准”：

- 统一枚举（事件类型、情感、级别、实体类型、关系类型等）
- 时间工具（北京时间/UTC转换）
- LLM 辅助工具（消息构造、usage 归一、错误文案）
- 通知 payload 构造工具

说明：`packages/web-app/constants/enums.ts` 与 `packages/graph-worker/src/constants/enums.ts` 都是 `export * from '@drudge/common'`，避免了多处枚举漂移。

### `packages/ingest-worker`

职责：外部新闻采集 + 本地文件存储 + 基础管理 API。

- 来源：`FutuLiveService`、`AwtmtLiveService`
- 存储：`FileStorage`（按 source+timestamp 生成文件）
- 调度：每分钟抓取一次（北京时间 cron）
- 对外：`/health`、`/api/news/*`、`/api/scheduler/*`、`/trigger/*`

### `packages/graph-worker`

职责：本地新闻文件图谱化、关系构建、图谱运维接口。

- 文件扫描：`FileScanner`（通过 `.processed/*.processed` 判定增量）
- 处理器：`NewsProcessor`（文件 -> 标准 `NewsItem` -> `KnowledgeGraphService`）
- 提取：`EntityExtractionService`（LLM 六要素提取，含重试和失败落盘）
- 存储：`EntityService` + `RelationshipService` + `Neo4jService`
- 调度：每分钟扫描并处理新文件
- 对外：`/health`、`/api/news/*`、`/api/entities/*`、`/api/stats` 等

### `packages/web-app`

职责：前端展示 + 业务 API 聚合 + 业务调度（scan/summary）+ 机器人入口。

- UI：新闻列表、图谱页、统计页、调度控制首页
- API：`/api/news*`、`/api/graph/*`、`/api/scan`、`/api/summary`、`/api/scheduler`、`/api/tingzi`
- 调度脚本：`src/scripts/scheduler.js`，通过 cron 触发本地 `/api/scheduler`
- 直接访问 Neo4j（并非通过 graph-worker 转发）

---

## 3. 端到端数据流（主干）

## 3.1 采集落盘（ingest）

1. `scheduler` 每分钟调用 `fetchLatestNews()`
2. 并发请求：
   - `futuLiveService.fetchNews()`
   - `awtmtLiveService.fetchNews()`
3. 增量策略：读取“对应 source 最新文件首条 ID”判新
4. 写盘：`data/news/<source>_<timestamp>.json`

特征：

- 默认首次运行也会做 ID 过滤
- 单次可分页抓取，最多 10 页
- 失败会发 webhook（API失败/文件写失败/服务异常）

## 3.2 图谱化（graph-worker）

1. `FileScanner.scanUnprocessedFiles()` 扫描 `NEWS_DIRECTORY`
2. 过滤前缀：`futu_live`、`awtmt_live`
3. `NewsProcessor` 读取 JSON 并兼容多种文件结构（array/data/list/news）
4. 统一映射为 `NewsItem`
5. `KnowledgeGraphService.batchProcessNews()`：
   - 跳过已处理新闻（查 Neo4j）
   - 分块调用 `EntityExtractionService.batchExtractEntities()`
   - 写入实体节点、系统关系、显式关系、推断关系
6. 成功后写 `.processed/<file>.processed`

失败路径：

- 单条新闻提取失败会落 `FAILED_NEWS_DIRECTORY`（默认 `data/news/failed`）
- 可用 CLI 命令 `retry-failed` / `retry-failed-by-id` 重试

## 3.3 业务消费（web-app）

### 扫描

- `/api/scan` 调 `highLevelNewsScanner.scanHighLevelNews()`
- 查询 Neo4j `Level 1` 新闻，支持去重与通知聚合发送

### 总结

- `/api/summary` 调 `summaryService.generateSummary(start,end,sendNotification)`
- 流程：取新闻 -> 拉新闻实体 -> 拉实体历史新闻 -> 生成实体历史摘要 -> 按级别汇总 -> AI生成最终总结 -> 可通知

### 调度

- `src/scripts/scheduler.js` 定义 10 类触发器（分钟、小时、白天、隔夜、周五）
- 每次触发 POST `/api/scheduler`
- `/api/scheduler` 内部按 trigger 分发：
  - `every_5_minutes`：高级别新闻扫描
  - `daytime_05`：小时总结
  - `overnight_05`：日报
  - `weekly_friday_1605`：周报
  - 其余 trigger 当前主要为占位/扩展点

---

## 4. Neo4j 数据模型（代码事实）

## 4.1 核心节点

- `News`：`id`、`title`、`content`、`timestamp`、`source`、`url`、`news_level` 等
- `Event`：`event_id`、`event_name`、`event_type`、`sentiment`、`event_level` 等
- `Company`：`company_name`、`ticker`、`industry` 等
- `Person`：`person_name`、`title`、`company` 等
- `Organization`：`organization_name`、`type`、`country` 等
- `Location`：`location_name`、`type`、`country`、`region` 等

## 4.2 关系类型

系统关系（由服务自动建）：

- `DESCRIBES`（News -> Event）
- `INVOLVES`（News -> Company/Organization）
- `MENTIONS`（News -> Person）
- `LOCATED_AT`（News/Event -> Location）

提取关系（LLM产出）：

- 如 `INVESTS_IN`、`PARTNERS_WITH`、`REGULATED_BY` 等（统一来自共享枚举）

推断关系（规则推导）：

- `WORKS_FOR`（Person -> Company）
- `LOCATED_IN`（Company/Person/Organization -> Location）

## 4.3 索引与约束

`Neo4jService` 启动时创建：

- 唯一约束：`News.id`、`Event.event_id`、`Company.company_name`、`Person.person_name`、`Organization.organization_name`、`Location.location_name`
- 常用索引：`News.timestamp/news_level`、各实体主键字段、`Event.timestamp/event_type/event_level`

---

## 5. API 版图（当前代码）

## 5.1 web-app API

- 调度与任务：
  - `POST /api/scheduler`
  - `GET /api/scheduler`
  - `POST /api/scan`
  - `GET /api/scan`
  - `GET /api/summary`
- 新闻：
  - `GET /api/news`
  - `GET /api/news/search`
- 图谱：
  - `GET /api/graph/stats`
  - `GET /api/graph/data`
  - `GET /api/graph/hot-rank`
  - `GET /api/graph/organizations`
  - `GET /api/graph/entities/search`
  - `GET /api/graph/entities/[entityId]/neighborhood`
- 机器人：
  - `POST /api/tingzi`

## 5.2 ingest-worker API（Express）

- `GET /health`
- `POST /trigger/fetch-news`
- `POST /trigger/fetch-batch`
- `GET /api/news/list`
- `GET /api/news/count`
- `GET /api/news/status`
- `POST /api/news/clean`
- `GET /api/scheduler/status`
- `POST /api/scheduler/trigger`

## 5.3 graph-worker API（Express）

- `GET /health`
- `POST /api/news/process`
- `POST /api/news/batch`
- `POST /api/news/status`
- `GET /api/stats`
- `GET /api/entities/search`
- `GET /api/entities/:name/relations`
- `GET /api/entities/:name/news`
- `GET /api/entities/popular`
- `GET /api/news`
- `GET /api/news/:id`
- `GET /api/news/level/distribution`
- `GET /api/system/status`

---

## 6. 调度体系（分层）

## 6.1 数据层调度

- `ingest-worker`: 每分钟抓取新闻
- `graph-worker`: 每分钟扫描并处理新文件

## 6.2 业务层调度

- `web-app/src/scripts/scheduler.js`: cron -> `/api/scheduler`（北京时间）
- 触发器映射业务动作（scan/hourly summary/daily summary/weekly summary）

结论：这是“数据生产调度”和“业务消费调度”并行的双调度架构。

---

## 7. 配置与环境变量（关键矩阵）

## 7.1 ingest-worker

- 端口：`PORT`（默认 39110）
- 数据落盘根目录：`STORAGE_PATH`（默认仓库 `data`）
- 新闻源参数：`NEWS_API_URL`、`NEWS_API_PAGE_SIZE`、`NEWS_API_REQUEST_INTERVAL`
- 通知：`ENABLE_WEBHOOK_NOTIFICATION`、`WEBHOOK_URL`

## 7.2 graph-worker

- 端口：`PORT`（默认 39111）
- Neo4j：`NEO4J_URI/USER/PASSWORD/DATABASE`
- AI：`AI_PROVIDER` + `AI_FALLBACK_PROVIDER`，以及各 provider 的 key/model
- 文件目录：`NEWS_DIRECTORY`、`FAILED_NEWS_DIRECTORY`
- 内存与分块：`EXTRACTION_CHUNK_SIZE`、`PROCESSING_CHUNK_SIZE`、`AI_BATCH_SIZE`、`MAX_HEAP_SIZE_MB` 等
- 通知：`ENABLE_WEBHOOK_NOTIFICATION`、`WEBHOOK_URL`

## 7.3 web-app

- 端口：`PORT`（默认 39112）
- Neo4j：`NEO4J_*`
- AI：`AI_PROVIDER`、`SIMPLE_AI_PROVIDER`、各 provider key/model、`JINA_API_KEY`
- 通知：`ENABLE_WEBHOOK_NOTIFICATION`、`WEBHOOK_URLS`（逗号分隔）

---

## 8. 可观测性与稳定性机制

- 各服务均有健康检查端点
- webhook 异常通知已覆盖：API失败、提取失败、写库失败、连接失败、服务异常等
- graph-worker 有内存监控 + 可选自动 `global.gc()`
- graph-worker 失败新闻有落盘与重试 CLI
- 调度任务均有执行日志和耗时日志

---

## 9. 测试体系（当前基线）

- 三个 package 均使用 `jest + ts-jest`
- test setup 启用：
  - no-network guard（默认禁真实网络，要求 mock axios）
  - no-prod-path guard（防止误写生产路径）
- 覆盖率阈值均为全局 `95%`
- 当前仓库测试文件约 60+，覆盖 API/service/neo4j/utils/cli 主路径

---

## 10. 当前架构特征总结

## 10.1 优点

- 职责切分清楚：采集、图谱构建、展示消费分离
- 共享枚举和工具集中在 `@drudge/common`
- 图谱处理链条可恢复（失败落盘 + 重试）
- 时区处理有统一方案（尤其 web-app 的北京时间/UTC转换）
- 测试规范和保护措施较完整

## 10.2 已观察到的结构性风险/不一致

1. 查询字段命名存在历史混用：部分查询使用 `name`，但多数节点主键是 `company_name/person_name/...`，可能导致部分查询命中率不稳定。
2. web 图谱搜索参数有不一致：`graph-utils.ts` 用 `q`，`/api/graph/entities/search` 读取 `searchTerm`，当前行为可能偏离预期（搜索词不生效时会返回默认结果）。
3. `web-app` 与 `graph-worker` 都直连 Neo4j，存在“查询逻辑双实现”与口径漂移风险。
4. `docker-compose.workers.yml` 中 ingest/graph 的数据卷映射与 `NEWS_DIRECTORY` 组合存在潜在错配风险（需按部署意图复核是否共享同一新闻目录）。
5. 仍有不少 `any`、字符串拼 Cypher、服务间私有成员访问（如 `service['neo4j']`），长期会抬高重构成本。

---

## 11. 面向后续增强/重构的建议路线（按性价比）

## 阶段 A（低风险，先做）

1. 统一字段访问约定（`name` vs `company_name/person_name/...`），封装一个实体主键解析层。
2. 修复参数不一致（如 graph 实体搜索 `q/searchTerm`），并补对应 API 测试。
3. 统一响应 envelope 与错误码语义，减少前端/脚本分支判断。

## 阶段 B（中风险，收益高）

1. 收敛 Neo4j 查询入口：优先通过单一 query 层（建议放 web-app 的 neo4j service 或抽 shared query 包）。
2. 抽离调度配置中心：把 trigger->handler 映射从代码散点收敛到配置映射，降低新增任务成本。
3. 为 graph-worker 引入处理幂等审计字段（文件级+新闻级），提升可追踪性。

## 阶段 C（中高风险，架构升级）

1. 评估从“文件中转”升级到“队列/事件流”模式，降低磁盘轮询和目录一致性问题。
2. 明确 `web-app` 是否继续承担业务编排（scan/summary）还是下沉到 worker，收紧边界。
3. 对 LLM 提取链路建立可回放数据集，形成回归基准（模型切换时可比较质量退化）。

---

## 12. 快速上手建议（后续协作）

在后续每个增强/重构任务里，建议先明确三件事：

1. 改动属于哪一层：采集、图谱、消费、还是 shared contract。
2. 是否会影响数据口径：字段命名、关系类型、时区解释、级别定义。
3. 需要补哪类验证：单测、API回归、调度触发回归、Neo4j 查询快照对比。

---

## 附：关键文件入口（便于二次阅读）

- 根配置：`package.json`、`pnpm-workspace.yaml`
- 共享契约：`shared/common/constants/enums.js`
- ingest 入口：`packages/ingest-worker/src/index.ts`
- ingest 抓取：`packages/ingest-worker/src/apis/news/fetch.ts`
- ingest 存储：`packages/ingest-worker/src/storage/FileStorage.ts`
- graph 入口：`packages/graph-worker/src/index.ts`
- graph 提取：`packages/graph-worker/src/services/EntityExtractionService.ts`
- graph 编排：`packages/graph-worker/src/services/KnowledgeGraphService.ts`
- graph 扫描：`packages/graph-worker/src/services/FileScanner.ts`
- web 调度：`packages/web-app/src/scripts/scheduler.js`
- web 总结：`packages/web-app/src/lib/services/summary.ts`
- web 扫描：`packages/web-app/src/lib/services/high-level-scanner.ts`
- web 时区：`packages/web-app/src/lib/utils/timezone.ts`
- web 图谱查询：`packages/web-app/src/lib/neo4j/*.ts`

