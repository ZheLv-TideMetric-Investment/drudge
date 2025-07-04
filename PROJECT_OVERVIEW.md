# 新闻知识图谱系统

## 项目概述

这是一个基于AI的新闻处理和知识图谱系统，能够自动获取、处理、分析新闻数据，构建知识图谱，并提供智能总结和实时监控功能。系统采用前后端分离架构，后端负责数据处理和图谱构建，前端提供可视化查询界面。

## 系统架构

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   新闻API       │    │   文件存储       │    │   Neo4j数据库   │
│   (外部数据源)   │ ─→ │   (本地缓存)     │ ─→ │   (知识图谱)     │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                │                      │
                                ▼                      ▼
┌─────────────────────────────────────────────────────────────────┐
│                     后端服务 (Node.js)                          │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ │
│  │ 新闻获取     │ │ 实体提取     │ │ 级别评估     │ │ 总结生成     │ │
│  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘ │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ │
│  │ 图谱构建     │ │ 关系抽取     │ │ 定时任务     │ │ CLI工具      │ │
│  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼ (REST API)
┌─────────────────────────────────────────────────────────────────┐
│                     前端应用 (Next.js)                          │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ │
│  │ 数据概览     │ │ 新闻浏览     │ │ 图谱可视化   │ │ 总结报告     │ │
│  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘ │
│  ┌─────────────┐ ┌─────────────┐                               │
│  │ 实时监控     │ │ 统计分析     │                               │
│  └─────────────┘ └─────────────┘                               │
└─────────────────────────────────────────────────────────────────┘
```

## 项目结构

```
drudge/                              # 项目根目录
├── README.md                        # 项目说明
├── package.json                     # 后端依赖配置
├── tsconfig.json                    # TypeScript配置
├── ecosystem.config.js              # PM2部署配置
├── nodemon.json                     # 开发环境配置
│
├── src/                             # 后端源代码
│   ├── index.ts                     # 应用入口
│   │
│   ├── application/                 # 应用层
│   │   ├── services/                # 业务服务
│   │   │   ├── core/                # 核心服务
│   │   │   │   ├── NewsService.ts           # 新闻处理服务
│   │   │   │   ├── EntityService.ts        # 实体服务
│   │   │   │   └── RelationshipService.ts  # 关系服务
│   │   │   ├── business/            # 业务服务
│   │   │   │   ├── QueryService.ts         # 查询服务
│   │   │   │   ├── NotificationService.ts  # 通知服务
│   │   │   │   ├── HourlySummaryService.ts # 小时总结服务
│   │   │   │   ├── DailySummaryService.ts  # 每日总结服务
│   │   │   │   ├── HighLevelNewsScanner.ts # 高级别新闻扫描
│   │   │   │   └── NewsLevelService.ts     # 新闻级别服务
│   │   │   ├── system/              # 系统服务
│   │   │   │   ├── NewsAcquisitionService.ts # 新闻获取服务
│   │   │   │   └── SystemHealthService.ts   # 系统健康检查
│   │   │   ├── processing/          # 处理服务
│   │   │   │   └── entityExtractionService.ts # 实体提取服务
│   │   │   ├── KnowledgeGraphServiceV2.ts   # 知识图谱服务V2
│   │   │   └── NewsProcessingServiceV2.ts   # 新闻处理服务V2
│   │   └── use-cases/               # 用例层
│   │       └── ProcessNewsUseCase.ts
│   │
│   ├── domain/                      # 领域层
│   │   ├── entities/                # 实体定义
│   │   │   ├── index.ts
│   │   │   ├── Company.ts
│   │   │   ├── Person.ts
│   │   │   ├── Location.ts
│   │   │   ├── Event.ts
│   │   │   ├── Time.ts
│   │   │   └── NewsExtractionResult.ts
│   │   ├── repositories/            # 仓储接口
│   │   │   └── NewsRepository.ts
│   │   └── value-objects/           # 值对象
│   │       └── NewsLevel.ts
│   │
│   ├── infrastructure/              # 基础设施层
│   │   ├── database/                # 数据库
│   │   │   ├── Neo4jRepository.ts
│   │   │   └── GraphRepository.ts
│   │   ├── external/                # 外部服务
│   │   │   ├── NewsApiService.ts
│   │   │   ├── AiService.ts
│   │   │   └── WebhookService.ts
│   │   ├── storage/                 # 存储
│   │   │   └── FileStorage.ts
│   │   └── workers/                 # 工作线程
│   │       ├── newsProcessorWorker.ts
│   │       └── schedulerWorker.ts
│   │
│   ├── interfaces/                  # 接口层
│   │   ├── cli/                     # 命令行工具
│   │   │   ├── newsAcquisition.ts
│   │   │   ├── knowledgeGraph.ts
│   │   │   ├── newsLevelCheck.ts
│   │   │   └── systemHealth.ts
│   │   └── schedulers/              # 调度器
│   │       ├── schedulerManager.ts
│   │       └── workerManager.ts
│   │
│   └── shared/                      # 共享模块
│       ├── config/                  # 配置
│       │   └── config.ts
│       ├── types/                   # 类型定义
│       │   ├── common.ts
│       │   └── enums.ts
│       ├── utils/                   # 工具函数
│       │   ├── logger.ts
│       │   └── llm.ts
│       └── errors/                  # 错误处理
│           ├── BaseError.ts
│           └── ProcessingError.ts
│
├── web/                             # 前端应用
│   ├── package.json                 # 前端依赖配置
│   ├── next.config.ts               # Next.js配置
│   ├── tailwind.config.ts           # Tailwind CSS配置
│   │
│   └── src/                         # 前端源代码
│       ├── app/                     # App Router页面
│       │   ├── layout.tsx           # 根布局
│       │   ├── page.tsx             # 首页(Dashboard)
│       │   ├── news/                # 新闻页面
│       │   ├── graph/               # 知识图谱页面
│       │   ├── summary/             # 总结报告页面
│       │   ├── monitor/             # 实时监控页面
│       │   └── analytics/           # 统计分析页面
│       │
│       ├── components/              # React组件
│       │   ├── Layout.tsx           # 主布局组件
│       │   ├── ui/                  # UI基础组件
│       │   │   ├── Card.tsx
│       │   │   └── Loading.tsx
│       │   ├── charts/              # 图表组件
│       │   └── graph/               # 图谱可视化组件
│       │
│       ├── lib/                     # 工具库
│       │   ├── config.ts            # 配置文件
│       │   ├── api.ts               # API客户端
│       │   └── utils.ts             # 工具函数
│       │
│       └── types/                   # TypeScript类型
│           └── index.ts
│
├── scripts/                         # 构建脚本
│   ├── build-workers.cjs
│   ├── dev.cjs
│   ├── fix-imports.cjs
│   └── db/
│       └── install_neo4j.sh
│
├── neo4j/                           # Neo4j配置
│   └── schema.cypher                # 数据库schema
│
├── data/                            # 数据存储目录
├── logs/                            # 日志文件
└── dist/                            # 编译输出
```

## 核心功能

### 1. 新闻数据处理流程

```
新闻获取 → 实体提取 → 级别评估 → 图谱构建 → 总结生成
    ↓         ↓         ↓         ↓         ↓
  文件存储   AI分析    级别分类   Neo4j     智能摘要
```

### 2. 定时任务系统

- **每分钟**: 自动获取新闻数据
- **每5分钟**: 扫描高级别新闻并发送通知
- **每小时** (11:00-22:00): 生成小时总结报告
- **每日10:00**: 生成前一天22:00-今天10:00的每日总结

### 3. 知识图谱实体

- **新闻节点**: 包含标题、内容、级别、时间等
- **公司节点**: 公司名称、行业、市场等信息
- **人物节点**: 姓名、职位、国籍等信息
- **地点节点**: 地名、类型、坐标等信息
- **事件节点**: 事件名称、类型、级别、情感等
- **时间节点**: 时间值、格式化信息等

### 4. 新闻级别分类

- **Level 1** (🔴 紧急): 重大突发事件
- **Level 2** (🟠 重要): 重要新闻事件
- **Level 3** (🟡 中等): 一般重要新闻
- **Level 4** (🟢 一般): 普通新闻
- **Level 5** (⚪ 低): 日常资讯

## 安装与部署

### 环境要求

- Node.js 18+
- Neo4j 5.0+
- npm 或 yarn

### 后端安装

```bash
# 1. 克隆项目
git clone <repository-url>
cd drudge

# 2. 安装依赖
npm install

# 3. 配置环境变量
cp .env.example .env
# 编辑 .env 文件，配置Neo4j连接和API密钥

# 4. 启动Neo4j数据库
# 确保Neo4j服务运行在 bolt://localhost:7687

# 5. 初始化数据库schema
npm run schema:apply

# 6. 构建项目
npm run build

# 7. 启动服务
npm start
```

### 前端安装

```bash
# 1. 进入前端目录
cd web

# 2. 安装依赖
npm install

# 3. 配置环境变量
cp .env.example .env.local
# 编辑环境变量，配置后端API地址

# 4. 启动开发服务器
npm run dev

# 或构建生产版本
npm run build
npm start
```

## 使用方式

### CLI命令

#### 新闻获取工具
```bash
# 获取最新新闻
npm run news fetch [数量]

# 获取指定来源的新闻
npm run news fetch-source <来源> [数量]

# 获取新闻统计
npm run news stats [天数]

# 查看帮助
npm run news help
```

#### 知识图谱工具
```bash
# 处理未处理的新闻
npm run graph process [限制数]

# 批量处理新闻
npm run graph process-batch [数量]

# 处理最近新闻
npm run graph process-recent [小时]

# 重新处理指定新闻
npm run graph reprocess <新闻ID>

# 查询知识图谱
npm run graph query <关键词> [限制数]

# 显示图谱统计
npm run graph stats

# 生成小时总结
npm run graph hourly-summary [小时]

# 生成每日总结
npm run graph daily-summary

# 扫描高级别新闻
npm run graph scan-high-level [分钟数]

# 查看帮助
npm run graph help
```

#### 新闻级别检查
```bash
# 批量检查新闻级别
npm run level check [限制数]

# 检查最近新闻级别
npm run level check-recent [小时数]

# 检查单个新闻级别
npm run level check-single <新闻ID>

# 重新扫描新闻级别
npm run level rescan [限制数]

# 发送突发新闻通知
npm run level notify [小时数]

# 获取级别统计
npm run level stats [天数]

# 获取突发新闻历史
npm run level history [天数]

# 查看帮助
npm run level help
```

#### 系统健康检查
```bash
# 检查系统健康状态
npm run health check

# 检查各组件状态
npm run health components

# 检查数据库连接
npm run health database

# 检查外部服务
npm run health external

# 生成健康报告
npm run health report

# 查看帮助
npm run health help
```

### Web界面功能

访问 `http://localhost:3000` 使用Web界面：

1. **概览页面** (`/`)
   - 系统数据概览
   - 新闻统计图表
   - 最新动态

2. **新闻页面** (`/news`)
   - 新闻列表和搜索
   - 级别筛选
   - 详情查看

3. **知识图谱** (`/graph`)
   - 交互式图谱可视化
   - 实体关系探索
   - 图谱搜索

4. **总结报告** (`/summary`)
   - 小时总结历史
   - 每日总结查看
   - 趋势分析

5. **实时监控** (`/monitor`)
   - 高级别新闻监控
   - 系统状态监控
   - 告警管理

6. **统计分析** (`/analytics`)
   - 数据统计图表
   - 趋势分析
   - 报表生成

## 开发脚本

### 后端开发
```bash
# 开发模式启动
npm run dev

# 简单开发模式
npm run dev:simple

# 监听模式
npm run dev:watch

# 构建项目
npm run build

# 构建worker
npm run build:workers

# 代码格式化
npm run format

# 代码检查
npm run lint

# 修复代码问题
npm run lint:fix
```

### 前端开发
```bash
# 进入前端目录
cd web

# 开发模式
npm run dev

# 构建
npm run build

# 启动生产服务器
npm start

# 代码检查
npm run lint

# 类型检查
npm run type-check
```

### 生产部署

#### PM2部署
```bash
# 启动PM2服务
npm run pm2:start

# 停止服务
npm run pm2:stop

# 重启服务
npm run pm2:restart

# 查看日志
npm run pm2:logs

# 查看状态
npm run pm2:status
```

#### Docker部署
```bash
# 构建Docker镜像
docker build -t news-knowledge-graph .

# 运行容器
docker run -d \
  --name news-kg \
  -p 3000:3000 \
  -p 3001:3001 \
  -e NEO4J_URI=bolt://neo4j:7687 \
  news-knowledge-graph
```

## API文档

### 新闻API
- `GET /api/news` - 获取新闻列表
- `GET /api/news/:id` - 获取单个新闻
- `GET /api/news/search` - 搜索新闻
- `GET /api/news/stats` - 获取新闻统计

### 知识图谱API
- `GET /api/graph/data` - 获取图谱数据
- `GET /api/graph/stats` - 获取图谱统计
- `GET /api/graph/search` - 搜索实体
- `GET /api/graph/related` - 获取相关新闻

### 总结API
- `GET /api/summary/hourly` - 获取小时总结
- `POST /api/summary/hourly/generate` - 生成小时总结
- `GET /api/summary/daily` - 获取每日总结
- `POST /api/summary/daily/generate` - 生成每日总结

### 监控API
- `GET /api/monitor/alerts` - 获取监控告警
- `POST /api/monitor/scan` - 手动扫描
- `GET /api/monitor/stats` - 获取监控统计

## 配置说明

### 环境变量
```env
# Neo4j数据库配置
NEO4J_URI=bolt://localhost:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=password

# AI服务配置
DEEPSEEK_API_KEY=your_deepseek_api_key
GOOGLE_API_KEY=your_google_api_key

# 新闻API配置
NEWS_API_KEY=your_news_api_key

# Webhook配置
WEBHOOK_URL=your_webhook_url

# 应用配置
NODE_ENV=production
PORT=3001
LOG_LEVEL=info
```

### Neo4j Schema
```cypher
// 创建索引
CREATE INDEX FOR (n:News) ON (n.newsId);
CREATE INDEX FOR (c:Company) ON (c.company_name);
CREATE INDEX FOR (p:Person) ON (p.person_name);
CREATE INDEX FOR (e:Event) ON (e.event_id);
CREATE INDEX FOR (l:Location) ON (l.location_name);
CREATE INDEX FOR (t:Time) ON (t.time_value);

// 创建约束
CREATE CONSTRAINT FOR (n:News) REQUIRE n.newsId IS UNIQUE;
CREATE CONSTRAINT FOR (e:Event) REQUIRE e.event_id IS UNIQUE;
```

## 技术栈

### 后端技术
- **Node.js** - 运行时环境
- **TypeScript** - 编程语言
- **Neo4j** - 图数据库
- **AI SDK** - AI模型集成
- **Winston** - 日志管理
- **node-cron** - 定时任务
- **PM2** - 进程管理

### 前端技术
- **Next.js 14** - React框架
- **TypeScript** - 编程语言
- **Tailwind CSS** - 样式框架
- **Headless UI** - UI组件
- **Heroicons** - 图标库
- **Recharts** - 图表库
- **vis.js** - 图谱可视化

## 贡献指南

1. Fork项目
2. 创建功能分支
3. 提交更改
4. 推送到分支
5. 创建Pull Request

## 许可证

MIT License

## 联系方式

如有问题或建议，请通过以下方式联系：
- 邮箱: [your-email@example.com]
- GitHub: [your-github-profile]

---

**注意**: 这是一个实验性项目，请在生产环境使用前进行充分测试。 