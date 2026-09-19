# 发布与运行状态

本文是 Drudge 生产状态、应用发布和回退的主要手册。应用源码留在本仓库，入口契约只在 [ops/home-service.yaml](../ops/home-service.yaml)；共享入口操作沿用 [Home Ingress 手册](../../home-ingress/SERVICE-ONBOARDING.md)。

## 最近发布快照

**2026-09-19：历史摘要本地优先。**

用户要求默认优先本地 Qwen3.5-9B，但以质量合格为前提；手动停止表示让出 Windows，
业务不得重新启动模型，改用千问云端。Windows 空闲卸载已改为 10 分钟，具体单元、
桌面启停与内网接入由 IH `home-llm/README.md` 维护。用户批准的阶段方案已发布：

- 历史摘要优先 `qwen3.5:9b`，手动停止、本地不可用或超限时转 `qwen3.7-flash`。
- 图谱抽取与最终 Markdown 继续 `qwen3.7-flash`；Graph 的其他备用仍停用。
- 仅新增 `WEB_LOCAL_AI_BASE_URL=http://192.168.1.50:11436` 和
  `WEB_LOCAL_AI_ONLY_SIMPLE=true`；全局及 Graph 本地地址留空，原输入不截断。

应用提交 `a62f4656b12c7caa37c01f9518391ba010c5b65b`，tree
`84c0e3aebc68fe390c90a714b654e4462d829eb7` 已同步 GitHub main 和 Tide；发布记录
`DRUDGE-DEPLOY-a62f465-20260919`。Tide 完成锁文件安装与 Graph / Web 构建，16:40
（北京时间）仅命名重启 `graph-worker` / `web-app`，PID 为 `3511988` / `3512002`。
两进程显式读取根配置，合并 PM2 环境后的有效路由符合上述范围。采集 PID `1200`、
调度 PID `1211` 及启动时间未变；四进程 online，PM2 状态已保存。

Windows Ollama 保持监听回环。仅允许 Tide `192.168.1.11` 访问 Windows
`192.168.1.50:11436`，转发至 `127.0.0.1:11434`；其余 IPv4 来源显式阻止。
实测 Tide 可达、PVE 宿主来源连接超时；监听地址及两条防火墙规则已核对。
没有新增公网入口、SSH 常驻转发或自动启动；Windows 任务自动触发器为 0，
Ollama systemd 单元仍 disabled，空闲保留为 `10m`。

### 验证与回退

完整 `pnpm run verify` 通过：74 个测试套件、899 项测试及三个应用构建。
在 Tide 使用实际已发布的 AI 服务代码、根配置、历史提示词和合成文本完成：

| 真实调用阶段 | 结果 |
| --- | --- |
| 本地服务已启动 | 10.7 秒，1 次本地推理、0 次云端调用；保留审批未完成、投资未实施 |
| 执行现有桌面停止入口后 | 2.6 秒，0 次本地推理、1 次千问调用；模型 API 仍关闭、任务 Ready |
| 再次执行手动启动入口后 | 10.7 秒，恢复 1 次本地推理、0 次云端调用 |
| 显存与保留时间 | 16K 上下文全部在 GPU，API 报告约 5.9 GB；请求结束后剩余 600 秒 |

三个应用健康、公网首页/健康、既有简报 HTML/PNG/SVG 均为 200，监控四项服务
可用，通知保持开启。Neo4j 容器与启动时间未变；没有手动触发真实简报、消息投递、
历史重放或数据清理。合成验证不写数据库或快照；正常定时任务的新历史摘要调用尚未
在本轮短时间窗口出现，因此上述证明服务链路与切换，不代替长期质量和节省比例评估。
交付时本地服务已恢复启动；之后用户手动停止或电脑重启，仍须用户再次点击启动。

回退材料与范围：

- `pve-pre-deploy-a62f465` → `4c6ebf85b0344c398a414f60a0034744361aecd3`。
- 根配置副本 `/root/pre/drudge/.env.bak-DRUDGE-LOCAL-a62f465-20260919T083751Z`。
- 应用回退时使用该代码基线、只还原本次两个 Web 本地配置键，再构建并命名重启 Graph / Web；
  保留之前的千问选择、重试修复以及所有新闻、失败记录和位点。
- Windows `D:\a\home-llm\remove-drudge-access.ps1` 仅删除本次 11436 转发和两条规则；
  模型、启停脚本与其他服务不变。10 分钟配置的旧单元副本为
  `/etc/systemd/system/ollama.service.bak-drudge-20260919-155019`。

### 费用调查与质量边界

费用暴增与日志中的重复调用一致，以下仅为现有应用日志统计，不是云账单对账：

| 北京时间 | 不同新闻数 | 抽取启动次数 | 千问主调用失败 | 其中未调用工具误判 |
| --- | ---: | ---: | ---: | ---: |
| 09-10 | 518 | 518 | 4 | 4 |
| 09-12 | 196 | 1402 | 6295 | 6295 |
| 09-15 | 591 | 5737 | 27638 | 27637 |
| 09-18 | 435 | 5131 | 24708 | 24705 |

9 月 11 日起，失败后的多轮尝试与后续扫描重复处理持续放大调用；9 月 15 日一条
新闻最多进入抽取 42 次，每次还可触发原来的五轮尝试。与之前“每月 50 元”不同，
用户账单截图在 9 月 14–18 日约为每天 13–15 元。

14:24 的已发布修复后，观察至 15:43：19 条不同新闻、19 次成功调用、每条最多一次，
输入 57181、输出 8200 Token，未再记录工具误判或备用切换。按百炼当日 Qwen3.7 Flash
小于 32K 的公开原价（输入 0.2 / 输出 0.8 元每百万 Token）约为 0.018 元；这是短
时间样本估算，不是完整月账单，也不包含缓存和优惠。旧日志缺少逐条用量，不能精确
还原历史费用。单价来源为[百炼价格](https://help.aliyun.com/zh/model-studio/model-pricing)。

本地质量验证区分三类任务：历史摘要收紧事实约束后，三组合成时间线通过人工核对；
复杂图谱与最终 Markdown 仍有实质语义偏差，不能直接全量切换。四条现用云模型的
合成对照也复现部分关系和时区问题，因此不把所有偏差归因于模型参数量。Graph 提示词
实验没有保留，最终简报模板保持原状；仅历史摘要提示词强化了不补写因果和确定性。

## 原生 Markdown 发布快照（2026-09-08）

以下是 **2026-09-08 原生 Markdown 发布后**的已验证结果，不是持续监控。下一次操作前必须重新确认动态状态。

| 项目 | 验收结果 |
| --- | --- |
| 应用提交 | `43f7449a20510f6828e9052193331991ae86d6ff` |
| 应用 tree | `22ae60720be1e673a5c903d54f1c1dcf91c3690b` |
| 发布记录 | `DRUDGE-DEPLOY-43f7449-20260908` |
| 展示与投递 | 原生 Markdown：全部事件文字、已有时间、显式重点加粗、可选一句历史和一个 H5 链接；新消息不含图片引用 |
| 编译产物 | Web 构建成功，产物包含 `explicit_single_user_markdown_h5`，不含旧图片消息 mode |
| 代码位置 | 应用提交已同步 GitHub main 和 Tide；后续纯文档提交与运行应用版本分开记录 |
| 进程 | 四个既有 PM2 进程 online，20:28:54（北京时间）仅重启 web-app / web-scheduler，PID 为 3417348 / 3417360；两个 worker PID/启动时间未变，PM2 状态已保存 |
| 历史图片 | 既有模拟 PNG 与 SVG 均 HTTP 200、与上一版结果逐字节一致；PNG 为真实 `image/png`，960×356 / 20472 字节 |
| 路由 | 公网首页、简报健康、既有模拟 H5/PNG/SVG 均为 200，无认证挑战 |
| 只读 API | 公网监控四项可用性均 true；三个应用健康端点均 200 |
| 通知与配置 | 有效通知保持开启，唯一收件人合法，凭据存在；Web 两进程读取根配置，公网 Base URL 匹配 drudge.microzj.com |
| 数据与入口 | 无快照迁移或清理；Neo4j 容器 ID 与启动时间未变；配置、Home Ingress、认证和调度规则未修改 |

本地验证：73 个套件、880 项测试，完整 `pnpm run verify` 成功，Home Ingress manifest 校验通过。实际正文构建函数生成合成 Markdown，测试覆盖全部 40 条事件、已有时间/历史、限定词、显式重点与转义、快照不变及原投递失败语义。共用内容选择函数的提取没有改变历史模拟 PNG/SVG 的字节结果。

Tide 执行锁文件安装、仅 Web 构建与命名重启。消息正文此次不再依赖图页生成或客户端抓图；既有 PNG/SVG 端点、渲染依赖和字体继续保留。未改 H5 或浏览器交互，本轮未重复浏览器验收，也未手动调用 AI 或真实投递；本地载荷、编译模式与服务健康不能代替新版在钉钉客户端的实际呈现确认。后续正常定时消息使用新格式，已发图片消息不会自动转换。

### 本次回退材料

- Tide `pve-pre-deploy-43f7449` → `8e2ce1beb0ad62074c712675f395ce7a20be029c`，该基线运行应用为 `68e1a72`。
- 本次无 schema、数据或配置迁移。需要回退时使用该基线，按下文锁文件安装、重建 Web 和命名重启，不删除已发送快照。
- 回退恢复 `plain-3` 时间与窄版 PNG 消息；不恢复默认群发或更早卡片模板。

历史回退材料继续保留：

- `pve-pre-deploy-68e1a72` → `1af99a9c74e944563c11574cc35c56df9b31b6a0`（运行应用 `7dd0331`，plain-2 PNG）。

- `pve-pre-deploy-7dd0331` → `d13f6a539ba05573db797b8db69bc7557ec38cac`（运行应用 `41972d8`）；这一更早基线仍使用 SVG 消息，不具备 PNG 手机兼容修复。
- `pve-pre-deploy-41972d8` → `7ca0d074fdbbcd7dbf161592d3a4a1727ed3f9dd`（运行应用 `557db95`）。
- GitHub 与 Tide 的 `codex/rollback-plain-2-41972d8` 为 `224031a475fc100ef3a1935dc1237e9810bacb9d`，tree `d89d0f1439766b48b107d22d8a184a32c5aa896d`。该兼容分支恢复旧 quick-2 版式，同时保留 emphasis 字段的类型、解析和存储校验；若回到更早版式，不能直接使用不认识该字段的旧 schema 或删除新数据。
- `pve-pre-deploy-557db95` → `3dd0b1a43c1ad44f6fa30206f5edafac521874b8`。
- `pve-pre-deploy-3dd0b1a` → `c4f08934f1692693a8dea370c4ac47cf6b5eeb24`。
- `/root/pre/drudge/.env.bak-DRUDGE-DEPLOY-3dd0b1a-20260905` 与 CT101 `/etc/home-ingress/backups/drudge-3dd0b1a.caddy` 是统一入口里程碑的材料。

本次原始验收记录位于本地忽略目录 `artifacts/DRUDGE-DEPLOY-43f7449-20260908.md`；正式结论不依赖该目录可用。

## 最近模型配置变更

2026-09-19 14:03（北京时间），按用户要求将最终汇总从 DeepSeek 切换为
`qwen3.7-flash`。逐条抽取与历史摘要此前已经使用该模型；图谱抽取的 xAI / Grok
备用配置仍保留，本次没有处理已发现的抽取失败与重复调用问题。

本次是运行配置变更：Tide 根 `.env` 仅修改 `WEB_AI_PROVIDER`，由 `deepseek`
改为 `qwen`，沿用既有 `WEB_QWEN_MODEL=qwen3.7-flash` 与凭据。源码 HEAD 仍为
`3366a45b234490c2a53f62b8dcec9a3e4546a606`，应用构建版本不变。原配置及权限保留在
`/root/pre/drudge/.env.bak-DRUDGE-QWEN37-20260919T060317443Z`。

仅命名重启 `web-app`（新 PID `3455140`）；`web-scheduler`、两个 worker 的 PID
未变。四个进程 online，三个应用健康端点与公网简报健康端点均返回 200，通知保持
开启，PM2 状态已保存。根配置与 Web 进程环境合并后的主模型为千问 3.7 Flash。
切换前使用现有 AI SDK、凭据和非思考设置完成一次合成文本生成，消耗 68 Token，
保留数字及“拟、尚未获批”限定；没有手动生成真实简报或发送钉钉测试消息。

回退时仅把根配置的 `WEB_AI_PROVIDER` 恢复为 `deepseek`，保留其他后续配置，
按下文根配置方式命名重启 `web-app` 并验证后保存 PM2 状态；无需回退源码或数据。

上述是 14:03 的模型切换快照；图谱备用及重试策略已由下面 14:24 的发布更新。

## 最近抽取修复

2026-09-19 14:24（北京时间），提交 `6146404b20df8c0653d55873dc72feef1d347d9e`
已同步 GitHub main 和 Tide，仅构建、命名重启 `graph-worker`。千问明确使用 JSON
输出模式，每条抽取只尝试一次，SDK 重试关闭，超时中止请求；失败新闻保留待人工
重试，自动批处理跳过已有失败记录，重叠批次共用同一新闻的在途请求。

根配置仅新增 `GRAPH_AI_FALLBACK_PROVIDER=none`，停用无法连接的 xAI / Grok
备用；三个主模型继续 `qwen3.7-flash`。Graph 显式读取根 `DOTENV_CONFIG_PATH`，
原数据目录与其他配置保持一致。配置副本为
`/root/pre/drudge/.env.bak-DRUDGE-RETRY-6146404-20260919T062422823Z`，代码回退点为
`pve-pre-deploy-6146404`（`3366a45`）。Web 的运行构建仍为 `43f7449`，没有重建 Web。

验证：完整 `pnpm run verify` 通过，73 个套件、886 项测试及三个应用构建成功。
合成新闻使用实际抽取 schema：旧 auto 模式报“未调用工具”，API 返回 3650 Token
用量；JSON 模式成功，返回 3130 Token 用量。这证明普通新闻也会触发兼容问题，
不能把所有失败都归因于内容限制；该测试没有写图谱或发送消息。

现场 graph-worker 新 PID 为 `3464420`，其余三个进程 PID 未变。四进程 online，
三个应用、公网简报健康端点和 Graph 系统状态均正常，Neo4j 与调度服务可用；
备用关闭且 PM2 状态已保存。成功调用及模型返回的失败 Token 用量现记入 info
日志，便于后续核算。本次没有清理失败记录、删除消费位点或手动重放旧新闻。
截至 14:26 的正常扫描样本中，两条新新闻各调用一次且均成功，总用量 6961 Token，
未见额外尝试、工具调用误判或备用切换；这是短时运行证据，不代表长期费用或质量评估。

需要回退时，使用上述代码回退点、恢复本次备用键的原状态，再重建并命名重启
graph-worker；保留 Web 已切换的千问配置及所有新闻、失败记录和位点。

## 运行位置与配置

| 对象         | 位置 / 职责                                                       |
| ------------ | ----------------------------------------------------------------- |
| 本地工作区   | `/Users/microTT/toto/ih/drudge`，修改与验证                       |
| GitHub       | `ZheLv-TideMetric-Investment/drudge`，main 作为共享代码基线       |
| 业务容器     | `tide`，最近现场 CTID 为 `103`，仓库 `/root/pre/drudge`           |
| 入口容器     | CT101 `home-ingress`，只运行 Caddy 与共享隧道                     |
| 应用进程     | `ingest-worker`、`graph-worker`、`web-app`、`web-scheduler`       |
| 数据库       | 独立 Docker 容器 `drudge-neo4j`，普通应用发布不重启或重建         |
| 运行配置     | `/root/pre/drudge/.env`；实际值不写入仓库和文档                   |
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

以下是全应用发布模板。只有 Web 包及其专用依赖变化，共享库和 worker 依赖未变时，构建使用 `pnpm --filter web run build`，重启只执行 Web 两进程的命名命令；核对两个 worker 持续运行。示例中的 `103` 只能在现场确认仍是 Tide 后使用；分支、SHA 和记录必须换成本次真实值。

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
- 公网检查工作台、只读查询和简报 H5，确认旧 PNG/SVG 继续可读。消息改动检查编译后的模式与合成载荷；只有改动 H5/图片/浏览器行为时再做真实浏览器与图片渲染验收，只有动到路由时才验证 Caddy/reload 与域名退出结果。
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
