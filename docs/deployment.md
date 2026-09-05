# Drudge 最小发布手册（v1）

这份手册只解决一件事：让 AI 完成代码修改和检查后，把同一个 Git 提交安全地推到 GitHub，并在家庭 PVE 的 `tide` 容器中构建、重启和验证。

v1 不引入 GitHub Actions、自建 Runner、Webhook、新容器或复杂制品系统。GitHub 继续作为代码基线和审计记录，当前 Mac/Codex 作为发布控制端。

产品与架构边界见 [`architecture.md`](architecture.md)，本地实现和 review 见 [`development.md`](development.md)。本文是 GitHub 到 PVE 发布命令的唯一事实源。

## 1. 当前已验证的运行基线

- 本地仓库：`/Users/microTT/toto/ih/drudge`
- GitHub：`ZheLv-TideMetric-Investment/drudge`
- PVE 入口：`ssh home-pve`
- PVE 应用容器：`tide`，当前 CTID 为 `103`；CTID 每次发布前必须动态确认
- PVE 仓库：`/root/pre/drudge`
- Node.js：NVM 中的 `v24.3.0`
- pnpm：`10.12.4`
- 应用进程：PM2 管理 `ingest-worker`、`graph-worker`、`web-app`、`web-scheduler`
- Neo4j：独立 Docker 容器 `drudge-neo4j`
- 健康检查：
  - ingest：`http://127.0.0.1:39110/health`
  - graph：`http://127.0.0.1:39111/health`
  - web：`http://127.0.0.1:39112/`

PVE 的非登录命令环境找不到 NVM 中的 `node` 和 `pnpm`，所以所有 Node/pnpm 远程命令都必须通过 `bash -lc` 执行。

### 1.1 Web 运行配置更新

根 `.env` 是唯一运行配置入口。Next standalone 构建目录可能带有旧的 `.env` 副本；只修改根文件并重启，不足以证明 Web 已读取新配置。Web 与调度器应通过现有 `DOTENV_CONFIG_PATH` 明确使用根文件。

已获本次配置修改和重启授权、核对运行目标并保留原配置后，在应用容器中执行：

```bash
cd /root/pre/drudge/packages/web-app
DOTENV_CONFIG_PATH=/root/pre/drudge/.env pnpm exec pm2 restart web-app web-scheduler --update-env
```

这里按进程名称重启。现场验证 PM2 5.4.3 使用 `restart ecosystem.config.js --update-env` 时，并未导入命令前设置的 `DOTENV_CONFIG_PATH`。

重启后核对两个进程的配置路径和有效通知开关，只输出是否匹配，不输出完整环境；确认进程在线、简报健康端点正常后，执行 `pnpm exec pm2 save` 保存运行状态。停用通知同样修改根配置并重启两个进程。通知投递的验收要求见[钉钉简报手册](dingtalk-briefing.md#5-启用与验收)。

### 1.2 工作台入口

`ops/home-service.yaml` 只声明 `drudge.microzj.com`，简报和工作台均转发到 Tide 的现有 Web App：

| 路径 | 用途 | 访问方式 |
| --- | --- | --- |
| `/briefings/*`、`/_next/static/*`、favicon | 钉钉图片、简报详情与静态资源 | 直接访问 |
| `/`、`/news`、`/graph`、`/summary`、`/monitor`、`/stats`、`/tingzi`、`/api/*` | 工作台页面和接口 | 直接访问，无账号密码认证 |

使用 IH 的 `home-ingress/bin/home-ingressctl check/render` 生成 Drudge 自己的路由，再按[入口接入手册](../../home-ingress/SERVICE-ONBOARDING.md)安装到 101。路由变更和应用发布需在本次生产授权范围内；不增加业务进程或公网端口。

用户已明确要求先去掉工作台认证，manifest 使用 `public/none`，无需在 101 配置 owner 账号。工作台页面及扫描、总结、推送 API 均可直接访问；不再依赖代理认证标记。

在获授权的同次发布中，将根 `.env` 的 `BRIEFING_PUBLIC_BASE_URL` 更新为 `https://drudge.microzj.com`，再构建 Web 并重启 `web-app` 和 `web-scheduler`。构建时域名与运行时链接配置必须一致。替换 Drudge 自己的路由文件后不再保留旧 `news.microzj.com` 入口或跳转；历史消息里的旧域名链接会失效，持久化简报仍可在新域名用原 ID 访问。

若需要回滚，恢复对应的应用版本、根配置中的域名和 Drudge 路由文件；构建时与运行时的域名必须一致。

验收包括：无凭据访问工作台页面和只读 API 正常，不出现账号密码提示或原来的域名访问限制；简报和图片仍为 200；旧域名不再提供 Drudge 服务。浏览器的扫描、总结与消息操作先用本地模拟响应验收；生产点击发送需要明确授权。

监控页每 30 秒刷新，worker 端口复用根配置的 `INGEST_WORKER_PORT`、`GRAPH_WORKER_PORT`。图谱数据库未能完成检测时显示“未确认”；连通性结果不能代替新闻采集质量或 AI 处理结果的验收。

工作台的浏览器操作请求检查 `Origin` 和 Fetch Metadata，拒绝其他站点发起的扫描、总结等操作；不带浏览器来源头的内部调度调用保持兼容。新闻标题、正文和关键词按文本渲染，保留内容与高亮，不执行新闻源提供的 HTML。

## 2. 发布链路

```text
AI 在 codex/<task> 修改
  -> 本地 lint/test/build
  -> AI 检查 diff、测试结果和敏感文件
  -> 生成固定 commit SHA
  -> 用户批准一次发布 CHANGE_ID
  -> fast-forward 到本地 main 并推送 GitHub
  -> 通过现有固定 SSH 链路把同一 SHA 送入 PVE
  -> PVE install/build
  -> PM2 重启四个应用进程
  -> SHA、进程和 HTTP 健康检查
```

在当前任务已经明确授权本地 commit 的前提下，发布阶段默认只保留一个人工门：目标 SHA 固定且 AI 完成检查后，用户批准包含 GitHub push 和 PVE 部署完整命令的单次 `CHANGE_ID`。批准后其余步骤由 AI 连续执行；异常立即停止，不自动重试或换方案。

## 3. AI 开发与本地检查

从干净的 `main` 开始：

```bash
cd /Users/microTT/toto/ih/drudge
git status --short --branch
git switch main
git pull --ff-only origin main
git switch -c codex/<task-name>
```

AI 完成修改和测试后，必须依次通过：

```bash
pnpm install --frozen-lockfile
pnpm run verify
git diff --check
git status --short
```

AI Review 至少确认：

- 改动只覆盖当前需求，没有无关重构；
- 测试覆盖新增或变化的关键行为；
- `.env`、`data/`、`old_data/`、日志和 `*.bak-*` 没有被提交；
- 不包含 Token、Webhook、API Key、数据库密码或私人新闻正文；
- 没有数据库清理、Schema 破坏或 Neo4j 重建步骤；
- 明确区分“本地检查通过”和“PVE 已部署生效”。

只有用户已明确授权本次 commit 时，才执行下一段；否则在本地 review 和工作树状态处停止。只暂存明确文件，不使用宽泛的 `git add .`：

```bash
git add -- <file-1> <file-2>
git diff --cached --check
git diff --cached --name-only
git diff --cached --stat
git commit -m "<message>"
git rev-parse HEAD
git rev-parse HEAD^{tree}
```

此时 commit SHA 已固定，但尚未推送或部署。

## 4. 发布审批包

AI 在外部写入前展示：

- 唯一 `CHANGE_ID: DRUDGE-DEPLOY-<SHORT_SHA>-<YYYYMMDD>`；
- 目标 commit SHA 和 tree SHA；
- diff 摘要及实际通过的检查；
- GitHub 当前 `main`；
- PVE 动态确认的容器名称、CTID、当前 SHA 和 tracked 工作树状态；
- 本次完整 push、构建、重启、验证命令；
- 影响范围、停止条件和回滚分支名。

用户批准这个 `CHANGE_ID` 后，才能执行以下写操作。任何 SHA、CTID、命令或范围变化都需要新的批准。

## 5. 推送 GitHub

把开发分支 fast-forward 到 `main`：

```bash
cd /Users/microTT/toto/ih/drudge
git switch main
git merge --ff-only codex/<task-name>
git push origin main
git ls-remote --heads origin main
```

远端返回值必须与目标 SHA 完全一致。禁止 force push。

## 6. 部署到 PVE

### 6.1 发布前只读检查

```bash
bash /Users/microTT/pve-remote-ops/skills/home-pve-ops/scripts/check-home-pve.sh

ssh home-pve 'pct config 103'
ssh home-pve 'pct exec 103 -- git -C /root/pre/drudge symbolic-ref --short HEAD'
ssh home-pve 'pct exec 103 -- git -C /root/pre/drudge rev-parse HEAD'
ssh home-pve 'pct exec 103 -- git -C /root/pre/drudge status --short --untracked-files=no'
```

必须确认：

- 动态库存中的 `103` 仍是 `tide` 且正在运行；
- PVE 当前分支是 `main`；
- 没有 tracked 修改；
- 当前 SHA 是审批包记录的旧 SHA。

PVE 中保留的 `old_data/` 和 `*.bak-*` 不属于 Git 基线，不删除、不提交、不读取正文。

### 6.2 建立代码回滚点

先将旧 HEAD 保存为唯一分支。执行前把占位符替换为本次实际短 SHA：

```bash
ssh home-pve 'pct exec 103 -- git -C /root/pre/drudge branch pve-pre-deploy-<TARGET_SHORT_SHA> HEAD'
```

如果同名分支已存在，立即停止，不覆盖。

### 6.3 传输并切换同一提交

由于 PVE 到 GitHub 的 HTTPS 曾出现 TLS 中断，v1 使用已经验证过的固定 SSH 链路，从本地直接传输 Git 对象：

```bash
git -C /Users/microTT/toto/ih/drudge -c protocol.ext.allow=always push 'ext::ssh home-pve pct exec 103 -- git-receive-pack /root/pre/drudge' <TARGET_SHA>:refs/remotes/origin/main

ssh home-pve 'pct exec 103 -- git -C /root/pre/drudge rev-parse refs/remotes/origin/main'
ssh home-pve 'pct exec 103 -- git -C /root/pre/drudge switch main'
ssh home-pve 'pct exec 103 -- git -C /root/pre/drudge merge --ff-only origin/main'
```

`origin/main` 和合并后的 `HEAD` 都必须等于 `<TARGET_SHA>`。不处理冲突，不创建 merge commit。

### 6.4 PVE 安装和构建

```bash
ssh home-pve 'pct exec 103 -- bash -lc "pnpm -C /root/pre/drudge install --frozen-lockfile"'
ssh home-pve 'pct exec 103 -- bash -lc "pnpm -C /root/pre/drudge run build"'
```

安装或构建失败时停止，不重启 PM2。当前运行进程通常仍保留原来已加载的代码，但 web 构建目录是原位写入，仍需报告并评估。

### 6.5 重启应用

仓库不再提供旧的根级启动脚本或 Docker Compose 部署入口；不要自行恢复这些路径，也不要重建 Neo4j。只重启三个包级应用配置；web 配置会同时重启 `web-app` 和 `web-scheduler`：

```bash
ssh home-pve 'pct exec 103 -- bash -lc "pnpm -C /root/pre/drudge --filter @drudge/ingest-worker run pm2:restart"'
ssh home-pve 'pct exec 103 -- bash -lc "pnpm -C /root/pre/drudge --filter @drudge/graph-worker run pm2:restart"'
ssh home-pve 'pct exec 103 -- bash -lc "pnpm -C /root/pre/drudge --filter web run pm2:restart"'
```

### 6.6 验收

```bash
ssh home-pve 'pct exec 103 -- git -C /root/pre/drudge rev-parse HEAD'
ssh home-pve 'pct exec 103 -- git -C /root/pre/drudge rev-parse HEAD^{tree}'
ssh home-pve 'pct exec 103 -- git -C /root/pre/drudge status --short --untracked-files=no'

ssh home-pve 'pct exec 103 -- bash -lc "pnpm -C /root/pre/drudge --filter @drudge/ingest-worker exec pm2 ls --no-color"'

ssh home-pve 'pct exec 103 -- curl -sS -o /dev/null -w "%{http_code}" http://127.0.0.1:39110/health'
ssh home-pve 'pct exec 103 -- curl -sS -o /dev/null -w "%{http_code}" http://127.0.0.1:39111/health'
ssh home-pve 'pct exec 103 -- curl -sS -o /dev/null -w "%{http_code}" http://127.0.0.1:39112/'
```

成功条件：

- PVE HEAD 和 tree 与本地/GitHub 完全一致；
- tracked 工作树干净；
- 四个 PM2 进程均为 `online`；
- 三个 HTTP 检查均为 `200`；
- Neo4j 容器未被重建或重启；
- `.env` 仅包含本次明确批准的配置变更；既有 `old_data/`、`*.bak-*` 和业务数据未被触碰。

## 7. 失败与回滚

以下任一情况立即停止：

- SSH 预检、Host Key 或动态 CTID 不一致；
- GitHub/PVE SHA 与审批包不一致；
- PVE 存在 tracked 修改；
- push 不是 fast-forward；
- install、build、PM2 restart 或健康检查失败；
- 出现未批准的文件、服务、数据或命令范围。

如果失败发生在 PM2 重启前，不继续重启，先报告当前 Git、构建和进程状态。

如果新进程已启动但验收失败，使用新的受控变更批准回滚。回滚到本次部署前建立的分支：

```bash
ssh home-pve 'pct exec 103 -- git -C /root/pre/drudge switch pve-pre-deploy-<TARGET_SHORT_SHA>'
ssh home-pve 'pct exec 103 -- bash -lc "pnpm -C /root/pre/drudge install --frozen-lockfile"'
ssh home-pve 'pct exec 103 -- bash -lc "pnpm -C /root/pre/drudge run build"'
ssh home-pve 'pct exec 103 -- bash -lc "pnpm -C /root/pre/drudge --filter @drudge/ingest-worker run pm2:restart"'
ssh home-pve 'pct exec 103 -- bash -lc "pnpm -C /root/pre/drudge --filter @drudge/graph-worker run pm2:restart"'
ssh home-pve 'pct exec 103 -- bash -lc "pnpm -C /root/pre/drudge --filter web run pm2:restart"'
```

随后重新执行 PM2 和三个 HTTP 验收。不要使用 `git reset --hard`，不要删除数据、备份分支或构建目录。

代码回滚分支只是应用级回退点，不改变家庭 PVE 当前 `NO-RECOVERABLE-BACKUP` 的保护等级。数据库迁移、数据清理、Neo4j 重建和系统升级不进入这条自动链路。

## 8. v1 已知限制

- PVE 当前没有可见的 `pm2-*` systemd unit；容器重启后的 PM2 自动恢复尚未验证。
- 构建发生在当前工作目录，不是不可变制品或双目录原子切换。
- 发布依赖当前 Mac/Codex 能连接 `ssh home-pve`。
- v1 不自动处理失败重试、冲突、数据库迁移或依赖大版本升级。

这些限制不阻止日常小改动发布。先按本手册完成一次真实演练，再决定是否增加一键脚本、PM2 开机恢复或双目录发布。

## 9. 给 AI 的固定任务模板

```text
在 /Users/microTT/toto/ih/drudge 完成下面需求：<需求>。

从最新 main 创建 codex/<task>，只做必要改动并补测试。完成后运行：
pnpm run verify
git diff --check

先给我变更摘要、diff review、测试结果、commit SHA/tree SHA 和发布风险。
未经批准不要 push 或部署。需要发布时，严格按 docs/deployment.md 生成一个包含
GitHub push 与 PVE 部署完整命令的 DRUDGE-DEPLOY CHANGE_ID。
```
