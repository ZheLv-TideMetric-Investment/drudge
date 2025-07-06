# 新闻知识图谱系统 - pnpm Monorepo

## 📋 项目概述

这是一个基于AI的新闻处理和知识图谱系统的 **pnpm Monorepo** 重构版本，采用微服务架构，将原有单体应用拆分为三个独立包：

- 🌐 **web-app**: 前端应用 (Next.js，集成定时任务调度功能)
- 📥 **ingest-worker**: 数据摄取工作器 (新闻获取、级别评估)
- 🔗 **graph-worker**: 图谱处理工作器 (实体提取、图谱构建、总结生成)

## 🏗️ 架构图

```
┌─────────────────────────────────────────────────────────────────┐
│                     pnpm Monorepo 根目录                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐               │
│  │  web-app    │ │ingest-worker│ │graph-worker │               │
│  │   :3000     │ │   :3003     │ │   :3004     │               │
│  │             │ │             │ │             │               │
│  │ Next.js前端 │ │ 新闻获取    │ │ 图谱构建    │               │
│  │+定时任务调度│ │ 级别评估    │ │ 实体提取    │               │
│  └─────────────┘ └─────────────┘ └─────────────┘               │
│         │               │               │                     │
└─────────┼───────────────┼───────────────┼─────────────────────┘
          │               │               │
          └───────────────┼───────────────┼───────────────────────┐
                          │               │                       │
                    ┌─────▼─────┐   ┌─────▼─────┐   ┌─────▼─────┐ │
                    │  Neo4j    │   │ 外部APIs  │   │ 文件存储  │ │
                    │图数据库   │   │新闻、AI   │   │数据缓存   │ │
                    └───────────┘   └───────────┘   └───────────┘ │
```

## 🚀 快速开始

### 环境要求
- **Node.js**: 18.0.0+
- **pnpm**: 8.0.0+
- **Neo4j**: 5.0.0+

### 安装依赖

```bash
# 安装所有包的依赖
pnpm install

# 安装单个包的依赖
pnpm --filter @drudge/web-app install
```

### 环境配置

1. **复制环境变量模板**
```bash
# 为每个包配置环境变量
cp packages/web-app/.env.example packages/web-app/.env
cp packages/ingest-worker/.env.example packages/ingest-worker/.env
cp packages/graph-worker/.env.example packages/graph-worker/.env
```

2. **配置必要的环境变量**
```bash
# 每个包的 .env 文件中配置：
# - Neo4j数据库连接
# - AI服务API密钥 (DeepSeek, Google)
# - 新闻API密钥
# - Webhook通知地址
```

### 启动开发环境

```bash
# 启动Neo4j数据库 (使用Docker)
docker run -d --name neo4j \
  -p 7474:7474 -p 7687:7687 \
  -e NEO4J_AUTH=neo4j/password \
  neo4j:5.15-community

# 应用数据库schema
pnpm run schema:apply

# 启动所有服务 (开发模式)
pnpm run dev

# 或分别启动各个服务
pnpm --filter @drudge/web-app run dev      # 前端 :3000
pnpm --filter @drudge/ingest-worker run dev # 摄取器 :3003
pnpm --filter @drudge/graph-worker run dev  # 图谱器 :3004
```

### 生产部署

```bash
# 构建所有包
pnpm run build

# 使用Docker Compose部署
pnpm run docker:build
pnpm run docker:up

# 查看服务状态
pnpm run docker:logs
```

## 📦 包结构

### 🌐 web-app (前端应用)
```
packages/web-app/
├── src/
│   ├── app/           # Next.js App Router
│   ├── components/    # React组件
│   ├── lib/          # 工具库
│   └── types/        # 类型定义
├── public/           # 静态资源
└── package.json
```

**访问**: http://localhost:3000

**调度功能**: 
- 每5分钟扫描高级别新闻
- 每小时生成总结报告
- 每日生成综合报告

### 📥 ingest-worker (数据摄取)
```
packages/ingest-worker/
├── src/
│   ├── services/     # 新闻获取、级别评估
│   ├── routes/       # API路由
│   ├── utils/        # 工具函数
│   └── types/        # 类型定义
└── package.json
```

**功能**:
- 新闻API集成
- 新闻级别AI评估
- 数据预处理

### 🔗 graph-worker (图谱处理)
```
packages/graph-worker/
├── src/
│   ├── services/     # 图谱构建、实体提取、总结生成
│   ├── routes/       # API路由
│   ├── utils/        # 工具函数
│   └── types/        # 类型定义
└── package.json
```

**功能**:
- AI实体提取
- Neo4j图谱构建
- 智能总结生成
- 图谱维护

## 🔧 开发命令

### 根目录命令
```bash
# 开发模式 (所有服务)
pnpm run dev

# 构建所有包
pnpm run build

# 启动所有包 (生产模式)
pnpm run start

# 代码检查和格式化
pnpm run lint
pnpm run format

# 清理所有构建文件
pnpm run clean

# Docker操作
pnpm run docker:build    # 构建镜像
pnpm run docker:up       # 启动容器
pnpm run docker:down     # 停止容器
pnpm run docker:logs     # 查看日志

# 数据库操作
pnpm run schema:apply    # 应用Neo4j schema
pnpm run clean:neo4j     # 清理Neo4j数据
```

### 单包命令
```bash
# 在特定包中运行命令
pnpm --filter @drudge/web-app run <command>
pnpm --filter @drudge/ingest-worker run <command>
pnpm --filter @drudge/graph-worker run <command>

# 示例
pnpm --filter @drudge/web-app run build
pnpm --filter @drudge/ingest-worker run dev
```

## 🌟 新功能特性

### ✅ 完全分离的微服务
- 每个包都有独立的依赖管理
- 独立部署和扩展
- 服务间通过HTTP API通信

### ✅ 环境变量分离
- 每个包有自己的 `.env` 配置
- 机密信息完全隔离
- 便于不同环境配置

### ✅ Docker化部署
- 每个包有独立的Dockerfile
- Docker Compose编排
- 生产环境开箱即用

### ✅ 开发体验优化
- 热重载开发模式
- 并行启动所有服务
- 统一的代码检查和格式化

## 📊 新闻级别分类

| 级别 | 名称 | 标识 | 描述 |
|------|------|------|------|
| Level 1 | 紧急 | 🔴 | 重大突发事件、国际危机 |
| Level 2 | 重要 | 🟠 | 重要新闻事件、政策变化 |
| Level 3 | 中等 | 🟡 | 一般重要新闻、市场动态 |
| Level 4 | 一般 | 🟢 | 普通新闻、日常报道 |
| Level 5 | 低 | ⚪ | 日常资讯、轻松内容 |

## 🔗 服务端点

| 服务 | 端口 | 健康检查 | 描述 |
|------|------|----------|------|
| web-app | 3000 | - | 前端应用(含调度功能) |
| ingest-worker | 3003 | `/health` | 数据摄取 |
| graph-worker | 3004 | `/health` | 图谱处理 |
| Neo4j | 7474/7687 | - | 图数据库 |

## 🐛 故障排除

### 常见问题

1. **端口冲突**
   ```bash
   # 检查端口占用
   lsof -i :3000,3002,3003,3004,7474,7687
   ```

2. **Neo4j连接失败**
   ```bash
   # 检查Neo4j状态
   docker ps | grep neo4j
   # 重启Neo4j
   docker restart neo4j
   ```

3. **依赖安装失败**
   ```bash
   # 清理并重新安装
   pnpm run clean
   pnpm install
   ```

## 📖 更多文档

- [详细技术文档](./应用介绍文档.md)
- [API接口文档](./docs/api.md)
- [部署指南](./docs/deployment.md)

---

🎉 **重构完成！** 现在你拥有了一个现代化的微服务架构新闻知识图谱系统。