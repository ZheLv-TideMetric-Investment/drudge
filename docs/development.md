# Drudge 开发与 AI 迭代手册

本文规定一次改动如何从需求走到可 review 的本地结果。生产发布另见 [发布手册](deployment.md)。

## 1. 环境准备

要求：Node.js `>=18`、pnpm `>=8`。

```bash
pnpm install --frozen-lockfile
cp env.example .env
```

只使用根 `.env`。测试本身会注入隔离配置，不应依赖生产密钥。

若只是阅读、修改和运行测试，不需要启动任何服务。只有做真实运行验证时才需要 Neo4j、数据源和 AI 配置。

## 2. 每次任务的最小流程

### 2.1 写变更合同

开始实现前，用四句话明确：

```text
目标：本次需要实现的可观察结果。
非目标：不顺手处理的相邻问题。
不变量：产品、数据、接口和发布中必须保持的行为。
验收：证明完成的测试、构建或真实观察。
```

如果目标依赖尚未确认的产品选择，先问用户；如果只是局部实现细节，使用最小合理假设并记录。

### 2.2 找到责任层

至少检查：

- 入口、调用方和同类实现。
- 当前类型与数据格式。
- 相关配置的唯一来源。
- 成功、失败、重试和超时路径。
- 现有单元测试、快照和 guard。
- 是否会写数据、调用 AI、访问网络或发消息。

常用检索：

```bash
rg --files
rg -n "<行为或字段>" packages shared docs
git log --oneline -- <相关文件>
```

不要先创建新模块再寻找放置理由。

### 2.3 实现最小完整变化

- 在真正拥有该责任的层修复规则。
- 优先扩展现有类型和服务，不复制平行流程。
- 不以字符串特判代替领域规则。
- 不新增暂时不用的配置、依赖、适配器或 fallback。
- 删除旧路径时同时删除入口、文档、测试和依赖，不留下“可能以后有用”的半套实现。
- 行为变化必须有测试；纯文档或确定未引用文件清理至少做链接、引用和构建检查。

### 2.4 两轮 review

第一轮检查“实现是否正确”：

- 需求的主路径是否真的经过新代码？
- 数据结构、时间、错误和返回值是否与调用方一致？
- 测试是否验证行为而不是重复实现？
- 是否泄露密钥或私人内容？

第二轮反向检查“还有什么会坏”：

- 空输入、重复输入、部分失败、超时和重启后会怎样？
- 是否可能重复推送、漏推、错误标记已处理？
- 是否改变现有 API、schema、调度、成本或生产启动方式？
- 删除项是否仍被脚本、文档、PM2 或 PVE 使用？
- 是否为一个案例增加了永久复杂度？

## 3. 检查命令

### 3.1 完整检查

```bash
pnpm run verify
git diff --check
git status --short
```

`verify` 的固定顺序是：

1. `pnpm run lint:env`
2. `pnpm run format:check`
3. `pnpm run lint`
4. `pnpm run test`
5. `pnpm run build`

根级测试以 `--runInBand --silent` 执行，减少并发资源波动和预期错误日志对 AI review 的干扰；测试失败和断言仍会输出。不能把部分单包检查描述成“全部通过”。

### 3.2 单包快速回路

```bash
pnpm --filter @drudge/ingest-worker run test --runInBand
pnpm --filter @drudge/graph-worker run test --runInBand
pnpm --filter web run test --runInBand
```

目标包修改时先跑目标测试，完成前仍应跑完整 `verify`。

### 3.3 覆盖率

```bash
pnpm --filter @drudge/ingest-worker run test:ci
pnpm --filter @drudge/graph-worker run test:ci
pnpm --filter web run test:ci
```

三个包的 CI 配置都要求全局 lines、branches、functions、statements 95%。普通 `test` 不统计覆盖率。

### 3.4 TypeScript 与格式

仓库没有独立根 `typecheck`：两个 worker 的 `build` 执行 `tsc`，Web 的 `build` 执行 Next build。

只在确实需要自动修复时运行：

```bash
pnpm run lint:fix
pnpm run format
```

自动修复后重新 review diff，避免全仓无关重排。

## 4. 副作用分级

| 操作                                   | 默认是否允许               | 原因                     |
| -------------------------------------- | -------------------------- | ------------------------ |
| 读源码、测试、Git 状态                 | 是                         | 只读                     |
| Jest、lint、format check、build        | 是                         | 测试已禁网并保护生产路径 |
| `pnpm --filter web run dev`            | 谨慎                       | 页面可能读取配置的 Neo4j |
| 启动 ingest-worker                     | 否，除非本次需要且环境隔离 | 访问真实新闻源并写文件   |
| 启动 graph-worker                      | 否，除非本次需要且环境隔离 | 调用 AI、写 Neo4j 和位点 |
| 启动 web-scheduler 或触发业务 POST API | 否，除非明确授权           | 可能调用 AI 或发钉钉消息 |
| 数据清理、schema 破坏、重建 Neo4j      | 否                         | 需要单独可回滚授权       |
| commit、push、PVE 部署或重启           | 否                         | 外部写入必须明确批准     |

`pnpm run dev` 会并行启动全部包，不是普通验收命令。

## 5. 测试约定

- 使用 Jest 与 `ts-jest`，测试放在各包 `tests/`。
- 新测试复用 `tests/helpers/`，文件使用临时目录。
- 网络通过现有 axios mock 或明确 fake；Neo4j、AI 和通知必须 mock。
- `tests/setup.ts` 的 no-network 和 no-prod-path guard 是安全边界，不得绕过。
- 时间敏感测试使用 fake time，并明确 UTC 与北京时间。
- 快照适合稳定 API 结构，不适合隐藏复杂业务断言。业务关键字段应直接断言。
- 修 bug 时覆盖通用规则和至少一个反例，不只复制事故输入。

## 6. UI 验证

代码和 Jest 不能证明页面真实呈现正确。涉及布局、交互、路由或浏览器行为时：

1. 只启动 Web 包。
2. 使用隔离 Neo4j 或明确的本地假数据。
3. 在真实浏览器验证目标 URL、视口和交互。
4. 检查 Console error、未处理 Promise 和失败请求。
5. 保存必要截图到 `artifacts/ui/`；该目录不提交。

默认不点击扫描、总结、调度和机器人测试入口。需要验证发送链路时，先明确消息目标和授权。

## 7. 数据模型变更

任何 Neo4j 节点、主键、关系、约束或索引变化都不是普通字段重命名。开始前必须提供：

- 旧数据规模与当前 schema 的只读检查。
- 新旧读写兼容策略。
- 前滚迁移命令和幂等性。
- 失败停止条件与回滚。
- 对文件位点、失败队列、Web 查询和 PVE 的影响。
- 相应的服务测试和数据库结构文档更新。

没有迁移方案时，不允许依靠“重建数据库”完成 schema 变化。

## 8. 依赖与目录整理

删除或移动前逐项确认：

1. `rg` 没有源码、测试、脚本和文档引用。
2. 不在 `package.json`、PM2、发布手册或运行入口中。
3. 不属于 `.env`、数据、位点、日志、卷或备份。
4. Git 历史可恢复，且删除不会改变现行生产路径。
5. 清理后执行依赖安装锁定、完整验证和文档链接检查。

依赖只在存在直接 import 或运行时明确需要时保留。删依赖必须同步 `package.json` 与 `pnpm-lock.yaml`。

## 9. 文档所有权

每类事实只维护一个主要入口：

| 事实                                 | 唯一主要文档                               |
| ------------------------------------ | ------------------------------------------ |
| 项目是什么、如何快速开始             | `README.md`                                |
| AI 权限、不可变边界、完成标准        | `AGENTS.md`                                |
| 产品核心、系统设计、数据流、已知债务 | `docs/architecture.md`                     |
| 钉钉简报、收件人和机器人配置         | `docs/dingtalk-briefing.md`                |
| 开发、测试、review、整理方式         | `docs/development.md`                      |
| GitHub 到 PVE 的发布与回滚           | `docs/deployment.md`                       |
| Neo4j 精确结构与迁移规则             | `packages/graph-worker/DATABASE_SCHEMA.md` |
| 环境变量名称与安全示例               | `env.example`                              |

文档可以互相链接，但不要复制整段动态命令或版本快照。源码新增能力后应更新对应主文档；不再有效的旧文档直接删除，不建立 `archive/` 垃圾场。

## 10. 重大决定记录

普通修复和小功能不需要 ADR。只有用户批准以下变化时才创建 `docs/decisions/YYYY-MM-DD-<topic>.md`：

- 产品核心或重要能力角色改变。
- 数据或 schema 迁移。
- 新服务、数据库、队列、框架或部署拓扑。
- 外部 API 的破坏性变化。
- 调度、消息保留或成本策略发生全局变化。

记录格式：

```markdown
# 标题

## 背景

## 决定

## 不做什么

## 备选方案

## 迁移与兼容

## 验证

## 回滚
```

决定落地后同步 `docs/architecture.md`，避免 ADR 变成无人读取的第二事实源。

## 11. 交付与发布衔接

本地交付报告包含：

- 结果和用户可观察变化。
- 关键文件及设计理由。
- 实际执行的检查与结果。
- 未验证项、已知风险和待确认问题。
- 当前 Git 状态；若已获 commit 授权，再给 commit SHA 与 tree SHA。

只有用户明确要求发布时，才进入 [发布手册](deployment.md) 的 CHANGE_ID 流程。本地检查通过、GitHub 已更新和 PVE 已生效是三件不同的事，必须分别举证。
