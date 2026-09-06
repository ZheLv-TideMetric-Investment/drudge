# AI 开发与验证

权限和产品边界见 [AGENTS.md](../AGENTS.md)，当前目标见 [README](../README.md)。本手册只维护“怎样定位、修改和验证”，生产操作见[部署手册](deployment.md)。

## 最小工作流程

1. 明确用户要看到的行为、这次不处理的范围、必须保持的契约和验收方式。
2. 找到入口、调用方、相似实现、相关测试与配置，确认真实副作用。
3. 在负责该行为的层做最小完整修改，补能检验规则的测试。
4. 按下表验证，检查 diff 中的无关变化、秘密和运行数据。
5. 对照成功与失败路径复核，同步事实所属文档，报告实际完成范围。

不确定业务含义时保留未知，不编造字段含义或看似合理的值；局部样式和实现细节可按现有惯例推进。

## 按任务定位代码

以下路径均相对仓库根目录；先搜索对应测试，再展开调用链。

| 任务 | 实现入口 | 主要测试 |
| --- | --- | --- |
| 原始源采集和文件落盘 | `packages/ingest-worker/src/services/`、`packages/ingest-worker/src/storage/FileStorage.ts` | ingest 的 `tests/services/`、`tests/storage/` |
| AI 抽取、消费位点与失败重试 | `packages/graph-worker/src/services/` | graph 的同名 service 测试 |
| 新闻/图谱/统计查询 | `packages/web-app/src/app/api/`、`packages/web-app/src/lib/neo4j/` | Web 的 `tests/apis/`、`tests/neo4j/` |
| 工作台页面与交互 | `packages/web-app/src/app/`、`packages/web-app/src/components/` | API/工具测试及真实浏览器 |
| 消息摘要图、H5、格式和投递 | [消息手册的源码导航](dingtalk-briefing.md#源码导航) | Web 的简报、通知和投递测试 |
| 定时任务与总结 | `packages/web-app/src/scripts/scheduler.js`、`packages/web-app/src/app/api/scheduler/route.ts`、`packages/web-app/src/lib/services/summary.ts` | Web 的 `tests/apis/scheduler.test.ts`、`tests/services/summary.test.ts` |
| 配置加载与校验 | `shared/common/utils/env.js`、三个包的配置入口 | 各包配置测试及 `lint:env` |

不要为定位一个页面而扫描生产数据，也不要把当前技术栈替换当成普通功能实现。

测试列的 `tests/` 相对各应用包目录；三个包都沿用同名 `tests/setup.ts` 和 `tests/guards/`。

## 检查范围

| 改动 | 必须完成的验证 |
| --- | --- |
| 纯文档 | 文件/锚点链接、源码引用、命令与脚本定义、Shell 语法、`git diff --check`；不必运行应用测试或构建 |
| 业务代码或配置 | 相关包测试，然后完整 `pnpm run verify`；新增配置同步模板与解析测试 |
| UI、路由或浏览器行为 | 上述代码检查，再用真实浏览器覆盖目标页面、交互、Console 和失败请求 |
| 消息展示与投递 | 本地合成样例、完整信息保留和载荷测试；实际钉钉验收按消息手册及用户授权执行 |
| schema 或数据迁移 | 独立确认兼容、迁移、回退与恢复前提；不能靠重建数据库通过验证 |

代码检查命令：

```bash
pnpm install --frozen-lockfile
pnpm run verify
git diff --check
```

`verify` 依次执行环境变量检查、格式检查、lint、全部 Jest 测试和三个应用构建。worker 的 `tsc` 与 Next build 同时承担类型检查；Web 的 postbuild 负责复制 standalone 静态资源。根命令的具体组成以 [package.json](../package.json) 为准。

快速回路只运行相关包，不能把它报告成完整验证：

```bash
pnpm --filter @drudge/ingest-worker run test --runInBand
pnpm --filter @drudge/graph-worker run test --runInBand
pnpm --filter web run test --runInBand
```

需要覆盖率时运行对应包的 `test:ci`，阈值以 Jest 配置为准。自动格式化只针对本次文件，不运行无关的全仓 `lint:fix` 或 `format`。

## 本地运行与副作用

根 `.env` 是唯一运行配置入口；`env.example` 只提供安全模板。Jest 沿用各包 `tests/setup.ts`，默认禁止真实网络并保护生产路径，使用临时目录和现有 mock。

浏览器验证只启动 Web 包，并使用隔离数据库或明确的本地模拟数据：

```bash
pnpm --filter web run dev
```

访问 `http://127.0.0.1:39112`。截图和模拟响应可放入忽略的 `artifacts/ui/`；不要保存私人新闻正文或凭据。模拟接口验证的是前端行为，不能证明真实数据库或投递链路正常。

下列动作不是普通只读检查：

- `pnpm run dev`、worker 启动、`web-scheduler`：可能抓取、调用 AI、写入数据或推送。
- `/api/scan`、`/api/scheduler`、`/api/tingzi` 的业务操作，以及 **`GET /api/summary`**：可能生成总结或发消息。
- `pnpm briefing:test-live`：真实发送一条模拟内容消息，仍需明确收件人与授权。
- Graph CLI 的 `db-health`、`db-stats`、`stats`：初始化可能创建约束和索引，不作为生产只读探针。

## Review 与交付

第一遍检查真实成功路径：代码被调用、结果符合契约、界面确实展示错误与空结果、消息没有遗漏完整信息。

第二遍检查失败与副作用：重复输入、部分失败、超时和重启后的行为；是否可能重复推送、漏推或错误标记成功；是否改变 API、配置、调度、成本或数据保留。

变更后更新 [README 文档索引](../README.md#ai-从这里接手) 中对应的主要文档。普通任务不增加第二份路线图或历史状态文件；重大决定才更新 ADR。

交付区分本地文件、Git 提交、GitHub 同步和生产生效。仅修改文档不需要重启应用；commit 和 push 仍遵循已有用户授权，不能把未同步的本地修改写成线上状态。
