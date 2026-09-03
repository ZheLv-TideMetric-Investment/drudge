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
