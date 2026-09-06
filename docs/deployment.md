# 发布与运行状态

本文是 Drudge 生产状态、应用发布和回退的主要手册。应用源码留在本仓库，入口契约只在 [ops/home-service.yaml](../ops/home-service.yaml)；共享入口操作沿用 [Home Ingress 手册](../../home-ingress/SERVICE-ONBOARDING.md)。

## 最近发布快照

以下是 **2026-09-06 紧凑快讯图片发布完成时**的已验证结果，不是持续监控。下一次操作前必须重新确认动态状态。

| 项目 | 验收结果 |
| --- | --- |
| 应用提交 | `557db957a80b84504db9000b1fe3a88af575d78b` |
| 应用 tree | `fc985ba808a4aa32d8fed839f449a781b33dfed6` |
| 发布记录 | `DRUDGE-DEPLOY-557db95-20260906` |
| 展示版本 | `quick-2`，事件句与短背景、紧凑信息分组、全条目分页 |
| 代码位置 | 应用提交已同步 GitHub 和 Tide；后续纯文档提交与运行应用版本分开记录 |
| 进程 | 四个既有 PM2 进程 online，仅重启 `web-app` 和 `web-scheduler`，状态已保存；两个 worker 的 PID/启动时间未变 |
| 公网 | 七个工作台页面、简报健康端点、既有模拟简报 H5/SVG 均为 200，无认证挑战；模拟 SVG 与本地渲染器逐字节一致 |
| 分页 | 用户提供的既有简报分为两页，分别为 `720×1124`、`720×892`，均返回 200；无页码路径正常，非法页码返回 404 |
| 只读 API | 公网监控返回 200，Web、ingest、graph、Neo4j 四项连通性均为 true；三个应用健康端点为 200 |
| 浏览器 | 本地桌面/390px 手机预览通过；发布后的浏览器复验工具超时，未计为通过 |
| 通知 | 按既有用户授权保持开启，唯一显式收件人不变；本次发布未再手动发消息或调用 AI |
| 配置与入口 | Web 两进程显式读取根配置，构建与运行 Host 匹配 `drudge.microzj.com`；本次未修改配置或 Home Ingress 路由 |
| 运行边界 | Neo4j 容器 ID 与启动时间未变；未迁移或清理数据库、业务数据和消费位点 |

发布前完整验证通过：72 个套件、860 项测试，lint、格式/环境检查和三个应用构建通过；本服务 Home Ingress manifest 校验通过。生产执行 `pnpm install --frozen-lockfile` 和 `pnpm --filter web run build`。本次仅 Web 包变化，共享库、依赖和两个 worker 未变化，因此不重启 worker。

本次代码回退分支为 Tide 的 `pve-pre-deploy-557db95`，指向发布前提交 `3dd0b1a43c1ad44f6fa30206f5edafac521874b8`。无配置或路由变更，不为本次发布新增这些对象的副本。

2026-09-05 统一入口里程碑的回退材料仍保留，属于那次发布：

- Tide 代码分支：`pve-pre-deploy-3dd0b1a`，对应发布前提交 `c4f08934f1692693a8dea370c4ac47cf6b5eeb24`。
- Tide 根配置副本：`/root/pre/drudge/.env.bak-DRUDGE-DEPLOY-3dd0b1a-20260905`。
- 101 路由副本：`/etc/home-ingress/backups/drudge-3dd0b1a.caddy`。

本次原始记录位于本地忽略目录 `artifacts/DRUDGE-DEPLOY-557db95-20260906.md`；上述正式结论不依赖该目录可用。后续观察机器人实际呈现，详见 README 和消息手册。

## 运行位置与配置

| 对象 | 位置 / 职责 |
| --- | --- |
| 本地工作区 | `/Users/microTT/toto/ih/drudge`，修改与验证 |
| GitHub | `ZheLv-TideMetric-Investment/drudge`，main 作为共享代码基线 |
| 业务容器 | `tide`，最近现场 CTID 为 `103`，仓库 `/root/pre/drudge` |
| 入口容器 | CT101 `home-ingress`，只运行 Caddy 与共享隧道 |
| 应用进程 | `ingest-worker`、`graph-worker`、`web-app`、`web-scheduler` |
| 数据库 | 独立 Docker 容器 `drudge-neo4j`，普通应用发布不重启或重建 |
| 运行配置 | `/root/pre/drudge/.env`；实际值不写入仓库和文档 |
| 最近工具版本 | Node.js `v24.3.0`（NVM）、pnpm `10.12.4`、PM2 `5.4.3`；操作前核实 |

固定管理入口是 `ssh home-pve`。开始远程工作先读取现行 home-pve 运维规则并运行其固定预检，保持已固定的 SSH Host Key 和严格校验；不换公网端口、身份或连接路线。

PVE 的普通非登录 shell 找不到 NVM 工具。下方多行命令通过 `bash -ls` 从标准输入执行，以加载登录环境并避免多层引号。

### Web 根配置

Web standalone 目录可能含旧 `.env` 副本。仅修改根文件或按 ecosystem 文件重启，不能证明新配置已载入；`web-app` 和 `web-scheduler` 必须显式使用根 `DOTENV_CONFIG_PATH`。

在用户授权的配置变更中，先保留权限不变的根配置副本，只更新约定键。`BRIEFING_PUBLIC_BASE_URL` 影响 Web 构建域名，修改后必须重新构建，并按下方命名进程方式重启。

验收只输出“配置路径匹配、有效通知开关、单收件人合法、构建/运行 Host 匹配”等结果，不输出完整环境、用户 ID 或凭据。

## 公网入口

```text
HTTPS drudge.microzj.com
  → ECS :443 / Nginx
  → 共享回环隧道
  → CT101 Caddy
  → Tide Web App :39112
```

manifest 只声明一个 `web` component，`public/none`；工作台、API、`/briefings/*` 和静态资源都直接访问，不需要 owner 账号或代理认证标记。用户明确选择免登录，不在后续任务中自行恢复 Basic Auth。

原 `news.microzj.com` 入口已退出。旧消息里的旧域名 URL 会失效，持久化简报仍可在新域名用原 ID 访问。构建与运行消息配置都必须使用 `https://drudge.microzj.com`。

修改本服务入口时运行：

```bash
/Users/microTT/toto/ih/home-ingress/bin/home-ingressctl check --repo .
/Users/microTT/toto/ih/home-ingress/bin/home-ingressctl render --repo . --output /tmp/drudge.caddy
```

取得本次入口变更授权后，按共享手册安装生成的 Drudge 路由、校验并 reload。只替换自己的 `/etc/home-ingress/routes/drudge.caddy`，保留回退副本；不修改其他服务，也不新增 DNS、证书、iKuai 映射、隧道或公网端口。

## 发布约定

本地修改和验收 → 固定提交 → GitHub main → 固定 SSH 传输同一提交 → Tide 构建受影响应用 → 命名重启受影响进程 → 公网与现场验收。

执行 commit、push、配置修改、部署或重启前，确认它们在用户已授权的范围内。同一任务的授权持续有效；先把 SHA、目标、影响、命令和回退点整理成一份可 review 的 `DRUDGE-DEPLOY-<SHORT_SHA>-<YYYYMMDD>` 记录，不建立逐命令确认流程。尚缺授权时，把准备工作完成后一次性提出。

遇到目标不符、tracked 生产改动、非 fast-forward、安装/构建/健康失败立即停止；先定位原因，不 force push、自动解决生产冲突、切换传输路线或扩大发布范围。新目标、破坏性操作或更大影响要重新说明。

**仅文档变更不需要应用构建或生产重启。** 文档提交与实际运行应用版本分别记录，不为了让文档 SHA 与进程版本相同而重复部署。

## 应用发布步骤

以下是全应用发布模板。只有 Web 包变化且共享库、依赖未变时，构建使用 `pnpm --filter web run build`，重启只执行 Web 两进程的命名命令；核对两个 worker 持续运行。示例中的 `103` 只能在现场确认仍是 Tide 后使用；分支、SHA 和记录必须换成本次真实值。

### 1. 本地验证与固定提交

遵循[开发手册](development.md)完成检查和 review。只暂存明确文件，检查暂存 diff 后按已有授权提交；不使用 `git add .`，不包含 `.env`、数据、日志或构建产物。

固定提交后记录 `git rev-parse HEAD` 与 `git rev-parse 'HEAD^{tree}'`。发布前核对 GitHub main、本地 main、当前任务分支与生产旧提交，不覆盖无关工作。

### 2. 生产只读预检

```bash
bash /Users/microTT/pve-remote-ops/skills/home-pve-ops/scripts/check-home-pve.sh
ssh home-pve 'pct config 103'
ssh home-pve 'pct exec 103 -- git -C /root/pre/drudge symbolic-ref --short HEAD'
ssh home-pve 'pct exec 103 -- git -C /root/pre/drudge rev-parse HEAD'
ssh home-pve 'pct exec 103 -- git -C /root/pre/drudge status --short --untracked-files=no'
```

确认容器与进程、分支 main、旧 SHA、tracked 工作树干净。生产 `old_data/`、备份和运行数据不是 Git 冲突，不清理或提交。记录必要进程和 Neo4j 元数据，便于直接验收，避免全系统审计。

### 3. GitHub 与同一提交传输

本地示例变量不包含秘密；填写并核对真实值后执行：

```bash
DRUDGE_TASK_BRANCH='codex/replace-with-task'
DRUDGE_TARGET_SHA='replace-with-approved-40-character-sha'
[[ "$DRUDGE_TARGET_SHA" =~ ^[0-9a-f]{40}$ ]] || exit 1
DRUDGE_SHORT_SHA="${DRUDGE_TARGET_SHA:0:7}"

git switch main
git merge --ff-only "$DRUDGE_TASK_BRANCH"
test "$(git rev-parse HEAD)" = "$DRUDGE_TARGET_SHA" || exit 1
git push origin main
git ls-remote --heads origin main
```

GitHub 返回的 SHA 必须与目标完全一致。通过后，先在 Tide 保存旧提交；同名回退分支已存在时停止，不覆盖：

```bash
ssh home-pve "pct exec 103 -- git -C /root/pre/drudge branch pve-pre-deploy-${DRUDGE_SHORT_SHA} HEAD"
git -c protocol.ext.allow=always push 'ext::ssh home-pve pct exec 103 -- git-receive-pack /root/pre/drudge' "${DRUDGE_TARGET_SHA}:refs/remotes/origin/main"
ssh home-pve 'pct exec 103 -- git -C /root/pre/drudge rev-parse refs/remotes/origin/main'
ssh home-pve 'pct exec 103 -- git -C /root/pre/drudge merge --ff-only origin/main'
ssh home-pve 'pct exec 103 -- git -C /root/pre/drudge rev-parse HEAD'
```

核对目标引用与 HEAD 都是该 SHA 后才继续。配置变化先精确保留副本，只修改获授权键。

### 4. 安装与构建

```bash
ssh home-pve 'pct exec 103 -- bash -ls' <<'DRUDGE_BUILD'
set -e
cd /root/pre/drudge
pnpm install --frozen-lockfile
pnpm run build
DRUDGE_BUILD
```

失败不继续重启。构建在原目录发生，Web 构建目录可能已变化，不能假定旧进程继续运行就等于没有影响。

### 5. 重启四个进程

两个 worker 使用既有包级脚本；Web 使用按名字重启并明确根配置的已验证方式：

```bash
ssh home-pve 'pct exec 103 -- bash -ls' <<'DRUDGE_RESTART'
set -e
cd /root/pre/drudge
pnpm --filter @drudge/ingest-worker run pm2:restart
pnpm --filter @drudge/graph-worker run pm2:restart
cd packages/web-app
DOTENV_CONFIG_PATH=/root/pre/drudge/.env pnpm exec pm2 restart web-app web-scheduler --update-env
pnpm exec pm2 ls --no-color
DRUDGE_RESTART
```

不要用 `restart ecosystem.config.js --update-env` 代替 Web 命名重启：现场曾验证该方式没有导入命令前设置的 `DOTENV_CONFIG_PATH`。域名或入口变更按前述入口流程同步。

### 6. 验收与保存

- 核对生产 HEAD/tree、tracked 工作树、四个进程 online，Web 两进程根配置路径与有效通知配置符合本次目标。
- 检查 ingest `:39110/health`、graph `:39111/health`、web `:39112/briefings/health`。
- 公网检查工作台、只读查询、简报 H5 与 SVG；浏览器检查实际页面和 Console。只有动到路由时才验证 Caddy/reload 与域名退出结果。
- Neo4j、业务数据、位点和非授权配置没有变化。监控可达、API 成功和消息投递分别报告；没有消息授权时不点击扫描、生成或推送。

上述通过后保存 PM2 状态：

```bash
ssh home-pve 'pct exec 103 -- bash -ls' <<'DRUDGE_SAVE'
set -e
cd /root/pre/drudge/packages/web-app
pnpm exec pm2 save
DRUDGE_SAVE
```

随后更新本文的最近发布快照。仅列实际验证内容，测试结果不能替代真实运行验收。

## 失败与回退

先报告失败发生在提交、配置、构建、进程或入口的哪一层。回退在既有授权覆盖的范围内执行，否则完成具体方案后取得授权。

使用本次保留的代码分支切回原版本，必要时恢复对应根配置和 Drudge 路由副本；再按本手册安装/构建、命名重启、校验与保存。Web 构建 Host、运行配置和入口要一致。不要通过 `git reset --hard`、删除数据或恢复隐式群发来回退。

代码与配置副本只是应用回退点，不能替代家庭环境的可恢复数据备份。数据库迁移、数据清理、卷变更、Neo4j 重建和系统升级不属于此流程。

## 已知限制

- 容器重启后 PM2 的自动恢复尚未验证；`pm2 save` 不证明已配置系统开机恢复。
- 使用原目录构建，不是不可变制品或双目录原子切换；发布依赖当前控制端可用的固定 SSH 链路。
- 不引入 GitHub Actions、Runner、Webhook、新容器或升级操作系统作为日常发布前提。
- 2026-09-05 GitHub 推送报告既有 170 项依赖安全告警，含 5 项 critical。本次未核定可利用性或升级依赖，告警不等于已发生漏洞利用；处理时以届时仓库告警为准。

这些限制保留为事实，不自动变成下一阶段消息优化的任务。
