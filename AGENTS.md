# Drudge AI 工作约定

本仓库后续主要由 AI 维护。本文件规定 AI 可以怎样修改代码，以及哪些边界不能自行改变。

## 1. 开工顺序与事实优先级

每次任务按以下顺序读取和核验：

1. 本文件：行为边界与完成标准。
2. [`docs/architecture.md`](docs/architecture.md)：产品核心、数据流和架构边界。
3. 与需求直接相关的源码、测试、`package.json` 和配置。
4. [`docs/development.md`](docs/development.md)：实现、检查和 review 流程。
5. 只有涉及发布时才读取 [`docs/deployment.md`](docs/deployment.md)。

事实冲突时，优先级为：用户当前明确要求 > 当前源码与测试 > 架构手册 > 其他文档和历史注释。发现冲突必须修正文档或明确报告，不能安静地选择方便的一份。

开始写代码前必须先搜索相似实现、调用方、测试、配置和运行入口。不要凭 README、记忆或函数名猜测行为。

## 2. 不得自行改变的产品核心

Drudge 的核心目的不是“做一个知识图谱”，而是：

> 持续获取实时财经信息，保留关键事实，用 AI 将其组织成可快速阅读的高信息密度内容，并可靠地主动推送给用户。

AI 不得在普通功能迭代中改变以下原则：

- 实时采集、处理、总结、主动推送这一主链路必须保持可用。
- 原始信息和关键事实优先。可以聚合、去重、分组和改写，但不能为了好看而静默删掉重要数字、时间、主体、来源、事件或链接。
- 总结必须区分事实与推断，不编造来源中没有的信息。
- 数据处理必须可追踪、可重试，不能以“看起来成功”替代真实成功。
- AI 模型、新闻源、存储和展示技术是可替换实现，不是产品信仰；替换时必须保持能力与数据契约。
- 方案以简单、可运行、可维护为先，不把仓库演化成通用平台。

当前接入源是 `futu_live` 和 `awtmt_live`。仓库没有独立 WSJ 采集器，不得在文档或代码里误称已接入《华尔街日报》。

Neo4j、Web UI 和婷子机器人是受保护的当前能力，但尚未被确认是永远不可替换的产品核心。AI 不得自行删除或整体替换；如要调整其角色，先向用户说明收益、迁移、兼容和回滚并取得确认。

## 3. 当前架构责任边界

```text
数据源
  -> ingest-worker
  -> data/news/*.json
  -> graph-worker
  -> Neo4j
  -> web-app / web-scheduler
  -> 钉钉企业机器人显式单聊（图片摘要 + H5 详情）
```

- `packages/ingest-worker`：只负责外部新闻源、源内去重、规范化和文件落盘，不承担图谱和业务总结。
- `packages/graph-worker`：只负责文件消费、AI 抽取、Neo4j 写入、失败重试和图查询，不承担原始源抓取。
- `packages/web-app`：负责页面、查询 API、高级别扫描、摘要编排和用户消息。
- `shared/common`：放真正跨包且已复用的环境变量、时区、枚举、LLM/通知公共能力。不得把单包实现提前抽成“公共框架”。
- 根 `.env` 是唯一运行配置入口；`env.example` 是唯一模板。

包之间优先通过明确的数据格式、HTTP/数据库边界或 `@drudge/common` 协作。不要跨包深层导入另一个包的 `src/`。

## 4. 数据与运行态硬边界

以下内容不是普通源码，也不是清理对象：

- `.env` 和所有真实密钥、数据库密码、完整 Webhook URL。
- `data/`、`old_data/`、`neo4j/`、日志、`*.bak-*`、PM2 状态和容器卷。
- `data/news/.processed/*.processed`：graph-worker 的文件消费位点；删除会重放历史文件。
- `data/news/failed/`：失败新闻和重试证据。

未经独立、精确、可回滚的授权，不得调用或执行：

- 采集清理 API 或 `FileStorage.cleanOldFiles`。
- Graph CLI 的 `db-clean*`、失败文件清理或 `Neo4jService.clearDatabase`。
- 删除或移动生产数据、重建 Neo4j、改变卷挂载。
- 宽泛的 `git clean`、`rm -rf`、`git reset --hard`。

测试必须沿用现有 `tests/setup.ts` 的禁网和生产路径保护，使用临时目录并 mock 网络、数据库、AI 与通知。不得为让测试通过而关闭 guard。

日志、测试快照、截图、文档和 diff 中不得出现密钥、私人新闻正文或完整 Webhook URL。

## 5. AI 变更合同

实现前先在工作记录中写清四件事；小任务可以各用一句：

- 目标：用户最终会得到什么行为。
- 非目标：这次明确不处理什么。
- 不变量：哪些产品、数据、接口或发布行为必须保持。
- 验收：用什么测试或观察证明完成。

然后按以下步骤工作：

1. 定位正确责任层和已有先例。
2. 先修规则或边界，再修具体样例。
3. 做最小完整改动，并补能防止复发的测试。
4. 运行目标包检查，再运行仓库级 `pnpm run verify`。
5. 做一次实现 review 和一次反向 review：检查误报、漏报、副作用、失败路径和兼容性。
6. 若事实、命令、数据契约或边界变化，同步更新唯一对应文档。

一个修复不应只匹配用户刚给出的字符串或新闻样例。测试至少覆盖“通用规则 + 一个边界或反例”。确实只能特判时，代码旁写明业务来源、适用范围和删除条件。

## 6. 防止 case-by-case 和过度设计

默认约束：

- 新概念预算为零：先使用现有模块、函数、类型、配置和依赖。
- 一个案例不建立框架；两个相似案例优先局部 helper；第三次稳定重复才评估抽象。
- 不为假设中的未来需求增加服务、队列、缓存、插件系统、通用规则引擎或多层适配器。
- 不同时保留“旧实现 + 新实现”而没有迁移期限、流量选择方式和删除条件。
- 不增加无上限重试、静默 fallback 或自动换供应商。任何重试必须有次数、等待、可观察失败和停止条件。
- 不新增 Feature Flag、环境变量或配置项来逃避明确决策。只有不同环境确实需要不同值时才配置化。
- 新依赖必须当前就被使用，并明显减少自研复杂度；能用标准库或现有依赖完成时不增加。
- 不做与当前任务无关的全仓重命名、格式化、依赖升级或抽象重排。

出现以下任一情况必须先停下来向用户说明，而不是自行扩大设计：

- 改变产品核心、通知的信息保留原则或事实与推断边界。
- 改变新闻文件格式、处理位点、失败队列或 Neo4j schema，需要迁移现有数据。
- 改变外部 API、调度频率、消息发送条件、成本或数据保留周期。
- 新增运行服务、数据库、队列、框架、部署拓扑、鉴权或安全权限。
- 整体替换 Neo4j、Web UI、钉钉或婷子通道或任一数据源。
- 需要删除数据、解决生产冲突、force push、回滚或改变既有发布范围。

经用户批准的重大决定，要在 `docs/decisions/YYYY-MM-DD-<topic>.md` 记录背景、决定、替代方案、迁移和回滚，并同步架构手册。普通 bugfix 和小功能不要写 ADR。

## 7. 代码与配置约定

- 技术基线：pnpm workspace、TypeScript、Express 5、Next.js 15.3.5、React 18、Neo4j 5、Jest 29。
- 沿用当前命名、边界层 `try/catch`、结构化 API 错误和 worker Winston 日志。
- 不吞掉影响数据一致性、通知结果或发布验收的错误。
- Web 现有 `console` 可逐步收敛，但不得顺手做全仓日志重构。
- 环境变量通过 `@drudge/common` 的 `buildIngestConfig`、`buildGraphConfig`、`buildWebConfig` 读取。
- 新环境变量必须加入 `env.example`、共享配置解析和测试，并通过 `pnpm run lint:env`。
- 数据模型以 `packages/graph-worker/src/types/`、实体或关系服务和 `Neo4jService.ts` 为代码事实；同步维护数据库结构文档。
- 数据源、AI 提供商和通知传输都应保持边界清楚，业务格式化不要散落在传输实现中。
- 主动推送只在消息中展示紧凑摘要图；完整简报必须先持久化并由 `/briefings/<id>` 提供。图片只负责扫读，不能成为唯一信息载体。
- 简报与工作台统一使用 `drudge.microzj.com`。按用户 2026-09-05 的明确要求，当前采用 `public/none`，工作台页面与 API 不加账号密码认证；保留浏览器跨站操作校验。不得自行重新加入登录层。钉钉接口凭据、通知开关和显式收件人规则保持不变。

## 8. 安全运行与验证

安装：

```bash
pnpm install --frozen-lockfile
```

完整静态与本地验证：

```bash
pnpm run verify
git diff --check
git status --short
```

`pnpm run verify` 包含：`lint:env`、`format:check`、`lint`、全部测试和构建。两个 worker 的 `tsc` 与 Web 的 Next build 同时承担 typecheck。

快速单包测试：

```bash
pnpm --filter @drudge/ingest-worker run test --runInBand
pnpm --filter @drudge/graph-worker run test --runInBand
pnpm --filter web run test --runInBand
```

UI 改动还必须在真实浏览器验证目标页面、Console 和失败请求；默认只读。以下动作可能访问真实系统、调用 AI 或发消息，未经授权不得触发：

- `pnpm run dev` 或启动任一 worker。
- 启动 `web-scheduler`。
- 首页操作以及 `POST /api/scan`、`POST /api/scheduler`、`POST /api/tingzi`。
- 带通知参数的摘要请求。

UI 默认地址是 `http://127.0.0.1:39112`，关键页面为 `/`、`/news`、`/graph`、`/stats`、`/monitor`、`/summary`、`/tingzi` 与 `/briefings/<id>`。

## 9. GitHub 与 PVE

- 本地工作区用于修改和验证。
- GitHub `main` 是共享代码与审计基线。
- PVE 是生产运行环境，不直接编辑源码。

未经用户本次明确授权，不 commit、不 push、不部署、不重启服务、不发送消息。

发布严格按 [`docs/deployment.md`](docs/deployment.md) 执行。发布前动态确认分支、目标 SHA、PVE 容器 ID、远端状态和 PM2 进程；文档中的旧快照不是永久事实。

每次外部写入都使用目标 SHA 和命令固定的 `DRUDGE-DEPLOY-*` CHANGE_ID。命令、目标或范围变化时必须重新批准；不自动重试、不换 SSH 或 HTTPS 方案、不解决冲突、不 force push。

生产日常发布只涉及包级 PM2 配置中的 `ingest-worker`、`graph-worker`、`web-app`、`web-scheduler`。Neo4j 容器、数据库、卷和 PVE 宿主机不在普通发布范围。

## 10. 完成与交付

完成任务至少满足：

- 行为符合变更合同，未改变非目标和不变量。
- 测试覆盖关键成功、失败和边界路径。
- 相关检查真实执行并报告结果；未运行的项目必须明确写出。
- diff 中没有无关改动、生成物、数据或秘密。
- 文档与实现一致，没有新增第二事实源。
- 清楚区分静态检查、本地运行、GitHub 更新和 PVE 生效四层证据。

最终报告只需包含：结果、关键改动、验证、剩余风险或待确认项。不要用“应该没问题”代替证据。

<!-- home-ingress:managed:start -->

## 家庭 HTTP 入口

本服务仍由当前仓库负责。对外提供 HTTP 服务时：

1. 先读当前仓库的 `ops/home-service.yaml`；
2. 再读 IH 工作区 `home-ingress/SERVICE-ONBOARDING.md`；
3. 用 Home Ingress 项目的 `bin/home-ingressctl check` 校验；
4. 用 `render` 生成本服务自己的 Caddy 路由；
5. 不为服务新增 iKuai 映射、ECS 公网端口、DNS、证书、RAM 或隧道。

入口契约：`home.microzj.com/v1`

<!-- home-ingress:managed:end -->
