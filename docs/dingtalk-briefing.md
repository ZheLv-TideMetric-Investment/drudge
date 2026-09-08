# 机器人消息与简报

本文是消息内容、展示、存储、投递和下一阶段优化的主要手册。当前里程碑见 [README](../README.md)，生产版本与进程操作见[部署手册](deployment.md)。

## 当前展示方案（2026-09-08）

用户经过实际使用后确认图片降低阅读体验，决定换回原生 Markdown。“牛长婷”继续调用原来的 `sampleMarkdown` 单聊接口，正文直接包含文字和一个 H5 详情链接，不再嵌入图片。应用提交 `43f7449` 已上线，定时通知保持开启；发布验收状态见[部署手册](deployment.md#最近发布快照)。

| 部分 | 当前规则 |
| --- | --- |
| 内容 | 每条现有事件句说清发生了什么，保留计划、否认、尚未等限定，不按字数截断 |
| 重点 | 只把已保存的 `emphasis` 字面短语写为 Markdown 加粗，最多两处；不猜测旧快照的重点 |
| 历史/背景 | 有已有标记时取首个完整句，用一段引用放在所属事件之后；没有则省略，不从机构/实体清单编写 |
| 时间 | 顶部显示快照生成的北京时间，另列 `meta` 中已有合法时段；每条显示已有有效时间，保留“截至”和完整日期，缺失不补写 |
| 排序与数量 | 按既有 `core`、`support`、`muted` 排序，同组原顺序；全部条目进入同一消息，不恢复三条上限 |
| 样式 | 普通文字、少量加粗与历史引用；不显示等级、栏目名、品牌或来源标签，不加 HTML 颜色和图片装饰 |
| 详情 | 末尾保留一个“查看完整详情 · N 条”链接；详细正文、实体、来源与原文 URL 保留在完整快照/H5 |
| 客户端 | 字号、行宽、颜色和换行由钉钉决定，不承诺固定像素，不再用图片控制文字尺寸 |

时间与背景选择沿用原有规则，放在 `briefing-content.ts` 中供正文和旧图片共用；清理快捷内容不会修改快照和 H5。Markdown 特殊字符按字面转义，只由构建器加入加粗、引用和末尾详情链接。时间只有在尾部值与条目元数据匹配时才移到事件前，其他事件日期继续留在句中。

现有总结提示词继续要求主体、动作、关键变化与确定性限定，并用 Markdown 标记通常一个、最多两个核心短语。此次不改提示词，不新增 AI 或图谱查询；内容质量不能由排版测试证明。服务状态 mode 为 `explicit_single_user_markdown_h5`。

### 历史图片兼容

已发送图片消息不会自动变成文字。保留同 ID 的 PNG/SVG 路径、字体和渲染代码，避免旧链接失效；新消息不再依赖它们。

历史图片仍使用 `plain-3`：逻辑宽 480px、最高 1280px，服务端由 SVG 经 `@resvg/resvg-js@2.6.2` 转成双倍像素 PNG；字体随应用携带，standalone 的 postbuild 继续复制字体及许可。PNG 默认第 1 页，`page` 参数选择图页；旧 SVG 无页码时仍返回全部页。URL/ETag 版本及缓存语义不变。本轮合成样例的 PNG 与 SVG 均和上一生产版本逐字节一致。

## 已完成的验收

- 早期图片链路已做授权单聊测试，用户确认图片和详情正常并授权开启定时通知。之后手机灰块问题改为 PNG，用户又通过一条授权模拟消息确认 PNG 正常；这些是旧展示方案的验收。
- 2026-09-07 `plain-3` 时间与窄版发布通过本地、公网和浏览器检查；用户随后实际体验反馈图片没有改善阅读，这是 2026-09-08 改回原生 Markdown 的依据。
- 本次本地完整 `pnpm run verify` 通过：73 个套件、880 项测试及全部构建。实际构建函数输出合成 Markdown，覆盖全部 40 条事件、已有历史与时间、重点合并和字符转义；原投递配置、唯一收件人、失败/限流与快照检查继续通过。
- 生产验收结果以[发布快照](deployment.md#最近发布快照)为准。本次没有手动调用 AI 或发送新的测试消息；本地载荷和服务健康不能代替钉钉客户端实际呈现验收。

## 源码导航

以下路径相对仓库根目录：

| 要修改的内容                            | 文件                                                                                                                      |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| 原新闻/总结变为简报条目、标题和完整事实 | `packages/web-app/src/lib/services/notification-briefing.ts`                                                              |
| 共用事件/历史/时间选择规则 | `packages/web-app/src/lib/services/briefing-content.ts` |
| 现有总结的事件句与历史提示词            | `packages/web-app/src/lib/services/summary.ts`                                                                            |
| 保存后再发送的业务编排                  | `packages/web-app/src/lib/services/notification.ts`                                                                       |
| Schema 校验、ID、原子落盘和读取         | `packages/web-app/src/lib/services/briefing-store.ts`                                                                     |
| 历史图片尺寸、文字换行、视觉层级            | `packages/web-app/src/lib/services/briefing-image.ts`                                                                     |
| H5 目录、详情和响应式样式               | `packages/web-app/src/app/briefings/[id]/BriefingView.tsx`、`packages/web-app/src/app/briefings/[id]/briefing.module.css` |
| H5/SVG HTTP 路由                        | `packages/web-app/src/app/briefings/[id]/page.tsx`、`packages/web-app/src/app/briefings/[id]/image.svg/route.ts`          |
| PNG 渲染、字体和 HTTP 路由 | `packages/web-app/src/lib/services/briefing-png.ts`、`packages/web-app/src/app/briefings/[id]/image.png/route.ts`、`packages/web-app/assets/fonts/` |
| Markdown 正文/链接、凭据校验和单聊载荷  | `packages/web-app/src/lib/services/dingtalk-message.ts`                                                                   |
| 公网域名一致性与跨站操作检查            | `packages/web-app/next.config.ts`、`packages/web-app/src/lib/public-surface.ts`、`packages/web-app/src/middleware.ts`     |
| 真实模拟消息入口                        | `packages/web-app/src/scripts/send-briefing-test.ts`                                                                      |

消息格式不散落到调用点；视觉改动不与持久化、传输或调度混在一起。

## 数据与投递契约

```text
新闻 / AI 总结
  → BriefingDraft（完整条目）
  → 校验并持久化 BriefingDocument
  → 原生 Markdown 事件文字 + H5 URL
  → 钉钉机器人单聊
```

`BriefingDraft` 包含标题、时间/数量元信息、L1/L2/L3+ 计数和 `items`。每个条目包含 ID、级别、色调、目录标签、标题、时间、完整详情、来源和原文 URL。可选 `emphasis` 最多保存两个标题中已有的字面短语，来自原始标题的 Markdown 加粗标记；store 校验短语属于标题。字段缺失时不推断重点、不新增默认值，因此既有快照继续可读。Markdown 只强调清理后仍属于事件句的部分，重叠标记合并且不会重复文字；H5 的纯文字标题不变。类型只在格式化文件中定义，校验在 store 中维护。

标识是规范化 draft 的 SHA-256 前 32 个十六进制字符（128 位）。相同内容重试复用同一快照；文件保存在 `BRIEFING_STORAGE_PATH/<id>.json`，先写临时文件再原子重命名。合法 ID 必须匹配 `[a-f0-9]{32}`，不能用任意路径读取文件。

投递必须同时满足通知启用、凭据齐全、一个合法收件人、HTTPS Origin 合法，以及运行时公网 Host 与 Web 构建值一致。载荷的 `userIds` 只有一项；不允许群聊、`atAll`、部门、隐式用户或广播 fallback。

钉钉返回 `processQueryKey` 且没有无效/限流收件人时，当前代码认为接口接受。**接口接受不等于用户已阅读或客户端展示正确**，后者要用客户端验收。发送失败不能把 Level 1 新闻记为已发送。

## 配置与公开边界

配置键：

- `ENABLE_DINGTALK_NOTIFICATION`：代码/模板默认关闭；生产开启状态见发布快照。公共配置同时支持 `WEB_ENABLE_DINGTALK_NOTIFICATION` 覆盖，排查时核对有效值，不只看单个键。
- `DINGTALK_APP_CLIENT_ID`、`DINGTALK_APP_CLIENT_SECRET`：只在运行环境配置。
- `DINGTALK_TARGET_USER_ID`：一个明确用户 ID，空值、逗号列表或空白分隔列表都失败；不写入文档。
- `BRIEFING_PUBLIC_BASE_URL`：当前为 `https://drudge.microzj.com`；必须是无凭据、路径、查询参数和锚点的 HTTPS Origin。
- `BRIEFING_STORAGE_PATH`：Web 可持续读写的绝对目录，属于生产数据，不提交或清理。

完整安全模板在 [env.example](../env.example)。修改公网域名需同步根配置并重建 Web；不要手工修改构建产物。`DINGTALK_CARD_TEMPLATE_ID` 已不再使用。

简报与工作台当前都公开可读，128 位 ID 不是身份认证；转发链接仍可访问。不能把密钥、私人正文或敏感系统告警放入公开简报。工作台保留浏览器跨站操作校验，但不能据此声称直接调用者经过认证。

## 验证方法

1. 本地使用合成内容验证事件、可选一句历史、已有时间、混合优先级、全部条目、重点与转义；直接检查 `buildBriefingMessage` 和 mock 的 `sampleMarkdown` 载荷无图片引用、有一个 H5 链接，完整快照不变。沿用禁网与生产路径保护，运行相关测试和完整 verify。
2. 改动 H5 或历史图片时再用真实浏览器检查对应页面、Console 与失败请求。PNG 兼容保留时沿用真实渲染库测试文件签名、尺寸、中文字体及内容；不要为了验证 Markdown 再做多套图片预览。
3. 发布只读确认生产版本、编译后的消息模式、有效配置与应用健康；既有 H5/PNG/SVG 继续可读。工作台或 `GET /api/monitor` 成功不代表实际投递；不得用会触发 AI/通知的 `GET /api/summary` 做探针。
4. 需要真实钉钉展示验收时，明确测试内容、次数和收件人，使用已有授权；分别记录接口结果与用户反馈。未获新手动测试授权时保持既有定时流程，不额外发送。

以下命令会真实发送一条标为模拟数据的消息，**不用于普通只读检查**。仅在测试投递已获授权、配置齐全时运行：

```bash
ENABLE_DINGTALK_NOTIFICATION=true \
DRUDGE_BRIEFING_PUBLIC_HOST=drudge.microzj.com \
pnpm briefing:test-live
```

它不触发真实新闻扫描，目标仍只来自显式单收件人配置。首次启用通知时先在关闭状态完成本地和公网验证，再做授权测试；验收后按部署手册启用并重启 Web 与调度器。该流程不表示当前生产通知仍关闭。

`/briefings/health` 只返回固定存活文本，不验证存储或钉钉。通知 service 的 `healthCheck()` 会校验配置并获取 access token，但也不会发送消息；两者都不能代替实际展示验收。

## 停用与回退

按已有授权把有效通知配置关闭，再按部署手册重启 `web-app` 与 `web-scheduler`。不要通过清空收件人制造半配置状态。展示版本回退须同时保持应用、域名与入口一致，不回退到隐式群发。

快照当前不自动删除。制定保留期前先确认历史链接有效期；回退不能删除已发送简报或消费位点。

## 下一阶段

当前方向是原生 Markdown 的实际阅读质量，不再继续图片样式探索。保持事件句、可选一句历史、真实已有时间和少量显式加粗；优先观察正常定时消息，不主动增加模型调用、推送或多套候选设计。

完整详情和图谱深度探索等待用户下一步明确要求，不能为了快捷消息追求至全至美而扩展范围。历史图片材料只用于解释兼容，不是继续优化的待办。
