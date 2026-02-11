# Drudge - 智能新闻知识图谱系统

## 📋 项目概述

Drudge 是一个基于 AI 驱动的新闻处理和知识图谱系统，采用现代化的微服务架构设计。系统能够自动获取新闻数据，进行智能评级，提取实体和关系，构建知识图谱，并提供实时可视化分析。

### 🏗️ 系统架构

```
┌─────────────────────────────────────────────────────────────────┐
│                    Drudge News Graph System                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐            │
│  │   web-app    │ │ingest-worker │ │graph-worker  │            │
│  │   :39112     │ │   :39110     │ │   :39111     │            │
│  │              │ │              │ │              │            │
│  │ • Next.js UI │ │ • 新闻获取   │ │ • 实体提取   │            │
│  │ • 定时调度   │ │ • 数据预处理 │ │ • 图谱构建   │            │
│  │ • 可视化    │ │ • 级别评估   │ │ • AI分析     │            │
│  └──────────────┘ └──────────────┘ └──────────────┘            │
│         │               │               │                     │
└─────────┼───────────────┼───────────────┼─────────────────────┘
          │               │               │
          └───────────────▼───────────────▼─────────────────────┐
                          │                                     │
                    ┌─────▼─────┐   ┌──────────┐   ┌─────────┐   │
                    │  Neo4j    │   │   AI     │   │  存储   │   │
                    │ 图数据库  │   │  APIs    │   │ 文件系统│   │
                    │ :7474/7687│   │DeepSeek  │   │  /data  │   │
                    └───────────┘   │Google AI │   └─────────┘   │
                                    │OpenAI    │                 │
                                    └──────────┘                 │
```

## 🚀 核心功能

### 📰 智能新闻处理
- **自动获取**: 从富途新闻API自动获取最新财经新闻
- **智能评级**: 基于AI算法将新闻分为5个重要级别 (Level 1-5)
- **内容分析**: 提取关键信息、时间、地点等结构化数据

### 🧠 知识图谱构建
- **实体识别**: AI驱动的实体提取（公司、人物、地点、事件等）
- **关系挖掘**: 自动发现实体间的关系（投资、合作、竞争等）
- **图谱维护**: 增量更新、去重、关系强化

### ⏰ 智能调度系统
- **高级别新闻扫描**: 每5分钟扫描Level 1-2重要新闻
- **小时总结**: 每小时生成新闻摘要
- **日报生成**: 每日综合分析报告
- **实时通知**: 钉钉Webhook通知重要事件

### 🎨 可视化界面
- **图谱可视化**: 交互式知识图谱展示
- **实时监控**: 系统状态和处理进度监控
- **数据分析**: 新闻趋势、实体统计、关系分析

## 📦 项目结构

```
drudge/
├── packages/                          # 微服务包
│   ├── web-app/                      # 前端应用 (Next.js)
│   │   ├── src/
│   │   │   ├── app/                  # Next.js App Router
│   │   │   │   ├── api/              # API路由
│   │   │   │   │   ├── graph/        # 图谱API
│   │   │   │   │   ├── scheduler/    # 调度API
│   │   │   │   │   ├── scan/         # 扫描API
│   │   │   │   │   └── summary/      # 总结API
│   │   │   │   └── page.tsx          # 主页面
│   │   │   ├── components/           # React组件
│   │   │   ├── lib/                  # 服务和工具
│   │   │   └── types/                # 类型定义
│   │   └── package.json
│   │
│   ├── ingest-worker/                # 数据摄取服务
│   │   ├── src/
│   │   │   ├── apis/                 # API端点
│   │   │   │   ├── news/             # 新闻相关API
│   │   │   │   └── system/           # 系统状态API
│   │   │   ├── services/             # 业务服务
│   │   │   ├── scheduler/            # 定时任务
│   │   │   └── storage/              # 存储服务
│   │   └── package.json
│   │
│   └── graph-worker/                 # 图谱处理服务
│       ├── src/
│       │   ├── apis/                 # API端点
│       │   │   ├── graph/            # 图谱查询API
│       │   │   ├── news/             # 新闻处理API
│       │   │   └── system/           # 系统API
│       │   ├── services/             # 核心服务
│       │   │   ├── AiService.ts      # AI服务
│       │   │   ├── KnowledgeGraphService.ts
│       │   │   ├── EntityService.ts  # 实体服务
│       │   │   └── Neo4jService.ts   # 数据库服务
│       │   └── cli/                  # 命令行工具
│       └── package.json
│
├── docker-compose.yml                # Docker编排
├── package.json                      # 根配置
└── pnpm-workspace.yaml              # pnpm工作空间
```

## 🛠️ 技术栈

### 前端技术
- **框架**: Next.js 15.3.5 + React 19
- **语言**: TypeScript
- **UI库**: Ant Design + Tailwind CSS
- **图表**: Recharts + Vis.js (图谱可视化)
- **状态管理**: React Hooks

### 后端技术
- **运行时**: Node.js 18+
- **框架**: Express.js
- **语言**: TypeScript
- **数据库**: Neo4j 5.x (图数据库)
- **AI集成**: DeepSeek、Google AI、OpenAI

### 开发工具
- **包管理**: pnpm (Monorepo)
- **构建工具**: TypeScript Compiler
- **代码规范**: ESLint + Prettier
- **进程管理**: PM2
- **容器化**: Docker + Docker Compose

## 🚀 快速开始

### 环境要求
- **Node.js**: 18.0.0+
- **pnpm**: 8.0.0+
- **Neo4j**: 5.0.0+
- **Docker**: 20.0.0+ (可选)

### 1. 克隆和安装

```bash
# 克隆项目
git clone <repository-url>
cd drudge

# 安装依赖
pnpm install
```

### 2. 环境配置

```bash
# 复制环境变量模板
cp env.example .env
```

> 注意：不再使用 `packages/*/.env`，所有服务统一读取仓库根目录 `.env`。

### 3. 配置环境变量

**.env（仓库根目录）**:
```env
WEB_APP_PORT=39112
INGEST_WORKER_PORT=39110
GRAPH_WORKER_PORT=39111

NEO4J_URI=bolt://localhost:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=your_password
STORAGE_PATH=/absolute/path/to/drudge/data
NEWS_API_URL=https://news.futunn.com/news-site-api/main/get-flash-list

DEEPSEEK_API_KEY=your_deepseek_key
GOOGLE_API_KEY=your_google_key
QWEN_API_KEY=your_qwen_key

NEWS_DIRECTORY=/absolute/path/to/drudge/data/news
FAILED_NEWS_DIRECTORY=/absolute/path/to/drudge/data/news/failed

WEBHOOK_URL=your_dingtalk_webhook
WEBHOOK_URLS=your_dingtalk_webhook
```

更多可选项请参考根目录 `env.example`。

### 4. 启动数据库

```bash
# 使用Docker启动Neo4j
docker run -d --name neo4j \
  -p 7474:7474 -p 7687:7687 \
  -e NEO4J_AUTH=neo4j/your_password \
  -e NEO4J_PLUGINS='["apoc"]' \
  neo4j:latest
```

### 5. 启动服务

```bash
# 开发模式 - 启动所有服务
pnpm run dev

# 或者分别启动各个服务
pnpm --filter web run dev           # Web界面 :39112
pnpm --filter @drudge/ingest-worker run dev  # 摄取服务 :39110
pnpm --filter @drudge/graph-worker run dev   # 图谱服务 :39111
```

### 6. 访问应用

- **Web界面**: http://localhost:39112
- **Ingest Worker**: http://localhost:39110/health
- **Graph Worker**: http://localhost:39111/health
- **Neo4j浏览器**: http://localhost:7474

## 📊 新闻级别分类

| 级别 | 名称 | 标识 | 描述 | 处理方式 |
|------|------|------|------|----------|
| Level 1 | 极重要 | 🔴 | 重大突发事件、市场危机 | 立即处理+通知 |
| Level 2 | 重要 | 🟠 | 重要政策、公司重大事件 | 优先处理 |
| Level 3 | 中等 | 🟡 | 行业动态、一般公告 | 正常处理 |
| Level 4 | 一般 | 🟢 | 日常新闻、常规报道 | 批量处理 |
| Level 5 | 低级 | ⚪ | 轻松内容、边缘信息 | 可选处理 |

## 🔗 API接口文档

### 核心服务端点

| 服务 | 端口 | 健康检查 | 主要功能 |
|------|------|----------|----------|
| web-app | 39112 | `/api/health` | 前端界面、调度管理 |
| ingest-worker | 39110 | `/health` | 新闻获取、数据预处理 |
| graph-worker | 39111 | `/health` | 实体提取、图谱构建 |
| Neo4j | 7474/7687 | - | 图数据库 |

### Web App API

#### 扫描相关
```bash
# 触发新闻扫描
POST /api/scan
{
  "startTime": "2025-01-15T10:00:00.000Z",
  "endTime": "2025-01-15T11:00:00.000Z",
  "sendNotifications": true,
  "skipProcessed": false
}

# 获取扫描状态
GET /api/scan
```

#### 总结生成
```bash
# 生成新闻总结
GET /api/summary?startTime=2025-01-15T10:00:00.000Z&endTime=2025-01-15T11:00:00.000Z&sendNotification=true
```

#### 调度管理
```bash
# 触发调度任务
POST /api/scheduler
{
  "trigger": "HIGH_LEVEL_SCAN",
  "timestamp": "2025-01-15T10:00:00.000Z"
}

# 获取调度状态
GET /api/scheduler
```

#### 图谱查询
```bash
# 获取图谱统计
GET /api/graph/stats

# 搜索实体
GET /api/graph/entities/search?searchTerm=小米&limit=10

# 获取实体邻域
GET /api/graph/entities/{entityId}/neighborhood
```

### Ingest Worker API

```bash
# 获取新闻列表
GET /api/news/list?limit=10&level=1

# 获取新闻数量统计
GET /api/news/count

# 获取时间范围内新闻
GET /api/news/time-range?startTime=2025-01-15T00:00:00.000Z&endTime=2025-01-15T23:59:59.000Z

# 清理旧新闻
DELETE /api/news/clean?days=30

# 获取系统状态
GET /api/system/status
```

### Graph Worker API

```bash
# 处理单条新闻
POST /api/news/process
{
  "newsId": "news_123",
  "title": "新闻标题",
  "content": "新闻内容",
  "level": 1
}

# 批量处理新闻
POST /api/news/batch
{
  "newsItems": [...]
}

# 获取图谱统计
GET /api/stats

# 搜索实体
GET /api/entities/search?q=关键词&limit=10

# 获取实体关系
GET /api/entities/{name}/relations?depth=2

# 获取新闻列表
GET /api/news?limit=10&level=1
```

## 🔧 开发命令

### 根目录命令
```bash
# 开发模式
pnpm run dev                 # 启动所有服务

# 构建
pnpm run build              # 构建所有包
pnpm run start              # 生产模式启动

# 代码质量
pnpm run lint               # 代码检查
pnpm run lint:fix           # 自动修复
pnpm run format             # 代码格式化

# 清理
pnpm run clean              # 清理构建文件

# Docker
pnpm run docker:build       # 构建镜像
pnpm run docker:up          # 启动容器
pnpm run docker:down        # 停止容器
pnpm run docker:logs        # 查看日志

# PM2进程管理
pnpm run pm2:start          # 启动所有进程
pnpm run pm2:stop           # 停止所有进程
pnpm run pm2:restart        # 重启所有进程
pnpm run pm2:status         # 查看进程状态
```

### 单包命令
```bash
# Web App
pnpm --filter web run dev
pnpm --filter web run build
pnpm --filter web run scheduler        # 运行调度器

# Ingest Worker
pnpm --filter @drudge/ingest-worker run dev
pnpm --filter @drudge/ingest-worker run cli fetch    # 获取新闻
pnpm --filter @drudge/ingest-worker run cli list     # 列出新闻

# Graph Worker
pnpm --filter @drudge/graph-worker run dev
pnpm --filter @drudge/graph-worker run cli process   # 处理新闻
pnpm --filter @drudge/graph-worker run cli stats     # 显示统计
pnpm --filter @drudge/graph-worker run cli query     # 查询图谱
```

## 🐳 Docker部署

### 使用Docker Compose

```bash
# 启动完整环境
docker-compose up -d

# 查看服务状态
docker-compose ps

# 查看日志
docker-compose logs -f

# 停止服务
docker-compose down
```

### 环境变量配置

在生产环境中，确保仓库根目录 `.env` 正确配置关键环境变量（Compose 统一读取 `./.env`）：

```yaml
# docker-compose.yml
services:
  neo4j:
    environment:
      NEO4J_AUTH: neo4j/your_secure_password
      NEO4J_PLUGINS: '["apoc"]'
      
  web-app:
    environment:
      - NEO4J_PASSWORD=your_secure_password
      - DEEPSEEK_API_KEY=your_api_key
      - WEBHOOK_URL=your_webhook_url
```

## 🔍 CLI工具

### Graph Worker CLI

```bash
# 进入graph-worker目录
cd packages/graph-worker

# 处理新闻
pnpm run cli process 100              # 处理最新100条新闻
pnpm run cli process-recent 24        # 处理最近24小时新闻
pnpm run cli reprocess news_123       # 重新处理指定新闻

# 查询图谱
pnpm run cli query "小米" 10          # 搜索小米相关实体
pnpm run cli stats                    # 显示图谱统计

# 数据管理
pnpm run cli export json              # 导出数据
pnpm run cli rebuild                  # 重建图谱
pnpm run cli setup-db                 # 初始化数据库
```

### Ingest Worker CLI

```bash
# 进入ingest-worker目录
cd packages/ingest-worker

# 获取新闻
pnpm run cli fetch                    # 获取最新新闻
pnpm run cli batch 3                  # 批量获取3天内新闻
pnpm run cli list 20                  # 列出最新20条新闻

# 数据管理
pnpm run cli count                    # 统计新闻数量
pnpm run cli clean 30                 # 清理30天前新闻
pnpm run cli status                   # 查看系统状态
```

## 📈 监控与运维

### 系统监控

访问各服务的健康检查端点：
- http://localhost:39112/api/health
- http://localhost:39110/health  
- http://localhost:39111/health

### 日志管理

```bash
# 查看实时日志
pnpm run pm2:logs

# 查看特定服务日志
pm2 logs web-app
pm2 logs ingest-worker
pm2 logs graph-worker

# Docker日志
docker-compose logs -f web-app
docker-compose logs -f ingest-worker
docker-compose logs -f graph-worker
```

### 性能监控

```bash
# PM2监控面板
pm2 monit

# 系统资源监控
pm2 status
```

## 🐛 故障排除

### 常见问题

#### 1. 端口冲突
```bash
# 检查端口占用
lsof -i :39110,39111,39112,7474,7687

# 终止占用进程
kill -9 <PID>
```

#### 2. Neo4j连接失败
```bash
# 检查Neo4j状态
docker ps | grep neo4j

# 重启Neo4j
docker restart neo4j

# 检查连接
curl http://localhost:7474
```

#### 3. AI API配置问题
```bash
# 检查API密钥配置
cat packages/*/env

# 测试API连接
curl -H "Authorization: Bearer YOUR_API_KEY" \
  https://api.deepseek.com/v1/models
```

#### 4. 依赖安装问题
```bash
# 清理并重新安装
pnpm run clean
rm -rf node_modules pnpm-lock.yaml
pnpm install
```

#### 5. 构建失败
```bash
# 检查TypeScript错误
pnpm run lint

# 强制重新构建
pnpm run clean
pnpm run build
```

### 调试模式

```bash
# 启用详细日志
export LOG_LEVEL=debug

# 调试单个服务
DEBUG=* pnpm --filter @drudge/graph-worker run dev
```

## 📚 相关文档

- [Neo4j数据库模式](packages/graph-worker/DATABASE_SCHEMA.md)
- [API接口详细文档](docs/api.md)
- [开发指南](docs/development.md)
- [部署手册](docs/deployment.md)

## 🤝 贡献指南

1. Fork项目
2. 创建特性分支 (`git checkout -b feature/new-feature`)
3. 提交更改 (`git commit -am 'Add new feature'`)
4. 推送分支 (`git push origin feature/new-feature`)
5. 创建Pull Request

## 📄 许可证

本项目采用 ISC 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情。

---

**🎉 开始使用 Drudge 构建智能新闻知识图谱！**
