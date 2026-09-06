# Claude 接手入口

先完整读取 [AGENTS.md](AGENTS.md)，再按其中的阅读顺序进入 [README.md](README.md) 和任务对应手册。所有 AI 使用同一套产品边界、源码事实、验证方式与授权规则。

本文件不复制当前里程碑、架构或发布状态，避免不同 AI 读到相互矛盾的版本。

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
