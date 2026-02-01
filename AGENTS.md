## 0. 核心原则（必须遵守）

1. **先学习仓库，再写代码**
   - 开工前先做“仓库勘察”（见第 2 节），理解：项目结构、编码风格、依赖、测试方式、发布方式。
   - **优先模仿本仓库既有写法**：命名、错误处理、日志、注释风格、目录组织、抽象层级、依赖注入/配置方式等。
   - 遇到相似问题，先在仓库中找到“已有先例”再实现（例如：搜索同类模块/函数/测试）。

2. **简单优先（Simple > Clever）**
   - 优先使用**最简单可行**且**可维护**的方案：小改动、少依赖、少魔法、少抽象。
   - 尽量使用标准库或仓库现有依赖；除非明确收益，否则不要新增依赖/引入新框架/大规模重构。

3. **准确性优先（有充足时间与预算）**
   - 不要凭感觉猜测行为；需要时通过：
     - 读代码/读文档（README/CONTRIBUTING/ADR 等）
     - 运行测试/复现脚本
     - 增加或更新测试用例
     - 静态检查（lint/typecheck/format）
   - 给出结论前，尽量用可验证方式自证正确（见第 4 节“完成定义”）。
   - **若变更涉及 UI 展示/交互效果**（样式、布局、组件渲染、路由、权限/登录态导致的显示差异等）：
     - **优先使用 `chrome-devtools` MCP 在真实浏览器中验证**（至少截图 + Console 检查），禁止只凭“看代码/猜测”判断页面正确。

4. **最小范围变更**
   - 只做任务要求的必要改动；避免顺手清理、风格大改、无关重排。
   - 如必须触及较大范围：先解释原因、列出影响面与回滚策略，并分阶段提交。

5. **透明记录假设与不确定性**
   - 如果信息不足：写清楚假设、验证方法、以及你做了哪些检查来降低不确定性。
   - 不要把不确定当确定输出。

---

## 1. 仓库专用配置（可选维护）

> 本节用于“每个仓库不同情况”的扩展与覆盖。首次接入时请尽快补齐。
> Agent 必须优先读取本节；若为空，则按第 2/3 节自动探测。

### 1.1 关键命令


- **安装依赖**：``
- **构建/编译**：``
- **运行测试**：``
- **单测（快速）**：``
- **lint**：``
- **format**：``
- **typecheck**：``
- **本地运行/启动**：``
- **生成制品/发布**：``
- **端到端 / UI 验证（可选）**：``（例如：Playwright/Cypress；若不用自动化则留空）

### 1.2 代码风格与规范

- 语言/框架：``
- 主要代码风格参考目录（例如 `src/`、`lib/`）：``
- 关键规范文件（存在则填）：
  - `CONTRIBUTING.md`：``
  - `STYLEGUIDE.md` / `coding-standards`：``
  - `eslint/prettier/ruff/black/gofmt` 等：``
- 约定：
  - 错误处理：``
  - 日志：``
  - 配置：``
  - 测试风格：``

### 1.3 启用的扩展模块

> 勾选后，Agent 必须遵循对应扩展章节的规则。
- [ ] EXT: Monorepo（多包/多语言）
- [ ] EXT: Backend Service（后端服务）
- [ ] EXT: Frontend/Web（前端/网页）
- [ ] EXT: Mobile（移动端）
- [ ] EXT: Library/SDK（类库/SDK）
- [ ] EXT: Data/ML（数据/机器学习）
- [ ] EXT: Infra/IaC（基础设施/部署）
- [ ] EXT: Security-sensitive（高安全敏感：鉴权/支付/密钥/合规）
- [ ] EXT: Performance-critical（性能敏感/低延迟）
- [ ] EXT: Legacy/Compatibility（强兼容/历史包袱）

### 1.4 前端页面验证配置

> 若本仓库涉及 UI/页面展示，请尽量补齐，以便 Agent 稳定复用 “已登录环境 + 截图证据” 完成验证。

- **UI_BASE_URL（开发或测试环境地址）**：``
- **需要验证的关键页面/路由**：``
- **页面稳定判定的关键选择器**：``
- **默认截图输出目录**：``
- **默认视口**：``
- **登录策略**：复杂登录（SSO/2FA/验证码/风控）时，**默认复用用户已登录的 Chrome 会话**；不要求自动化登录（如需自动化另行说明）

---

## 2. 开工前必做：仓库勘察（Agent Checklist）

> 目的：在写代码前先“理解仓库如何写代码、如何验证”。

1. **识别项目类型与入口**
   - 读取：`README.md`、`CONTRIBUTING.md`、`docs/`、`Makefile`、`package.json`、`pyproject.toml`、`go.mod`、`pom.xml/build.gradle`、`Cargo.toml`、`.sln/.csproj` 等。
   - 确定：这是应用/服务/库/CLI/多包仓库？主入口是什么？发布形态是什么？

2. **学习现有代码写法（必须）**
   - 找一个与任务相近的模块/文件，观察：
     - 命名规则（变量/函数/类/文件）
     - 错误处理策略（异常/返回值/Result 类型）
     - 日志与可观测性（logger、trace、metrics）
     - 配置注入方式（env/config 文件/DI）
     - 边界层划分（controller/service/repo 等）
   - 通过搜索找到先例：例如 `git grep`/全局搜索 “类似功能关键词”。

3. **确定验证路径**
   - 找到并记录：如何运行测试、lint、format、typecheck。
   - 若没有明确命令：自动探测（见第 3 节）。
   - **若任务涉及 UI**：同时确定 UI 验证路径（优先：`chrome-devtools` MCP + 截图/Console 检查；或仓库已存在的 e2e 命令）。

4. **明确变更范围与风险**
   - 哪些文件/模块必须改？哪些必须不动？
   - 是否涉及兼容性、迁移、数据格式、对外 API？

---

## 3. 自动探测规则（当 1.1 未填写时使用）

> Agent 可按以下线索推断常见命令，但推断后必须尽快用实际运行验证。

- 若存在 `package.json`：
  - 先看 `scripts`：`npm run` / `pnpm -r` / `yarn`
  - 常见：`test`、`lint`、`format`、`build`、`typecheck`
- 若存在 `pyproject.toml` / `requirements.txt`：
  - 常见：`pytest`、`ruff`、`black`、`mypy`、`tox`
- 若存在 `go.mod`：
  - 常见：`go test ./...`、`gofmt`、`golangci-lint run`
- 若存在 `pom.xml`/`build.gradle`：
  - 常见：`mvn test`、`mvn -q -DskipTests=false test`、`gradle test`
- 若存在 `Cargo.toml`：
  - 常见：`cargo test`、`cargo fmt`、`cargo clippy`
- 若存在 `Makefile`：
  - 优先使用 `make test/lint/format/build` 等目标
- 若存在 CI 配置（`.github/workflows/*`、`.gitlab-ci.yml` 等）：
  - 以 CI 执行为“事实标准”，对齐 CI 的命令与参数

---

## 4. 完成定义（Definition of Done）

> “完成”必须可验证，且与仓库标准一致。

最少满足：
1. **实现满足需求**（功能/修复点明确）
2. **新增或更新测试**（能覆盖关键路径与边界条件；若仓库无测试框架则至少提供可复现脚本/最小验证方式）
3. **通过本仓库常规检查**
   - `test` 必过（或说明为什么不可运行、如何在 CI 验证）
   - `lint/format/typecheck` 按仓库要求执行并通过（或说明豁免理由）
4. **最小化影响面**
   - 不引入无关重构
   - 不新增不必要依赖
5. **清晰交付说明**
   - 说明改了什么、为什么这么改、怎么验证、风险点与回滚/替代方案（如有）
6. **若涉及 UI 展示/交互（强制）**
   - **优先使用 `chrome-devtools` MCP 在真实 Chrome 中完成验证**，并在交付说明中提供：
     - 访问的 URL（以及环境：dev/staging 等）
     - 验证场景（登录态/权限/主题/语言/视口）
     - **截图证据**（建议保存到 `artifacts/ui/`，列出文件路径）
     - Console 结论（是否存在 error/uncaught/rejected；如有必须说明原因与处理）
   - 若受环境限制无法完成（例如：缺少已登录会话/Chrome 未授权连接/MCP 不可用）：
     - 必须明确写出阻塞点
     - 并给出“用户需要执行的最小准备步骤”（例如：在 Chrome 中完成一次登录并保持会话，然后再继续验证）

---

## 5. 变更策略（避免把仓库“写坏”）

- **先小步走通，再扩展**
  - 先做最小可运行改动，让测试/构建通过；再补齐边角与优化。
- **优先保持 API/行为兼容**
  - 若需要破坏性变更：必须显式说明原因、影响范围、迁移方式，并尽量提供兼容层。
- **性能与安全默认不退化**
  - 若存在性能/安全敏感模块：优先选择更保守、可证明的实现；必要时加基准/安全测试。

---

## 6. 安全与合规（通用）

- **严禁提交密钥/Token/私密数据**（包括示例里也不行）。
- 对输入输出做合理校验，避免明显注入/路径遍历/命令执行风险。
- 若任务涉及鉴权/支付/加密/隐私：启用 `EXT: Security-sensitive` 并严格遵守其规则。
- 使用浏览器自动化/远程调试时：
  - 不要要求用户暴露可被外网访问的调试端口
  - 不要索取用户真实账号密码；复杂登录优先复用用户已登录会话
  - 不要在日志/截图中泄露敏感信息（必要时打码或避免截敏感区域）

---

## 7. 扩展模块（按仓库类型启用）

> 以下为“每个仓库不同情况”的扩展部分。请在 1.3 勾选启用的模块；Agent 必须遵循。

<details>
<summary><strong>EXT: Monorepo（多包/多语言）</strong></summary>

- 先识别工作区工具：pnpm workspaces / yarn workspaces / nx / bazel / turborepo / lerna / gradle multi-project 等。
- 优先在“最小影响范围”的包里修改；避免跨包联动重构。
- 运行测试要覆盖受影响包 + 依赖链上的关键包（最少：目标包测试、根级 lint/format）。
- 若有版本/发布流程（changeset/semantic-release）：按仓库惯例补齐变更说明。

</details>

<details>
<summary><strong>EXT: Backend Service（后端服务）</strong></summary>

- 关注：配置、启动、健康检查、日志、错误码、超时、重试、幂等、并发安全。
- 变更必须考虑：
  - 兼容性（API/DB schema）
  - 可观测性（日志/trace/metrics）
  - 回滚与灰度（若有）
- 新增接口需补齐：请求校验、错误响应、权限（若适用）、测试（至少集成测试或 handler 测试）。

</details>

<details>
<summary><strong>EXT: Frontend/Web（前端/网页）</strong></summary>

- 先识别：构建工具（vite/webpack/next）、状态管理、路由、UI 组件规范。
- 优先复用现有组件与样式体系；避免引入新的 UI 框架/状态库。
- 改动后至少运行：类型检查 + 单测（若有）+ 构建（必要时 e2e）。
- 注意可访问性（a11y）与兼容性（浏览器支持范围按仓库要求）。

### UI 展示效果验证（优先使用：chrome-devtools MCP）

当任务影响 UI 展示/交互效果时，必须按以下流程使用 **MCP server：优先使用`chrome-devtools`** 验证并产出证据（截图 + Console 结论）。本仓库登录环境可能复杂（SSO/2FA/验证码/风控），默认策略是**复用用户已登录的 Chrome 会话**，不强制自动化登录。

**必须触发验证的改动类型：**
- CSS/布局/主题/响应式/动效
- 组件渲染结构、文案溢出、图标
- 路由、权限/登录态相关的显示差异
- 交互：点击/输入/弹窗/下拉/表单提交
- 修复“页面空白/样式错乱/按钮不可用/控制台报错/资源加载失败”等问题

**推荐执行流程（思路必须一致）：**
1) 优先复用用户已登录标签页（复杂登录场景更稳定）
2) 导航到目标 URL
3) 等待页面稳定（关键元素出现、loading 消失、关键请求完成）
4) 截图保存到 `artifacts/ui/<页面>-<场景>-<viewport>.png`（或仓库约定目录）
5) 读取 Console：
   - 若出现 error/uncaught/rejected：必须记录要点并定位原因
6) 若页面资源加载异常：再检查网络失败请求（如 MCP 工具支持）

**输出要求（做完 UI 相关任务必须包含）：**
- 验证 URL + 环境（dev/staging）
- 验证场景（登录态/权限/主题/语言/视口）
- 截图路径列表
- Console 结论（是否有 error；如有，处理方式或后续建议）
- 未覆盖项（如有）+ 最小复现/验证步骤

</details>

<details>
<summary><strong>EXT: Mobile（移动端）</strong></summary>

- 先识别：iOS/Android/Flutter/React Native 结构与构建方式。
- 优先小步改动，避免大范围 UI 重构。
- 关注：权限、生命周期、离线/弱网、崩溃风险。
- 尽可能在本地或 CI 验证构建与基本测试。

</details>

<details>
<summary><strong>EXT: Library/SDK（类库/SDK）</strong></summary>

- API 稳定性优先：尽量不破坏对外接口；必要时提供兼容层。
- 新增功能必须补齐：
  - 文档（README/示例）
  - 单测（覆盖公开 API）
  - 版本/变更说明（如仓库有要求）
- 避免新增重依赖；保持包体与启动成本。

</details>

<details>
<summary><strong>EXT: Data/ML（数据/机器学习）</strong></summary>

- 关注：可复现性（随机种子、版本锁定）、数据泄露、评估指标、训练/推理一致性。
- 优先提供可运行的最小示例与验证脚本。
- 大模型/大数据处理注意资源：分批、流式、缓存；避免一次性读入内存。

</details>

<details>
<summary><strong>EXT: Infra/IaC（基础设施/部署）</strong></summary>

- 先识别：Terraform/Helm/Kustomize/Ansible/Docker/K8s 等。
- 变更必须考虑：回滚、最小权限、环境差异（dev/stage/prod）。
- 尽量用 `plan`/dry-run 验证（如适用），并避免破坏性默认值。

</details>

<details>
<summary><strong>EXT: Security-sensitive（高安全敏感：鉴权/支付/密钥/合规）</strong></summary>

- 默认更保守：宁可多校验、少魔法。
- 任何与鉴权/会话/加密/支付/隐私相关改动：
  - 必须新增测试覆盖关键攻击面
  - 必须检查日志中是否会泄露敏感信息
  - 必须避免不安全的默认配置
- 不确定时：明确标注风险并给出验证/审计建议。

</details>

<details>
<summary><strong>EXT: Performance-critical（性能敏感/低延迟）</strong></summary>

- 避免无谓的分配、拷贝、反射、正则滥用、N+1 调用等。
- 变更后尽量提供：
  - 基准测试（benchmark）或性能对比方法
  - 复杂度分析与热点路径说明
- 优先可读、可测的优化；不要为了性能牺牲正确性。

</details>

<details>
<summary><strong>EXT: Legacy/Compatibility（强兼容/历史包袱）</strong></summary>

- 默认不动公共行为；修复以“最小补丁”优先。
- 若必须改行为：提供兼容模式/开关/迁移路径。
- 优先补测试锁定旧行为，避免回归。

</details>

---

## 8. 输出规范（Agent 交付内容）

交付时请提供：
- 做了什么改动（概述）
- 关键设计/取舍（为什么选择这个简单方案）
- 如何验证（具体命令与结果）
- 风险点与回滚/替代方案（如有）
- 任何假设与未覆盖点（必须显式列出）
- **若涉及 UI**：补充 `chrome-devtools` MCP 验证证据（URL/场景/截图路径/Console 结论）

---

## 9. 快速自检（Agent 结束前 60 秒）

- [ ] 我是否先学习了仓库写法，并复用了已有模式？
- [ ] 我是否选择了最简单可行方案，而非过度设计？
- [ ] 我是否通过测试/lint/构建或给出明确验证路径？
- [ ] 我是否避免了无关改动与不必要依赖？
- [ ] 我是否清楚记录了假设、风险与回滚办法？
- [ ] **如果我改了 UI：我是否用 `chrome-devtools` MCP 截图并检查 Console，并在输出中提供证据？**
