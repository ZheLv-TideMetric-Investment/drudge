# Drudge - 实时新闻处理与知识图谱系统

![](https://img.shields.io/badge/Node.js-18+-green.svg)
![](https://img.shields.io/badge/Neo4j-5.0+-blue.svg)
![](https://img.shields.io/badge/License-ISC-yellow.svg)

一个基于AI驱动的实时新闻处理与知识图谱构建系统，能够自动获取新闻、提取实体关系、构建知识图谱，并提供智能分析功能。

## 🌟 核心功能

### 🤖 AI驱动的新闻处理
- **智能实体提取**: 使用大语言模型提取新闻中的事件、公司、人物、地点、时间等实体
- **新闻等级分类**: 自动将新闻分为1-5级重要性等级（Level 1为紧急新闻，Level 5为信息性新闻）
- **批量处理优化**: 支持批量AI调用和数据库操作，显著提升处理效率

### 📊 知识图谱构建
- **实体建模**: 基于新闻六要素（5W1H）设计的完整实体模型
- **关系推理**: 自动识别和建立实体间的复杂关系
- **图数据库存储**: 使用Neo4j存储和查询复杂的知识图谱
- **增量更新**: 支持实体和关系的增量更新和合并

### 🔍 三大核心服务

#### 1. Break News检测服务
- 实时监控新闻流，自动识别突发重要新闻
- 根据新闻级别和重要性进行实时推送
- 支持钉钉机器人等多种通知方式

#### 2. 按小时总结服务
- 定时汇总每小时的重要新闻和事件
- 生成结构化的小时总结报告
- 识别当前时段的热点话题和趋势

#### 3. 草蛇灰线追踪服务
- 基于关键词和实体进行深度关联分析
- 追踪事件发展脉络和潜在影响
- 发现隐藏的关联关系和趋势模式

### 🔧 系统特性
- **工作线程架构**: 主线程负责管理，工作线程处理具体任务
- **定时调度**: 基于cron表达式的灵活定时任务调度
- **错误恢复**: 完善的错误处理和自动恢复机制
- **幂等设计**: 支持重复处理，确保数据一致性
- **监控告警**: 实时系统状态监控和异常告警

## 🏗️ 系统架构

```
drudge/
├── src/
│   ├── application/          # 应用层
│   │   └── services/         # 核心业务服务
│   │       ├── NewsProcessingService.js     # 新闻处理服务
│   │       ├── hourlySummaryService.js      # 按小时总结服务
│   │       ├── snakeTrackingService.js      # 草蛇灰线追踪服务
│   │       ├── knowledgeGraphService.js     # 知识图谱服务
│   │       └── newsLevelService.js          # 新闻等级服务
│   ├── domain/               # 领域层
│   │   ├── entities/         # 领域实体模型
│   │   └── services/         # 领域服务
│   │       └── entityExtractionService.js  # 实体提取服务
│   ├── infrastructure/       # 基础设施层
│   │   ├── database/         # 数据库访问
│   │   │   ├── Neo4jRepository.js           # Neo4j操作
│   │   │   └── GraphRepository.js           # 图数据库抽象
│   │   ├── external/         # 外部服务集成
│   │   │   ├── AiService.js                 # AI/LLM服务
│   │   │   ├── NewsApiService.js            # 新闻API服务
│   │   │   └── WebhookService.js            # 钉钉通知服务
│   │   └── storage/          # 存储服务
│   ├── interfaces/           # 接口层
│   │   ├── controllers/      # 控制器
│   │   └── schedulers/       # 定时任务调度
│   ├── workers/              # 工作线程
│   ├── scripts/              # 工具脚本
│   └── shared/               # 共享组件
├── neo4j/                    # Neo4j数据库配置
│   └── schema.cypher         # 数据库模式定义
├── scripts/                  # 外部工具脚本
│   └── cleanNeo4j.js         # 数据库清理工具
└── logs/                     # 日志文件
```

### 技术栈
- **运行时**: Node.js 18+ (ES Module)
- **数据库**: Neo4j 5.0+ (图数据库)
- **AI/LLM**: DeepSeek API (支持多种LLM)
- **定时任务**: node-cron
- **进程管理**: PM2
- **日志**: Winston
- **通知**: 钉钉机器人

## 🚀 快速开始

### 环境要求
- Node.js 18+
- Neo4j 5.0+
- DeepSeek API Key (或其他LLM API)

### 安装步骤

1. **克隆项目**
```bash
git clone [repository-url]
cd drudge
```

2. **安装依赖**
```bash
npm install
```

3. **配置环境变量**
```bash
cp .env.example .env
```

编辑 `.env` 文件：
```env
# 钉钉机器人配置
WEBHOOK_URL=your_dingtalk_webhook_url

# AI服务配置
AI_API_KEY=your_deepseek_api_key
AI_BASE_URL=https://api.deepseek.com
AI_MODEL=deepseek-reasoner

# Neo4j数据库配置
NEO4J_URI=bolt://localhost:7687
NEO4J_USERNAME=neo4j
NEO4J_PASSWORD=your_password

# 其他配置
STORAGE_PATH=./data
LOG_LEVEL=info
```

4. **初始化Neo4j数据库**
```bash
# 应用数据库模式
npm run schema:apply

# 或手动执行
cypher-shell -f neo4j/schema.cypher
```

5. **启动系统**
```bash
# 开发环境
npm run dev

# 生产环境
npm start

# 使用PM2管理（推荐）
npm run pm2:start
```

## 📖 使用指南

### 脚本使用指南

本系统使用简化的脚本命令，通过基本命令加参数的方式执行功能：

#### 📰 新闻管理
```bash
npm run news                     # 显示帮助信息
npm run news fetch               # 获取最新新闻
npm run news fetch-batch 3       # 获取最近3天新闻
npm run news list 20             # 列出最新20条新闻
npm run news count               # 查看新闻统计
npm run news status              # 查看模块状态
```

#### 🧠 知识图谱处理
```bash
npm run graph                    # 显示帮助信息
npm run graph process            # 处理未处理的新闻
npm run graph process-batch 30   # 批量处理30条新闻
npm run graph process-recent 12  # 处理最近12小时新闻
npm run graph query "苹果公司" 15 # 查询相关新闻
npm run graph stats              # 查看图谱统计
npm run graph status             # 查看模块状态
```

#### 📊 新闻等级检查
```bash
npm run level                    # 显示帮助信息
npm run level check 100          # 检查新闻等级
npm run level check-recent 24    # 检查最近24小时新闻
npm run level break-news 3       # 查找Break News
npm run level stats 7            # 获取等级统计
```

#### 🐍 草蛇灰线追踪
```bash
npm run snake                    # 显示帮助信息
npm run snake hunt               # 开始追踪分析
npm run snake progress           # 查看追踪进度
npm run snake report 3           # 生成3天报告
npm run snake status             # 追踪系统状态
```

#### 🩺 系统健康检查
```bash
npm run health                   # 完整健康检查
npm run health quick             # 快速检查
npm run health services          # 检查服务状态
npm run health database          # 检查数据库
npm run health stats             # 系统统计
```

### 数据库管理

```bash
# 查看数据库统计
npm run clean:neo4j stats

# 清理孤立节点
npm run clean:neo4j orphaned

# 按时间清理数据
npm run clean:neo4j before 2025-01-01

# 完全清空数据库
npm run clean:neo4j all
```

## 🔧 配置说明

### 新闻等级分类
- **Level 1**: 紧急新闻 - 全球性重大事件，立即推送
- **Level 2**: 高优先级新闻 - 重要经济/政治事件
- **Level 3**: 中等优先级新闻 - 行业重要事件
- **Level 4**: 低优先级新闻 - 局部影响事件
- **Level 5**: 信息性新闻 - 背景信息更新

### 批量处理配置
```env
BATCH_ENABLED=true           # 启用批量处理
BATCH_MIN_SIZE=3             # 最小批量大小
BATCH_MAX_SIZE=5             # 最大批量大小
BATCH_AI_RETRY=3             # AI调用重试次数
BATCH_DB_SIZE=20             # 数据库批量大小
BATCH_DELAY=500              # 批次间延迟(ms)
```

### 工作线程配置
```env
WORKERS_ENABLED=true         # 启用工作线程
MAX_WORKERS=2                # 最大工作线程数
WORKER_TIMEOUT=300000        # 工作线程超时时间(ms)
```

## 📊 API接口

### 系统状态查询
```javascript
// 获取系统整体状态
GET /api/system/status

// 获取图数据库统计
GET /api/graph/stats

// 健康检查
GET /api/health
```

### 新闻处理
```javascript
// 手动触发新闻处理
POST /api/news/process

// 获取新闻等级分布
GET /api/news/levels

// 查询特定等级新闻
GET /api/news?level=1
```

### 知识图谱查询
```javascript
// 查询实体关系
GET /api/graph/entity/{name}

// 搜索相关事件
GET /api/graph/events?query={keyword}

// 获取公司关联事件
GET /api/graph/company/{name}/events
```

## 🛠️ 开发指南

### 代码规范
```bash
# 代码格式化
npm run format

# 代码检查
npm run lint

# 修复lint问题
npm run lint:fix
```

### 测试
```bash
# 运行测试
npm test

# 运行健康检查
npm run health-check
```

### 部署
```bash
# 使用PM2部署
npm run pm2:start

# 查看日志
npm run pm2:logs

# 重启服务
npm run pm2:restart

# 停止服务
npm run pm2:stop
```

## 📝 日志和监控

### 日志文件
- `logs/app.log` - 应用主日志
- `logs/error.log` - 错误日志
- `logs/out.log` - 标准输出日志

### 监控指标
- 新闻处理速度和成功率
- AI调用延迟和成功率
- 数据库连接状态
- 内存和CPU使用情况
- 定时任务执行状态

## 🚨 故障排除

### 常见问题

1. **Neo4j连接失败**
   - 检查Neo4j服务是否启动
   - 验证连接配置和认证信息

2. **AI调用失败**
   - 检查API密钥是否正确
   - 验证网络连接和API配额

3. **钉钉通知失败**
   - 确认webhook URL正确
   - 检查消息是否包含必需的关键字

4. **内存使用过高**
   - 调整批量处理大小
   - 检查数据库连接池配置

### 性能优化
- 调整批量处理参数
- 使用数据库索引优化查询
- 合理设置工作线程数量
- 定期清理历史数据

## 🤝 贡献指南

1. Fork 项目
2. 创建特性分支 (`git checkout -b feature/amazing-feature`)
3. 提交更改 (`git commit -m 'Add amazing feature'`)
4. 推送到分支 (`git push origin feature/amazing-feature`)
5. 创建 Pull Request

## 📄 许可证

本项目采用 ISC 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情

## 📞 支持

如有问题或建议，请：
- 提交 [Issue](../../issues)
- 发送邮件到 [micrott526@gmail.com]
- 查看 [Wiki](../../wiki) 文档

---

*Drudge - 让新闻数据变得更智能* 🚀