# Drudge

Drudge 是一个持续采集实时财经快讯、使用 AI 结构化与总结，并将重要内容主动推送到钉钉的系统。

当前接入的数据源只有：

- 富途快讯（`futu_live`）
- AWTMT / 华尔街见闻（`awtmt_live`）

仓库目前没有独立的《华尔街日报》（WSJ）采集器。历史样例里出现 WSJ 文本，不代表已接入该数据源。

## 系统链路

```text
富途 + AWTMT
  -> ingest-worker 拉取、按来源去重、写入新闻文件
  -> graph-worker 扫描新文件、调用 LLM、写入 Neo4j
  -> web-app 查询、分级、聚合和生成总结
  -> 钉钉企业机器人向显式指定用户推送图片摘要 + H5 详情
```

三个运行服务都以北京时间执行调度：

| 模块                     | 责任                                     | 默认端口   |
| ------------------------ | ---------------------------------------- | ---------- |
| `packages/ingest-worker` | 数据源接入、文件落盘、采集状态与告警     | `39110`    |
| `packages/graph-worker`  | AI 实体/事件/关系抽取、Neo4j 写入与查询  | `39111`    |
| `packages/web-app`       | 页面、查询 API、Level 1 扫描、总结与通知 | `39112`    |
| `shared/common`          | 环境变量、枚举、时区、LLM 与通知公共能力 | 不单独运行 |

产品目的、数据契约和可变边界见 [架构手册](docs/architecture.md)。

## 仓库结构

```text
.
├── AGENTS.md                       # AI 必须遵守的仓库工作约定
├── README.md                       # 项目入口
├── docs/
│   ├── architecture.md             # 产品核心、架构与已知债务
│   ├── dingtalk-briefing.md         # 图片摘要、H5、收件人与机器人配置
│   ├── development.md              # 本地开发、AI 迭代与 review
│   ├── deployment.md               # GitHub -> PVE 唯一发布手册
│   └── decisions/                   # 经用户批准的重大工程决定
├── env.example                     # 唯一环境变量模板
├── packages/
│   ├── ingest-worker/
│   ├── graph-worker/
│   └── web-app/
├── shared/common/                  # Workspace 公共包
└── scripts/check-env-usage.sh      # 环境变量入口检查
```

运行数据、处理位点、日志、密钥和数据库卷不属于源码，均不会提交到 Git：

- `.env`
- `data/`，包括 `data/news/.processed/` 和 `data/news/failed/`
- `neo4j/`
- `logs/`、`*.log`
- 各包的 `dist/`、`.next/`、根 `node_modules/`

不要将这些目录当作“缓存”清理；它们可能是生产数据或恢复依据。

## 快速开始

要求：Node.js `>=18`、pnpm `>=8`，以及一个可连接的 Neo4j 5 实例。

```bash
pnpm install --frozen-lockfile
cp env.example .env
```

然后只在根 `.env` 中填写当前环境需要的配置。不要在包目录创建第二份 `.env`。

常用配置包括：

- Neo4j：`NEO4J_URI`、`NEO4J_USER`、`NEO4J_PASSWORD`
- AI：`AI_PROVIDER`、对应提供商 API Key 与模型名
- 数据目录：`STORAGE_PATH`、`NEWS_DIRECTORY`、`FAILED_NEWS_DIRECTORY`
- 通知：异常告警使用 `ALERT_WEBHOOK_URL`；主动推送使用企业机器人、一个显式的 `DINGTALK_TARGET_USER_ID` 与简报公网地址

完整字段和安全占位值都在 [env.example](env.example) 中。

主动推送默认关闭且没有默认收件人。机器人消息不依赖钉钉卡片模板，只承载一张紧凑摘要图和一个 H5 详情入口；配置与启用顺序见[钉钉简报手册](docs/dingtalk-briefing.md)。

## 验证

仓库级完整检查只有一个入口：

```bash
pnpm run verify
```

它依次执行环境变量规范、格式、lint、全部 Jest 测试和构建。测试默认禁止真实网络，并阻止写入仓库数据目录和常见生产路径。

快速验证单个包：

```bash
pnpm --filter @drudge/ingest-worker run test --runInBand
pnpm --filter @drudge/graph-worker run test --runInBand
pnpm --filter web run test --runInBand
```

覆盖率验收使用各包的 `test:ci`；普通 `test` 不采集覆盖率。

## 本地运行

仅查看 Web：

```bash
pnpm --filter web run dev
```

页面地址为 <http://127.0.0.1:39112>。页面会读取配置的 Neo4j；不要在未隔离的环境中点击扫描、总结、调度或机器人测试按钮。

单独启动 worker：

```bash
pnpm --filter @drudge/ingest-worker run dev
pnpm --filter @drudge/graph-worker run dev
```

`ingest-worker` 会访问真实新闻源并写文件；`graph-worker` 会读取文件、调用 AI 并写 Neo4j。只有在数据、数据库和通知均已隔离时才运行。

`pnpm run dev` 会并行启动全部包，副作用最大，不应作为普通 UI 检查命令。

健康检查：

```text
GET http://127.0.0.1:39110/health
GET http://127.0.0.1:39111/health
GET http://127.0.0.1:39112/
```

## 开发与发布

- AI 或开发者开始修改前，先读 [AGENTS.md](AGENTS.md) 和 [开发手册](docs/development.md)。
- Neo4j 节点、关系、约束和迁移规则见 [数据库结构](packages/graph-worker/DATABASE_SCHEMA.md)。
- GitHub 是共享代码基线，PVE 是生产运行环境。发布必须使用 [发布手册](docs/deployment.md)，不能直接在 PVE 修改源码。
- 未经明确批准，不 commit、不 push、不部署、不重启生产服务，也不发送钉钉消息。

## 当前工程基线

- pnpm workspace monorepo
- TypeScript workers，Express 5
- Next.js 15.3.5，React 18
- Neo4j Driver 5.28
- Jest 29
- PVE 上使用包级 PM2 配置运行四个进程：`ingest-worker`、`graph-worker`、`web-app`、`web-scheduler`

版本、模型、容器 ID 和线上 SHA 都可能变化；动态状态必须在操作前重新检查，不能把文档快照当作当前事实。
