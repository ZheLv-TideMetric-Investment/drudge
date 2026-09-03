# 钉钉图片摘要与 H5 简报手册

本文说明 Drudge 如何复用企业机器人“牛长婷”，向一个明确用户发送紧凑图片摘要和完整 H5 详情。生产发布仍按[发布手册](deployment.md)执行。

## 1. 最终形态

钉钉单聊消息只包含两部分：

```text
┌────────────────────────────┐
│ 固定比例摘要图              │
│ 重点 1 条 + 次要 2 条 + 数量 │
└────────────────────────────┘
查看完整详情 · N 条 →
```

- 摘要图固定为 `720 × 400` SVG，最高权重条目占主要空间，另外两条压缩展示。
- 图片最多展示三条；超过三条只显示“另有 N 条”，不把全部正文塞进聊天窗口。
- H5 保存全部条目、事实字段、主体、时间、来源与原文链接，不做八条上限或溢出合并。
- H5 左侧目录始终存在，点击目录只切换右侧详情，没有“返回列表”。手机端目录收窄，但不消失。
- 配色只使用核心红和辅助蓝灰；L3+ 使用辅助色的低对比度版本，级别文字始终保留。

这条链路不使用钉钉互动卡片，也不依赖卡片搭建器或模板 ID。钉钉只负责呈现普通 Markdown 图片和链接，展示逻辑全部留在仓库中。

## 2. 数据与发送链路

```text
新闻 / AI 总结
    -> BriefingDraft（完整条目）
    -> BRIEFING_STORAGE_PATH/<128-bit-id>.json
       |-> /briefings/<id>/image.svg
       +-> /briefings/<id>
    -> 企业机器人单聊 Markdown
       |-> 摘要图片 URL
       +-> H5 详情 URL
```

`packages/web-app/src/lib/services/notification-briefing.ts` 只负责把业务对象整理成简报；`briefing-store.ts` 校验并原子落盘；`briefing-image.ts` 生成无脚本 SVG；`dingtalk-message.ts` 只负责显式单聊投递。不要把样式、存储和钉钉请求重新混回同一个函数。

简报标识由完整内容的 SHA-256 截取为 128 位十六进制字符串。路由只接受这个固定格式，不能用路径片段读取任意文件；相同内容重试会复用同一份快照。

## 3. 收件人与公开边界

- 主动推送默认关闭，也没有默认收件人。
- `DINGTALK_TARGET_USER_ID` 必须是一个明确用户 ID；空值、逗号列表或空白分隔列表均直接失败，不调用钉钉。
- 投递只调用人与机器人单聊接口，请求中 `userIds` 必须只有该用户；不允许群 ID、`atAll`、部门、可见范围或广播 fallback。
- 发送失败时，Level 1 扫描不能把新闻记为已发送。
- 未来多人投递必须使用显式白名单并记录逐人结果，不能改成默认全员或群聊。

钉钉拉图和打开 H5 时不能附带家庭入口的 Basic Auth，因此简报路由需要公网可读。当前采用不可遍历 URL，而不是用户登录；链接被人工转发后仍可访问。简报中不得包含密钥、私人新闻正文或高敏感系统告警。

Web App 的其他业务路由没有登录层。构建时会从 `BRIEFING_PUBLIC_BASE_URL` 提取公网 Host；该 Host 下的中间件只放行 `/briefings/*`、`/_next/*` 和 favicon，其他页面与 `/api/*` 返回 404。内网 Host 不受这条展示边界影响。

## 4. 运行配置

真实值只写在本地或 PVE 根 `.env`：

```dotenv
ENABLE_DINGTALK_NOTIFICATION=false
DINGTALK_APP_CLIENT_ID=<企业应用 Client ID>
DINGTALK_APP_CLIENT_SECRET=<企业应用 Client Secret>
DINGTALK_TARGET_USER_ID=<明确收件人的 userId>
BRIEFING_PUBLIC_BASE_URL=https://<简报公网域名>
BRIEFING_STORAGE_PATH=/absolute/path/to/drudge/data/briefings
```

要求：

- `BRIEFING_PUBLIC_BASE_URL` 必须是只含域名的 HTTPS Origin，不允许用户名、密码、路径、查询参数或锚点。
- `BRIEFING_STORAGE_PATH` 必须是 Web App 可持续读写的绝对目录；它是运行数据，不提交 Git。
- 摘要图 URL 和 H5 URL 必须指向同一份快照。
- 修改公网域名后需要重新构建 Web App，使公网 Host 边界同步生效。
- 不再配置 `DINGTALK_CARD_TEMPLATE_ID`；旧模板是否保留由钉钉后台独立决定，不影响代码。

## 5. 启用与验收

1. 保持 `ENABLE_DINGTALK_NOTIFICATION=false`，完成测试、构建和本地浏览器验收。
2. 配置绝对存储目录和 HTTPS 公网地址；入口只转发到 Web App，不增加新的业务服务。
3. 分别从公网确认一个已生成的 `/briefings/<id>` 与 `/briefings/<id>/image.svg` 可读，并确认同一 Host 下 `/api/scan` 返回 404。
4. 核对唯一收件人 ID。禁止从机器人可见范围、组织管理员或群成员自动推导。
5. 经用户明确授权后发送一次测试，检查桌面端和移动端的图片比例、H5 打开与目录切换。
6. 测试成功后才在 PVE 启用通知并按发布手册重启 `web-app` 与 `web-scheduler`。

生产配置保持通知关闭时，可在明确授权后仅发送一条内置模拟简报，不触发扫描或真实新闻消费：

```bash
ENABLE_DINGTALK_NOTIFICATION=true \
DRUDGE_BRIEFING_PUBLIC_HOST=<简报公网域名> \
pnpm briefing:test-live
```

该命令固定生成三条标明“模拟数据”的层级示例，收件人仍只来自单值 `DINGTALK_TARGET_USER_ID`。

单元测试会 mock 钉钉网络，不构成真实渲染证明。尤其 SVG 是否被当前钉钉客户端正常代理，必须在部署 HTTPS 地址后做一次实际消息验收；若客户端不接受 SVG，再单独评估 PNG 渲染，不预先引入浏览器或字体运行时。

健康检查只验证配置边界和 access token，不会创建简报或发送消息，因此不能代替真实验收。

## 6. 停用与回滚

将 `ENABLE_DINGTALK_NOTIFICATION=false` 后重启 `web-app` 与 `web-scheduler`，即可停止主动推送。不要通过清空收件人制造半配置状态。

若新展示不可用，先停用通知；回滚到上一稳定提交并恢复其对应配置。不要把群 Webhook 作为静默 fallback，也不要在失败后自动扩大收件人范围。

简报快照当前不自动删除。制定保留期前必须先确定历史消息链接允许失效的时间，不能把运行数据当缓存直接清理。
