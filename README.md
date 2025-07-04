# 新闻知识图谱系统

## 项目概述

这是一个基于AI的新闻处理和知识图谱系统，能够自动获取、处理、分析新闻数据，构建知识图谱，并提供智能总结和实时监控功能。系统采用前后端分离架构，后端负责数据处理和图谱构建，前端提供可视化查询界面。

## 系统特性

### 🚀 核心功能
- **新闻自动获取**: 从多个新闻源自动抓取最新新闻
- **智能实体提取**: 使用AI模型提取新闻中的实体和关系
- **新闻级别评估**: 自动评估新闻的重要性等级(1-5级)
- **知识图谱构建**: 构建动态更新的知识图谱
- **智能总结**: 生成小时级和每日新闻总结
- **实时监控**: 高级别新闻预警和系统状态监控

### 🛠️ 技术栈
- **后端**: Node.js + TypeScript + Neo4j
- **前端**: Next.js + React + TypeScript + Tailwind CSS
- **数据库**: Neo4j图数据库
- **AI服务**: DeepSeek API + Google AI
- **部署**: PM2进程管理

### 📊 数据可视化
- 交互式知识图谱展示
- 实时数据统计图表
- 新闻级别分布分析
- 趋势分析和报告

## 快速开始

### 环境要求
- Node.js 18+
- Neo4j 5.0+
- npm 8.0+

### 安装步骤

1. **克隆项目**
```bash
git clone <repository-url>
cd drudge
```

2. **安装后端依赖**
```bash
npm install
```

3. **配置环境变量**
```bash
cp .env.example .env
# 编辑 .env 文件，配置数据库连接和API密钥
```

4. **启动Neo4j数据库**
确保Neo4j服务运行在 `bolt://localhost:7687`

5. **初始化数据库**
```bash
npm run schema:apply
```

6. **构建并启动后端**
```bash
npm run build
npm start
```

7. **安装并启动前端**
```bash
cd web
npm install
npm run dev
```

8. **访问应用**
- 前端界面: http://localhost:3000
- API文档: http://localhost:3001

## 使用指南

### CLI工具

#### 新闻获取
```bash
npm run news:dev fetch [数量]            # 获取最新新闻
npm run news:dev stats [天数]            # 查看新闻统计
```

#### 知识图谱
```bash
npm run graph:dev process [限制数]        # 处理新闻构建图谱
npm run graph:dev query <关键词> [限制数]  # 查询图谱
npm run graph:dev stats                 # 显示图谱统计
```

#### 级别检查
```bash
npm run level:dev check [限制数]          # 检查新闻级别
npm run level:dev notify [小时数]         # 发送高级别新闻通知
```

#### 系统监控
```bash
npm run health:dev check                 # 系统健康检查
npm run health:dev report                # 生成健康报告
```

### Web界面功能

1. **概览页面** (`/`) - 数据统计和最新动态
2. **新闻页面** (`/news`) - 新闻列表、搜索和筛选
3. **知识图谱** (`/graph`) - 交互式图谱可视化
4. **总结报告** (`/summary`) - 智能总结和趋势分析
5. **实时监控** (`/monitor`) - 系统状态和告警管理
6. **统计分析** (`/analytics`) - 数据分析和报表

## 项目结构

```
drudge/
├── src/                    # 后端源代码
│   ├── application/        # 应用层
│   │   ├── services/       # 业务服务
│   │   └── use-cases/      # 用例
│   ├── domain/             # 领域层
│   │   ├── entities/       # 实体定义
│   │   └── repositories/   # 仓储接口
│   ├── infrastructure/     # 基础设施层
│   │   ├── database/       # 数据库
│   │   ├── external/       # 外部服务
│   │   └── workers/        # 工作线程
│   ├── interfaces/         # 接口层
│   │   ├── cli/            # CLI工具
│   │   └── schedulers/     # 调度器
│   └── shared/             # 共享模块
├── web/                    # 前端应用
│   └── src/
│       ├── app/            # Next.js页面
│       ├── components/     # React组件
│       ├── lib/            # 工具库
│       └── types/          # 类型定义
├── data/                   # 数据存储
├── logs/                   # 日志文件
└── scripts/                # 构建脚本
```

## 开发脚本

### 后端开发
```bash
npm run dev                 # 开发模式
npm run build               # 构建项目
npm run start               # 启动服务
npm run pm2:start           # PM2启动
npm run lint                # 代码检查
npm run format              # 代码格式化
```

### 前端开发
```bash
cd web
npm run dev                 # 开发模式
npm run build               # 构建项目
npm run start               # 启动服务
npm run lint                # 代码检查
```

## 新闻级别分类

| 级别 | 名称 | 标识 | 描述 |
|------|------|------|------|
| Level 1 | 紧急 | 🔴 | 重大突发事件、国际危机 |
| Level 2 | 重要 | 🟠 | 重要新闻事件、政策变化 |
| Level 3 | 中等 | 🟡 | 一般重要新闻、市场动态 |
| Level 4 | 一般 | 🟢 | 普通新闻、日常报道 |
| Level 5 | 低 | ⚪ | 日常资讯、轻松内容 |

## 定时任务

- **每分钟**: 自动获取新闻数据
- **每5分钟**: 扫描高级别新闻并发送通知
- **每小时** (11:00-22:00): 生成小时总结报告
- **每日10:00**: 生成每日总结报告

## 配置说明

### 环境变量
```bash
# Neo4j配置
NEO4J_URI=bolt://localhost:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=password

# AI服务配置
DEEPSEEK_API_KEY=your_api_key
GOOGLE_API_KEY=your_api_key

# 新闻API配置
NEWS_API_KEY=your_api_key

# 通知配置
WEBHOOK_URL=your_webhook_url
```

## 部署指南

### 开发环境
```bash
# 启动Neo4j
docker run -d --name neo4j -p 7474:7474 -p 7687:7687 neo4j

# 启动后端
npm run dev

# 启动前端
cd web && npm run dev
```

### 生产环境
```bash
# 构建项目
npm run build
cd web && npm run build

# 使用PM2部署
npm run pm2:start

# 启动前端
cd web && npm start
```

## 监控与维护

### 系统监控
```bash
npm run health:dev check    # 健康检查
npm run pm2:logs            # 查看日志
npm run pm2:status          # 进程状态
```

### 数据备份
```bash
# 备份Neo4j数据
cypher-shell "CALL apoc.export.cypher.all('backup.cypher', {})"

# 备份数据文件
tar -czf backup-$(date +%Y%m%d).tar.gz data/
```

## 技术文档

- 📖 [详细项目文档](./应用介绍文档.md) - 完整的项目介绍和使用说明
- 🔧 [API文档](./docs/api.md) - 完整的API接口说明
- 🏗️ [架构文档](./docs/architecture.md) - 系统架构和设计说明

## 贡献指南

1. Fork本项目
2. 创建功能分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 创建Pull Request

## 许可证

MIT License - 详见 [LICENSE](LICENSE) 文件

## 联系我们

- 📧 邮箱: [your-email@example.com]
- 🐛 问题反馈: [GitHub Issues](https://github.com/your-username/drudge/issues)
- 📖 文档: [项目文档](./应用介绍文档.md)

---

**注意**: 这是一个实验性项目，请在生产环境使用前进行充分测试。