# Drudge 重构计划（面向 Code AI 实施）

> 目标: 在不新增外部依赖的前提下，减少不必要的抽象与复杂度，
> 修复文件处理问题，统一数据模型与时间处理，并提高可靠性。

## 0. 执行说明（给 Code AI）
- 先读完 `docs/refactor.md`、`README.md`、`packages/graph-worker/DATABASE_SCHEMA.md`。
- 不新增依赖/框架，不改变“文件交接 -> 图谱 -> Web”的主流程。
- 每次只做小步修改，按阶段拆分；每阶段都要可回滚。
- 任何 UI 相关改动必须用 `chrome-devtools` 验证并产出截图/Console 结论。
- 每次改动都更新对应文档（schema/README/注释）避免口径分裂。
- **优先建立并完善单元测试，确保后续重构始终围绕正确目标。**
- **测试隔离原则**: 所有写入型测试必须使用临时目录、内存数据或 mock，\n+  严禁写入 `data/`、`neo4j/`、生产环境或共享路径。

## 1. 系统入口与数据流（当前事实）
- **ingest-worker**
  - 入口: `packages/ingest-worker/src/index.ts`
  - 调度: `packages/ingest-worker/src/scheduler/index.ts`
  - CLI: `packages/ingest-worker/src/cli/index.ts`
  - 输出: `data/news/<source>_<YYYY_MM_DD_HH_mm_ss_SSS>.json`
- **graph-worker**
  - 入口: `packages/graph-worker/src/index.ts`
  - 调度: `packages/graph-worker/src/scheduler/index.ts`
  - CLI: `packages/graph-worker/src/cli/index.ts`
  - 文件扫描: `packages/graph-worker/src/services/FileScanner.ts`
  - 图谱构建: `packages/graph-worker/src/services/KnowledgeGraphService.ts`
- **web-app**
  - Next.js: `packages/web-app/src/app/*`
  - Neo4j 查询: `packages/web-app/src/lib/neo4j/*`
  - 调度脚本: `packages/web-app/src/scripts/scheduler.js`
- **调度说明**
  - graph-worker 的定时器用于图谱底层数据写入，稳定且长期不变。
  - web-app 的定时器面向用户总结与通知，策略可随需求调整。
  - **两者都必须保留**，不要合并或移除。
- **数据目录**
  - 新闻文件: `data/news/*.json`
  - 处理记录: `data/news/.processed/*.processed`
  - 失败文件: `data/news/failed/failed_<id>_<timestamp>.json`

## 2. 数据契约（建议明确成文档）
> 目标是让 ingest 输出与 graph 解析一致、可验证。
- **文件格式**: JSON 数组，元素为 `NewsItem`。
- **最小字段**: `id`, `title`, `content`, `source`, `time`(毫秒), `url`(可选)
- **graph-worker 转换逻辑**: `packages/graph-worker/src/services/NewsProcessor.ts` 会将
  `time`/`timestamp`/`publishTime` 转为 `timestamp`(UTC ISO)

建议在 Phase 0 补一个 `docs/refactor-io.md`，记录此契约与示例。

## 3. 关键问题清单（定位 + 关键词）

### 3.1 文件与时间
- **时间单位重复**
  - 位置: `packages/ingest-worker/src/storage/FileStorage.ts`
  - 位置: `packages/ingest-worker/src/apis/news/list.ts`
  - 关键词: `parseTime(item.time * 1000)`
  - 事实: `FutuLiveService`/`AwtmtLiveService` 已将时间转为毫秒。
- **数据目录初始化竞态**
  - 位置: `packages/ingest-worker/src/storage/FileStorage.ts`
  - 关键词: `ensureDataPath()` 在构造函数里未 await。
- **路径相对且不稳定**
  - 位置: `packages/ingest-worker/src/config/config.ts`
  - 位置: `packages/graph-worker/src/config/config.ts`
  - 关键词: `../../data` / `../../data/news`
- **失败目录不一致**
  - 位置: `packages/graph-worker/src/services/EntityExtractionService.ts`
  - 位置: `packages/graph-worker/src/services/FailedNewsProcessor.ts`
  - 关键词: `failedNewsDir`

### 3.2 数据模型与查询不一致
- **news_level vs level 混用**
  - graph-worker 写入: `packages/graph-worker/src/services/EntityService.ts`
  - graph-worker 查询: `packages/graph-worker/src/apis/graph/query.ts`
  - web-app 查询: `packages/web-app/src/lib/neo4j/*`
  - UI 展示: `packages/web-app/src/app/news/page.tsx`（当前只识别 "1/2/3"）
- **processedAt 被查询但未写入**
  - 查询: `packages/graph-worker/src/apis/graph/query.ts`
  - 查询: `packages/web-app/src/lib/neo4j/news.ts`
  - 写入缺失: `packages/graph-worker/src/services/EntityService.ts`

### 3.3 图谱处理冗余/风险
- **空关系创建**
  - 位置: `packages/graph-worker/src/services/KnowledgeGraphService.ts`
  - 关键词: `createRelationship({ from: '', to: '' ... })`
- **推断关系字符串拼接 Cypher**
  - 位置: `packages/graph-worker/src/services/RelationshipService.ts`
  - 关键词: `createInferredRelationships` + 模板字符串

### 3.4 重复抽象与漂移
- 时间工具: `packages/web-app/src/lib/utils/timezone.ts`、`frontend-time.ts`、
  `neo4j/timezone-wrapper.ts`、`packages/graph-worker/src/utils/timeUtils.ts`
- AI 服务: `packages/graph-worker/src/services/AiService.ts`、`packages/web-app/src/lib/utils/llm.ts`
- 通知服务: `packages/*/services/NotificationService.ts`
- 薄包装层: `packages/web-app/src/lib/services/query.ts`、`GraphService` 等
- workspace 配置: `pnpm-workspace.yaml`/`package.json`/`docker-compose.yml` 引用 `shared/*`，
  但目录缺失

## 4. 分阶段重构计划（面向执行）

### Phase 0: 先建立完整单元测试（4-7 天）
**目标**: 先把单测打牢，形成可靠的回归护栏，再进入重构阶段。

**原则**
- 以“可回归 + 可隔离 + 可验证”为核心，默认覆盖所有正常/异常/边界分支。
- 以“覆盖率门槛 + 接口契约快照”作为强制门槛。
- 全部测试必须可离线运行，不访问真实外部网络/数据库/生产目录。

**任务清单**
0) 统一测试框架与脚本（强制 jest + ts-jest）
- 每个包新增 dev deps: `jest`、`ts-jest`、`@types/jest`（统一版本）。
- 每个包新增 `jest.config.ts`（最小配置）:
  - `preset: 'ts-jest'`, `testEnvironment: 'node'`
  - `testMatch: ['<rootDir>/src/**/__tests__/**/*.test.ts', '<rootDir>/tests/**/*.test.ts']`
  - `clearMocks: true`, `resetMocks: true`, `restoreMocks: true`
  - `setupFilesAfterEnv: ['<rootDir>/tests/setup.ts']`
  - `collectCoverageFrom: ['src/**/*.ts', '!src/**/*.d.ts', '!src/**/index.ts']`
  - `coverageThreshold`: 全局 lines/branches/functions/statements >= 95%
- 增加 `test:ci` 脚本: `jest --coverage --runInBand`（IO 测试稳定性）。
- 覆盖率门槛:
  - 全局 >= 95%
  - 核心模块 >= 100%（storage/processor/api-helpers/neo4j/news）
  - **修改过的文件必须 100% 行/分支覆盖**（否则不允许合并）。

1) 建立测试隔离与数据策略
- 统一测试环境变量: 例如 `TEST_MODE=true`，强制 `STORAGE_PATH/NEWS_DIRECTORY` 指向临时目录。
- 文件写入测试必须使用临时目录（`os.tmpdir()`/`fs.mkdtemp`），测试结束清理。
- Neo4j 相关测试必须使用 mock 或测试库，禁止连正式库/共享库。
- 默认禁网：`jest.mock('axios')`，未显式 mock 的网络请求一律抛错。
- 路径保护断言: 写入路径不得以 `data/`、`neo4j/`、`/var/lib` 开头。
- 通知/Webhook 一律 mock，避免真实推送。

2) 建立测试工具库（每个包最少一套 helpers）
- `tests/helpers/env.ts`: 设置/还原 env，必要时 `resetModules`。
- `tests/helpers/tmp-dir.ts`: 创建临时目录并自动清理。
- `tests/helpers/fake-time.ts`: 固定 `Date.now()` 并恢复。
- `tests/helpers/mock-neo4j.ts`: mock `executeQuery`/`session` 行为。
- `tests/helpers/mock-axios.ts`: mock HTTP 请求与错误路径。
- `tests/helpers/next-request.ts`: 构造 `NextRequest`（GET/POST + query/body）。
- `tests/guards/no-network.ts`: 未 mock 的 axios 调用直接失败。
- `tests/guards/no-prod-path.ts`: 检查写入路径。
- `tests/setup.ts`: 统一 `TEST_MODE=true`、`jest.setTimeout`、全局 guard。

3) 单测用例矩阵（AI 可直接落地，包含 API 层 + 错误注入 + 契约校验）
- ingest-worker
  - IW-FS-001 `FileStorage.saveNews`: 按 source 分文件写入，文件名匹配 `<source>_<timestamp>.json`。
  - IW-FS-002 `FileStorage.getLatestNewsId`: 最新文件首条 id；无文件/空文件返回 null。
  - IW-FS-003 `FileStorage.getAllNews`: 汇总并按 time 降序。
  - IW-FS-004 `FileStorage.getNewsByLimit`: limit=0/1/超大值。
  - IW-FS-005 `FileStorage.getNewsByTimeRange`: 毫秒时间正确过滤，明确边界是否包含。
  - IW-FS-006 `FileStorage.getNewsStats`: total/today/recent/sourceStats 正确（冻结时间）。
  - IW-FS-007 `FileStorage.getNewsFiles`: source 过滤、非 json 忽略、排序正确。
  - IW-FS-008 `FileStorage.getAllNews`: 读取坏 JSON 时跳过并继续。
  - IW-FS-009 `FileStorage.cleanOldFiles`: 仅删除超过阈值的文件。
  - IW-FS-010 `FileStorage.saveNews`: 写入失败时通知触发/错误抛出。
  - IW-FU-001 `FutuLiveService.transformNewsItem`: time 转毫秒、id string、字段映射完整。
  - IW-FU-002 `FutuLiveService.filterNewNews`: lastNewsId 缺失/存在/不存在三分支。
  - IW-FU-003 `FutuLiveService.fetchNews`: API 正常/超时/非 2xx 分支。
  - IW-AW-001 `AwtmtLiveService.transformNewsItem`: 时间与字段映射正确。
  - IW-AW-002 `AwtmtLiveService.fetchNews`: API 失败/空数据分支。
  - IW-NOT-001 `NotificationService`: 文本格式与 webhook 调用参数。
  - IW-API-001 `api/news/list`: 返回时间格式一致，source 默认值正确。
  - IW-API-002 `api/news/time-range`: 正确透传范围筛选与错误处理。
  - IW-API-003 `api/news/fetch`: 合并排序正确，空结果返回提示，异常路径可捕获。
  - IW-API-004 `api/news/count`: stats 结构完整，错误分支返回 details。
  - IW-API-005 `api/news/clean`: days 默认/自定义分支，返回统计一致。
  - IW-API-006 `api/system/status`: API 健康检查映射正确，异常路径返回错误。
  - IW-API-007 `api/system/scheduler.getSchedulerStatus`: 任务列表结构稳定。
  - IW-API-008 `api/system/scheduler.triggerNewsTask`: 调用 fetch 成功/失败分支。
  - IW-API-009 `api/system/healthCheck`: 返回 service/port/timestamp 正确。
  - IW-TU-001 `utils/time.parseTime`: 秒/毫秒/Date/字符串解析一致。
  - IW-ERR-001 `utils/error.buildErrorDetails`: axios 错误/普通错误结构一致。

- graph-worker
  - GW-NP-001 `convertFileDataToNewsItems`: 支持 array/data/list/news 四种结构。
  - GW-NP-002 `convertSingleNewsItem`: 时间优先级 `timestamp > time > publishTime > mtime`。
  - GW-NP-003 `convertSingleNewsItem`: id 兜底/标题缺失/空内容处理。
  - GW-NP-004 `processNewsFilesInParallel`: 成功率>失败率时标记 .processed。
  - GW-FS-001 `scanUnprocessedFiles`: 前缀过滤与 .json 过滤正确。
  - GW-FS-002 `checkIfFileProcessed`: .processed mtime >= 源文件视为已处理。
  - GW-FS-003 `markFileAsProcessed`: 生成记录包含 processedAt/fileSize。
  - GW-FS-004 `getFileProcessingStats`: total/processed/unprocessed 统计正确。
  - GW-FNP-001 `FailedNewsProcessor.parseFailedFile`: 文件结构不合法时返回 null。
  - GW-FNP-002 `FailedNewsProcessor.retryFailedNews`: 成功/失败计数正确。
  - GW-ES-001 `EntityService.createNews`: 写入 `news_level/level/processedAt` 字段一致。
  - GW-RS-001 `RelationshipService.createRelationship`: 关系类型清洗后入库。
  - GW-RS-002 `createInferredRelationships`: 去重同对关系，参数化执行。
  - GW-KG-001 `KnowledgeGraphService.processNews`: 已处理新闻直接返回成功。
  - GW-KG-002 `KnowledgeGraphService.batchProcessNews`: unprocessed 过滤、chunk 处理路径。
  - GW-AI-001 `AiService`: provider 选择/回退/异常分支。
  - GW-NEO-001 `Neo4jService.initialize`: 连接失败触发通知。
  - GW-NEO-002 `Neo4jService.executeQuery`: 参数传递与异常路径。
  - GW-TU-001 `timeUtils.parseTime`: 秒/毫秒/ISO/自然语言解析正确。
  - GW-API-001 `apis/news/process.processNews`: 缺字段返回错误；成功分支带 timestamp。
  - GW-API-002 `apis/news/process.batchProcessNews`: 空数组错误；summary 统计正确。
  - GW-API-003 `apis/news/process.checkNewsStatus`: 非数组错误；processed/unprocessed 正确。
  - GW-API-004 `apis/graph/query.getGraphStats`: 成功/失败分支。
  - GW-API-005 `apis/graph/query.getNewsList`: level 过滤与字段映射正确。
  - GW-API-006 `apis/graph/query.getNewsDetail`: 无记录返回错误；有记录返回 entities。
  - GW-API-007 `apis/graph/query.getPopularEntities`: newsCount 数值化。
  - GW-API-008 `apis/graph/query.getEntityNews`: relationType 映射正确。
  - GW-API-009 `apis/graph/query.getNewsLevelDistribution`: total 统计正确。
  - GW-API-010 `apis/system/status.getSystemStatus`: healthCheck 调用与错误分支。
  - GW-EE-001 `EntityExtractionService.parseExtractionResult`: 默认字段与级别兜底正确。

- web-app
  - WA-NQ-001 `neo4j/news.ts`: list 查询按 `news_level` 过滤，`processedAt` 排序正确。
  - WA-NQ-002 `neo4j/news.ts`: 关键字/分页/排序组合条件。
  - WA-NQ-003 `neo4j/analytics.ts`: 时间范围参数与字段映射一致。
  - WA-TZ-001 `TimeZoneUtils`: toUTC/toBeijing/formatBeijingTime 正确。
  - WA-TZ-002 `formatTimeFields`: 对数组/对象/空值安全处理。
  - WA-AH-001 `api-helpers.parsePaginationParams`: page/limit/offset 边界值。
  - WA-AH-002 `api-helpers.validateTimeRange`: 空/非法/超范围/反向范围。
  - WA-AH-003 `api-helpers.buildSuccessResponse`: 时间字段格式化正确。
  - WA-API-001 `api/news` GET: zod 校验、默认分页、错误分支。
  - WA-API-002 `api/news/search` GET: 缺 q 返回 400，时间范围错误返回 400。
  - WA-API-003 `api/graph/stats` GET: 聚合结果与错误分支。
  - WA-API-004 `api/graph/hot-rank` GET: days/limit 解析与默认值。
  - WA-API-005 `api/graph/data` GET: query/nodeType/overview 三分支。
  - WA-API-006 `api/graph/organizations` GET: searchTerm/limit 分支。
  - WA-API-007 `api/scan` POST: body 校验、初始化调用、错误分支。
  - WA-API-008 `api/scan` GET: 返回示例结构稳定。
  - WA-API-009 `api/scheduler` POST: trigger 校验与各分支处理。
  - WA-API-010 `api/summary` GET: 缺参 400、成功/失败分支。
  - WA-API-011 `api/tingzi` POST: token 校验 403，成功与异常分支。
  - WA-SUM-001 `summary` 纯函数分组: Level 1-5 顺序稳定、空数组安全。
  - WA-SUM-002 `summary` 生成流程: 空新闻/高等级新闻/通知开关。
  - WA-NOT-001 `notification` 文本格式: Level 1/2 关键字段完整。
  - WA-ROB-001 `robot.processTingziMessage`: token 错误/成功/异常分支。

3.1 用例细化清单（输入/输出/断言点）
**说明**: 每条用例包含“输入/输出/断言”，AI 依据此直接生成测试代码。

#### ingest-worker 用例详情
- IW-FS-001 `FileStorage.saveNews`
  - 输入: `news[]` 含 2 个 source、time=毫秒；storage path 指向临时目录。
  - 输出: 返回文件名字符串；tmp dir 内生成多个 `<source>_<timestamp>.json`。
  - 断言: 文件数=source 数；文件名正则匹配；内容为数组且条数正确；无写入 `data/`。
- IW-FS-002 `FileStorage.getLatestNewsId`
  - 输入: 多个文件名按时间排序；每个文件含不同 id；含空文件分支。
  - 输出: 最新文件首条 id；无文件/空文件时 `null`。
  - 断言: 选择最新文件；空文件/无文件分支不抛错。
- IW-FS-003 `FileStorage.getAllNews`
  - 输入: 多文件、多时间新闻；含一份无效 JSON。
  - 输出: 聚合数组按 time 降序。
  - 断言: 仅有效文件进入结果；顺序正确；logger.warn 被调用。
- IW-FS-004 `FileStorage.getNewsByLimit`
  - 输入: limit=0/1/超大值；已有多条新闻。
  - 输出: 长度为 `min(limit, total)`。
  - 断言: limit 边界正确；不返回负数长度。
- IW-FS-005 `FileStorage.getNewsByTimeRange`
  - 输入: start/end 时间；新闻 time 有内外边界样本。
  - 输出: 仅返回范围内新闻。
  - 断言: 采用毫秒；边界是否包含与当前实现一致。
- IW-FS-006 `FileStorage.getNewsStats`
  - 输入: 固定 `now`；含今天/近三天/更早新闻，多 source。
  - 输出: total/today/recent/sourceStats。
  - 断言: 计数准确；sources 列表与 sourceStats keys 一致。
- IW-FS-007 `FileStorage.getNewsFiles`
  - 输入: json + 非 json 文件；带 source 参数/不带参数。
  - 输出: 过滤后的文件名数组（降序）。
  - 断言: 仅 json；source 前缀过滤正确；排序正确。
- IW-FS-008 `FileStorage.getAllNews`（坏 JSON）
  - 输入: 1 个坏 JSON 文件 + 1 个正常文件。
  - 输出: 仅正常文件数据。
  - 断言: 不抛错；logger.warn 触发；结果可用。
- IW-FS-009 `FileStorage.cleanOldFiles`
  - 输入: 不同 mtime 文件；days 阈值。
  - 输出: deletedCount/remainingCount/message。
  - 断言: 只删除过期文件；统计准确。
- IW-FS-010 `FileStorage.saveNews`（写入失败）
  - 输入: mock `fs.promises.writeFile` 抛错。
  - 输出: 抛异常；触发通知。
  - 断言: `sendFileSaveFailureNotification` 被调用；错误不被吞。
- IW-FU-001 `FutuLiveService.transformNewsItem`
  - 输入: 原始 item（time=秒、id=数字）。
  - 输出: NewsItem（time=毫秒、id=字符串、source=futu_live）。
  - 断言: 字段映射完整；summary 长度不超 200。
- IW-FU-002 `FutuLiveService.filterNewNews`
  - 输入: news 列表 + mock `getLatestNewsId`（null/存在/不存在）。
  - 输出: 全量或截断数组。
  - 断言: lastNewsId 缺失 -> 全量；找到 -> slice；找不到 -> 全量。
- IW-FU-003 `FutuLiveService.fetchNews`
  - 输入: 首次运行/非首次运行；mock makeRequest 返回有效/无效格式；模拟异常。
  - 输出: 成功返回数组；格式错误/异常返回空数组。
  - 断言: 首次运行会 `saveNews`；非首次运行按页累计；isFirstRun 置 false；异常触发通知。
- IW-AW-001 `AwtmtLiveService.transformNewsItem`
  - 输入: 原始 item（display_time=秒）。
  - 输出: NewsItem（time=毫秒、source=awtmt_live）。
  - 断言: 字段映射完整；summary/author 等默认值一致。
- IW-AW-002 `AwtmtLiveService.fetchNews`
  - 输入: 首次/非首次；code != 20000；异常抛出。
  - 输出: 成功数组；失败返回空数组。
  - 断言: 失败分支触发通知；分页停止逻辑正确。
- IW-NOT-001 `NotificationService`
  - 输入: 调用至少 2 个 send* 方法；mock webhook。
  - 输出: 构建的 payload + HTTP 调用。
  - 断言: 文本包含关键字段；请求地址/headers 正确；失败时返回 false。
- IW-API-001 `api/news/list`
  - 输入: mock `fileStorage.getNewsByLimit`；limit=10。
  - 输出: `success=true`，news 数组，timestamp 字符串。
  - 断言: 时间格式一致；source 默认值正确。
- IW-API-002 `api/news/time-range`
  - 输入: mock `getNewsByTimeRange`；非法时间分支。
  - 输出: success true/false 两分支。
  - 断言: 错误分支含 details；成功分支 count 正确。
- IW-API-003 `api/news/fetch`
  - 输入: mock futu/awtmt 返回数组；空数组；抛错。
  - 输出: success true/false；message 正确。
  - 断言: 合并按 time 排序；news 预览 5 条。
- IW-API-004 `api/news/count`
  - 输入: mock `getNewsStats` 成功/抛错。
  - 输出: success true/false；stats 或 error/details。
  - 断言: stats 字段完整；错误分支带 details。
- IW-API-005 `api/news/clean`
  - 输入: days 默认/指定；mock `cleanOldFiles`。
  - 输出: success true/false；deletedCount/remainingCount。
  - 断言: message 包含统计；错误分支带 details。
- IW-API-006 `api/system/status`
  - 输入: mock healthCheck true/false；mock stats。
  - 输出: success true/false；connections/serviceStatus。
  - 断言: 连接状态映射为 ✅/❌；异常分支返回 error/details。
- IW-API-007 `api/system/scheduler.getSchedulerStatus`
  - 输入: 无。
  - 输出: success true；tasks 结构固定。
  - 断言: tasks 键值/描述/cron 存在。
- IW-API-008 `api/system/scheduler.triggerNewsTask`
  - 输入: mock `fetchLatestNews` 成功/抛错。
  - 输出: success true/false；result 或 error/details。
  - 断言: 成功分支 message 正确；失败分支含 details。
- IW-API-009 `api/system/healthCheck`
  - 输入: 设置 PORT 环境变量。
  - 输出: status/service/port/timestamp。
  - 断言: port 使用 env 或默认值；timestamp 为 ISO。
- IW-TU-001 `utils/time.parseTime`
  - 输入: 秒/毫秒/Date/ISO 字符串。
  - 输出: dayjs 对象（北京时间）。
  - 断言: 时区为 Asia/Shanghai；毫秒解析不再 *1000。
- IW-ERR-001 `utils/error.buildErrorDetails`
  - 输入: axios 错误/普通 Error/字符串。
  - 输出: ErrorDetails。
  - 断言: axios 分支含 response/request；普通错误含 message/stack。

#### graph-worker 用例详情
- GW-NP-001 `convertFileDataToNewsItems`
  - 输入: array/data/list/news 四种结构。
  - 输出: NewsItem[]。
  - 断言: 都能解析；未知结构返回空数组。
- GW-NP-002 `convertSingleNewsItem`
  - 输入: timestamp/time/publishTime/缺失时间。
  - 输出: NewsItem.timestamp（UTC ISO）。
  - 断言: 时间优先级正确；缺失走 mtime。
- GW-NP-003 `convertSingleNewsItem`（字段兜底）
  - 输入: 缺 id/title/content。
  - 输出: id 生成；title/content 为空字符串。
  - 断言: 不抛错；字段有默认值。
- GW-NP-004 `processNewsFilesInParallel`
  - 输入: 文件批次含成功/失败结果。
  - 输出: FileProcessResult[]。
  - 断言: 成功率>失败率才标记 .processed；失败分支记录 error。
- GW-FS-001 `scanUnprocessedFiles`
  - 输入: 目录含不同前缀/后缀文件。
  - 输出: FileInfo[]。
  - 断言: 仅支持前缀 + .json；按 mtime 升序。
- GW-FS-002 `checkIfFileProcessed`
  - 输入: 源文件 + .processed mtime 更晚/更早。
  - 输出: true/false。
  - 断言: record mtime >= 源文件时返回 true。
- GW-FS-003 `markFileAsProcessed`
  - 输入: 指定文件路径。
  - 输出: .processed 文件。
  - 断言: JSON 含 processedAt/fileSize/processedBy。
- GW-FS-004 `getFileProcessingStats`
  - 输入: 目录含已处理/未处理文件。
  - 输出: total/processed/unprocessed。
  - 断言: 统计准确；lastScanTime 存在。
- GW-FNP-001 `FailedNewsProcessor.parseFailedFile`
  - 输入: 缺字段/坏 JSON。
  - 输出: null。
  - 断言: 不抛错；无效文件被跳过。
- GW-FNP-002 `FailedNewsProcessor.retryFailedNews`
  - 输入: failed 文件列表；mock processNews 成功/失败。
  - 输出: success/failed 计数。
  - 断言: 删除成功文件；失败计数准确。
- GW-ES-001 `EntityService.createNews`
  - 输入: NewsItem + newsLevel。
  - 输出: neo4j executeQuery 被调用。
  - 断言: 参数含 news_level/level/processedAt。
- GW-RS-001 `RelationshipService.createRelationship`
  - 输入: 不同关系类型字符串。
  - 输出: executeQuery 调用。
  - 断言: 类型清洗为合法关系名；参数正确。
- GW-RS-002 `createInferredRelationships`
  - 输入: 重复公司-人物/公司-地点组合。
  - 输出: executeQuery 调用次数。
  - 断言: 重复对去重；参数化执行。
- GW-KG-001 `KnowledgeGraphService.processNews`
  - 输入: mock isNewsProcessed=true/false。
  - 输出: success true/false。
  - 断言: 已处理直接返回；未处理走 extract->write->relate。
- GW-KG-002 `KnowledgeGraphService.batchProcessNews`
  - 输入: 含已处理与未处理新闻。
  - 输出: ProcessResult[]。
  - 断言: 仅处理未处理；chunk 逻辑生效。
- GW-AI-001 `AiService`
  - 输入: provider 配置/空 key/异常抛出。
  - 输出: result 或 error。
  - 断言: provider 选择与 fallback 生效。
- GW-NEO-001 `Neo4jService.initialize`
  - 输入: mock 连接失败。
  - 输出: 抛错。
  - 断言: 通知被触发；错误上抛。
- GW-NEO-002 `Neo4jService.executeQuery`
  - 输入: query + params。
  - 输出: records。
  - 断言: 参数透传；异常分支返回 error。
- GW-TU-001 `timeUtils.parseTime`
  - 输入: 秒/毫秒/ISO/自然语言。
  - 输出: UTC ISO。
  - 断言: 正确区分秒/毫秒。
- GW-API-001 `apis/news/process.processNews`
  - 输入: 缺字段/完整数据。
  - 输出: success false/true。
  - 断言: 缺字段返回提示；成功包含 data/timestamp。
- GW-API-002 `apis/news/process.batchProcessNews`
  - 输入: 空数组/非空数组。
  - 输出: success false/true + summary。
  - 断言: summary 统计正确。
- GW-API-003 `apis/news/process.checkNewsStatus`
  - 输入: 非数组/数组。
  - 输出: success false/true。
  - 断言: processed/unprocessed 计算正确。
- GW-API-004 `apis/graph/query.getGraphStats`
  - 输入: mock getGraphStats success/throw。
  - 输出: success true/false。
  - 断言: 失败分支带 error。
- GW-API-005 `apis/graph/query.getNewsList`
  - 输入: limit/level；mock records。
  - 输出: news[]。
  - 断言: 过滤条件与 params 正确；映射字段正确。
- GW-API-006 `apis/graph/query.getNewsDetail`
  - 输入: newsId；无记录/有记录。
  - 输出: success false/true。
  - 断言: 无记录返回“新闻不存在”；entities 映射正确。
- GW-API-007 `apis/graph/query.getPopularEntities`
  - 输入: limit；mock records 含 count。
  - 输出: entities[]。
  - 断言: count 转 number；排序不在测试中破坏。
- GW-API-008 `apis/graph/query.getEntityNews`
  - 输入: entityName；mock records。
  - 输出: news[]。
  - 断言: relationType/level/timestamp 映射正确。
- GW-API-009 `apis/graph/query.getNewsLevelDistribution`
  - 输入: mock records。
  - 输出: distribution + total。
  - 断言: total=counts 之和。
- GW-API-010 `apis/system/status.getSystemStatus`
  - 输入: mock neo4j health/scheduler health。
  - 输出: systemStatus。
  - 断言: services/memory/uptime/pid 存在；错误分支返回 error。
- GW-EE-001 `EntityExtractionService.parseExtractionResult`
  - 输入: extractionData 缺字段/完整。
  - 输出: NewsExtractionResult。
  - 断言: 默认级别、事件 id 生成、字段兜底正确。

#### web-app 用例详情
- WA-NQ-001 `neo4j/news.ts`（列表）
  - 输入: 条件含 level/时间/分页；mock neo4j records。
  - 输出: news + total。
  - 断言: 过滤条件拼接正确；processedAt 映射正确。
- WA-NQ-002 `neo4j/news.ts`（组合条件）
  - 输入: keyword+level+sortBy。
  - 输出: news[]。
  - 断言: where/order/params 正确；字段不混用 level/news_level。
- WA-NQ-003 `neo4j/analytics.ts`
  - 输入: start/end 时间。
  - 输出: stats。
  - 断言: 时间转 UTC；字段映射一致。
- WA-TZ-001 `TimeZoneUtils`
  - 输入: 北京时间/UTC 字符串。
  - 输出: 互转结果。
  - 断言: 时区正确；无效输入返回 false。
- WA-TZ-002 `formatTimeFields`
  - 输入: 对象/数组/空值。
  - 输出: 格式化后的数据。
  - 断言: 不修改非时间字段；空值安全。
- WA-AH-001 `api-helpers.parsePaginationParams`
  - 输入: page/limit 超界值。
  - 输出: page/limit/offset。
  - 断言: page>=1；limit<=100。
- WA-AH-002 `api-helpers.validateTimeRange`
  - 输入: 空/非法/反向/超范围。
  - 输出: isValid true/false + error。
  - 断言: 错误信息准确。
- WA-AH-003 `api-helpers.buildSuccessResponse`
  - 输入: data + timeFields。
  - 输出: NextResponse JSON。
  - 断言: 时间格式化正确；timezone=Asia/Shanghai。
- WA-API-001 `api/news` GET
  - 输入: NextRequest query；mock tzNews.getNewsWithPagination。
  - 输出: 200 响应。
  - 断言: pagination 计算正确；错误分支返回 buildErrorResponse。
- WA-API-002 `api/news/search` GET
  - 输入: 缺 q / 非法时间 / 正常查询。
  - 输出: 400/200。
  - 断言: 错误分支 status=400；searchInfo 字段完整。
- WA-API-003 `api/graph/stats` GET
  - 输入: mock tzAnalytics/tzGraph 成功/失败。
  - 输出: success true/false。
  - 断言: overview/timeStats/graphStats 存在。
- WA-API-004 `api/graph/hot-rank` GET
  - 输入: days/limit 缺省。
  - 输出: success true/false。
  - 断言: 默认 days=7/limit=20；错误分支返回 buildErrorResponse。
- WA-API-005 `api/graph/data` GET
  - 输入: query/nodeType/空。
  - 输出: success true/false。
  - 断言: 三分支调用 graphService 不同方法。
- WA-API-006 `api/graph/organizations` GET
  - 输入: searchTerm/空。
  - 输出: success true/false。
  - 断言: searchTerm 空时仍调用 searchEntities；count 正确。
- WA-API-007 `api/scan` POST
  - 输入: body 合法/非法；mock initializeServices/scanHighLevelNews。
  - 输出: 200/500。
  - 断言: 参数解析正确；错误分支带 timestamp。
- WA-API-008 `api/scan` GET
  - 输入: 无。
  - 输出: status JSON。
  - 断言: example_requests 各字段存在。
- WA-API-009 `api/scheduler` POST
  - 输入: trigger 枚举不同分支/未知 trigger。
  - 输出: success true/false。
  - 断言: 每个 trigger 分支响应 message；错误分支 status=500。
- WA-API-010 `api/summary` GET
  - 输入: 缺参/合法参数；mock summaryService.generateSummary。
  - 输出: 400/200/500。
  - 断言: 缺参返回 400；成功分支 message 与 period 结构正确。
- WA-API-011 `api/tingzi` POST
  - 输入: token 正确/错误。
  - 输出: 200/403。
  - 断言: token 错误直接拒绝；成功分支返回 processTingziMessage 结果。
- WA-SUM-001 `summary` 纯函数分组
  - 输入: 不同 level 的新闻数组。
  - 输出: 分组结果。
  - 断言: Level 1-5 顺序稳定；空数组安全。
- WA-SUM-002 `summary` 生成流程
  - 输入: 空新闻/高等级新闻/通知开关。
  - 输出: success true/false + data。
  - 断言: empty 分支标识；通知开关生效。
- WA-NOT-001 `notification`
  - 输入: Level 1/2 新闻数组。
  - 输出: 构建的通知文本。
  - 断言: 标题/级别/链接字段完整。
- WA-ROB-001 `robot.processTingziMessage`
  - 输入: 合法/非法 payload。
  - 输出: success/error。
  - 断言: 错误分支可序列化；成功分支结构稳定。

4) 接口契约快照（API 层必须）
- 为每个 API handler 建立“成功/失败”快照（字段集合 + 类型）。
- 任何接口变更必须更新快照，形成显式变更记录。

5) 固化 I/O 契约文档
- 新增 `docs/refactor-io.md`：记录 ingest 输出字段、时间单位、文件命名规则。
- 采样 `data/news/*.json` 进行字段核对（不改数据）。

6) 记录运行路径
- 写明本地/PM2/Docker 启动方式（可引用 README）。
- 记录最小手动验证链路：ingest 生成文件 -> graph 处理 -> web 读取。

**验收**
- 单测覆盖关键路径，且所有测试通过。
- 任意写入测试不触碰 `data/` 与正式 Neo4j。
- I/O 契约文档完整且与测试一致。
- 覆盖率满足阈值，API 层用例全部通过。
- 契约快照稳定，变更需显式更新。
 - Phase 0 覆盖率与用例清单核对见 `docs/refactor-phase0-audit.md`。

**回滚**
- 仅文档与测试代码变更，易于回退。

---

### Phase 1: 文件与时间修复（2-3 天）
**目标**: 修复时间单位问题，统一目录路径，消除竞态。

**任务清单**
1) 修复时间单位重复
- 修改 `packages/ingest-worker/src/storage/FileStorage.ts`:
  - `parseTime(item.time * 1000)` -> `parseTime(item.time)`
- 修改 `packages/ingest-worker/src/apis/news/list.ts`:
  - 同上（列表与时间范围接口）
- 补充回归点: 搜索 `rg "time \* 1000" packages/ingest-worker/src`

2) 目录初始化可等待
- 方案 A（更简单）: 构造函数改用同步 `fs.mkdirSync` 保障目录存在。
- 方案 B（更稳妥）: 增加 `private ready: Promise<void>` 并在每个 public 方法 `await`。
- 二选一，保持最小改动与一致性。

3) 路径绝对化
- ingest: `config.storage.path` 与 `FileStorage` 使用 `path.resolve` 输出绝对路径并记录日志。
- graph: `config.dataSource.newsDirectory` 也改为绝对路径并记录日志。
- 避免 `process.cwd()` 分支路径不一致。

4) 统一失败目录路径
- 抽取 `failedNewsDir` 到 graph-worker config 或 util；
- `EntityExtractionService` 与 `FailedNewsProcessor` 只从同一来源读取。

**验收**
- 时间范围过滤正确（可用固定数据文件验证）。
- 从 monorepo 根目录/单包目录运行，读写目录一致。

**回滚**
- 回退 FileStorage 与 config 变更即可。

---

### Phase 2: 数据模型与查询统一（2-4 天）
**目标**: level 字段、processedAt 语义统一，避免 UI/查询错乱。

**任务清单**
1) 统一 level 表示
- 选择 `news_level` 作为主字段（值为 `Level 1-5`）。
- graph-worker 查询改为 `n.news_level`；必要时保留 `n.level` 作为兼容写入。
- web-app 查询统一用 `n.news_level`；不要混用 `n.level`。
- UI 展示增加兼容: 将 `Level 1` 解析为 `1`（或直接显示 `Level 1`）。
  - 位置: `packages/web-app/src/app/news/page.tsx`

2) 补齐 processedAt
- 在 `EntityService.createNews` 写入 `n.processedAt = timestamp()`。
- 更新 `packages/graph-worker/DATABASE_SCHEMA.md` 增加该字段说明。
- 保持 web-app 的 `sortBy=processedAt` 逻辑不变。

3) 类型定义同步
- `packages/web-app/src/types/index.ts` 里 `NewsItem.level` 改为字符串或拆分为
  `level`/`levelNumber`，与查询结果一致。
- `packages/graph-worker/src/types/index.ts` 可补 `news_level?: string`。

**验收**
- `web-app` 列表与筛选结果一致（Level 显示正确）。
- graph-worker API 与 web-app API 的 level 字段语义一致。

**回滚**
- 保留 `n.level` 写入与查询做兼容，不删除旧字段。

---

### Phase 3: 图谱处理简化与安全（3-5 天）
**目标**: 去掉无效关系、减少危险拼接。

**任务清单**
1) 删除空关系创建
- `KnowledgeGraphService.processNews` 去掉空关系调用。

2) 推断关系参数化
- `RelationshipService.createInferredRelationships` 改为参数化 Cypher。
- 建议用 `UNWIND $pairs` 统一执行，避免模板字符串拼接。

3) 简化批处理路径
- `batchProcessNews` 中“提取 -> 写入 -> 建关系”流程明确化。
- 避免在内存中累积大型结构，保持分块。

**验收**
- 关系数不异常，处理失败文件仍可重试。

**回滚**
- 可单独回退 RelationshipService 与 KnowledgeGraphService 改动。

---

### Phase 4: 合并重复抽象（3-6 天）
**目标**: 减少漂移，降低重复维护成本。

**任务清单**
1) 建立 shared workspace（小步）
- 新建 `shared/common` 包，仅包含:
  - `constants/enums.ts`
  - 少量 time utils（UTC/Beijing 统一转换）
- 替换 web-app 与 graph-worker 的重复枚举引用。

2) 时间工具去重
- 保留 `TimeZoneUtils` 作为 web-app 单一入口；逐步移除 `frontend-time` 与 `timezone-wrapper` 的重复逻辑。
- graph-worker 继续使用 `timeUtils`，但核心方法保持一致语义。

3) 通知与 AI 服务
- 抽出最小公共接口或格式化工具到 `shared/common`，保留各包的发送实现。
- 避免大规模重写 AI 服务，只抽公共配置/日志结构。

4) 移除薄包装层
- 对 `QueryService`/`GraphService` 逐个审查；若仅转发一个调用则内联。

**验收**
- `pnpm -r build` 通过，无循环依赖。
- shared 包存在且被实际使用。

**回滚**
- shared 只做增量引入，保留旧模块直到迁移完成。

---

### Phase 5: 调度与摘要简化（3-5 天）
**目标**: 保留 graph-worker 与 web-app 两套调度链路，清晰区分职责并简化 Summary 逻辑。

**任务清单**
1) 调度职责明确
- graph-worker 调度器保留：负责底层数据处理与入库（稳定、长期不变）。
- web-app 调度器保留：负责用户侧任务与节奏调整（可随业务变化）。
- **硬性约束**：不得合并或移除任一调度器（已确认业务场景差异）。
- web-app 内部仍以 Web API 为触发入口；`scheduler.js` 只负责触发 API。
- 清理 web-app 内部重复触发路径，减少同一任务的双重执行风险。

2) SummaryService 拆分
- 拆成若干纯函数: `fetchNews`、`groupByLevel`、`buildPrompt`、`generateSummary`、`notify`。
- 并发控制使用简单 `limitConcurrency`，不引新依赖。

**验收**
- `GET /api/summary` 在相同时间区间输出稳定。

**回滚**
- 保留原入口一段时间，先在非生产环境验证。

## 5. 测试与验证矩阵
- **单测**
  - `pnpm --filter @drudge/ingest-worker test`
  - `pnpm --filter @drudge/graph-worker test`
- **代码质量**
  - `pnpm -r lint`
  - `pnpm -r format:check`
- **集成验证**
  - ingest 生成文件 -> graph 处理 -> web 查询
  - 若涉及 UI：必须 `chrome-devtools` 截图 + Console 检查

## 6. 交付与验收标准
- 每个 Phase 提交小步改动，具备明确回滚点。
- 文档与 schema 更新同步。
- 行为不破坏现有 API；如需变更需提供兼容层。

## 7. 风险与回滚策略
- **字段兼容性**: 保持 `level`/`news_level` 双写，逐步切换读取端。
- **路径变更**: 先打印日志，确认实际路径无误再清理旧路径。
- **查询变更**: 先在测试库/本地验证，避免线上数据污染。

## 8. 假设与待确认
- `news_level` 作为长期主字段是否确认？
- `processedAt` 的语义是否需要与 `created_at` 区分？
- `shared/neo4j` 目录是否要恢复或替换为 `neo4j/`？
