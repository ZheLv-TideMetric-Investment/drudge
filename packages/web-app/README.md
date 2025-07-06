# Web App - 新闻图谱应用

基于 Next.js 构建的新闻图谱可视化应用，集成了定时任务调度功能。

## 主要功能

### 1. 新闻图谱可视化
- 实时显示新闻网络图谱
- 支持多种图表类型
- 交互式数据探索

### 2. 定时任务调度系统
- **高级别新闻扫描**：每5分钟扫描Level 1和Level 2新闻并发送通知
- **小时总结**：工作时间(11:00-22:00)每小时生成新闻总结
- **每日总结**：每天10:00生成前一天22:00到当天10:00的新闻总结

### 3. 智能通知系统
- 根据调用来源决定是否发送通知
- 定时任务调用时自动发送Webhook通知
- 手动API调用时不发送通知

## 环境配置

创建 `.env.local` 文件：

```bash
# Neo4j 数据库配置
NEO4J_URI=bolt://localhost:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=password
NEO4J_DATABASE=neo4j

# 通知配置
ENABLE_WEBHOOK_NOTIFICATION=true
WEBHOOK_URL=https://your-webhook-url.com/webhook

# 定时任务配置
CRON_HIGH_LEVEL_SCAN=0 */5 * * * *
CRON_HOURLY_SUMMARY=0 0 11-22 * * *
CRON_DAILY_SUMMARY=0 0 10 * * *

# 日志配置
LOG_LEVEL=info
LOG_FILE=logs/app.log
```

## 快速开始

1. 安装依赖：
```bash
npm install
```

2. 启动开发服务器：
```bash
npm run dev
```

3. 打开浏览器访问 `http://localhost:3000`

## API 接口

### 调度器管理

- **GET /api/scheduler/status** - 获取调度器状态
- **POST /api/scheduler/trigger/[jobName]** - 手动触发任务

### 总结功能

- **POST /api/summary/hourly** - 生成小时总结
- **POST /api/summary/daily** - 生成每日总结

### 扫描功能

- **POST /api/scan/high-level** - 扫描高级别新闻

## 架构特点

- **Next.js 13+ App Router**：使用最新的 App Router 架构
- **函数式编程**：避免类式编程，使用函数式风格
- **TypeScript**：完整的类型安全
- **模块化设计**：清晰的服务分层
- **优雅关闭**：支持进程信号处理

## 服务架构

```
src/
├── lib/
│   ├── config.ts           # 配置管理
│   ├── scheduler.ts        # 定时任务调度器
│   ├── services/           # 业务服务
│   │   ├── neo4j.ts        # Neo4j 数据库服务
│   │   ├── webhook.ts      # Webhook 通知服务
│   │   ├── notification.ts # 通知管理服务
│   │   ├── query.ts        # 查询服务
│   │   ├── summary.ts      # 总结服务
│   │   └── high-level-scanner.ts # 高级别新闻扫描器
│   └── utils/
│       └── llm.ts          # LLM 工具函数
├── app/
│   ├── api/                # API 路由
│   │   ├── scheduler/      # 调度器 API
│   │   ├── summary/        # 总结 API
│   │   └── scan/           # 扫描 API
│   └── page.tsx            # 主页面
└── types/
    └── scheduler.ts        # 类型定义
```

## 任务调度详情

### 高级别新闻扫描 (high-level-scan)
- **频率**：每5分钟执行一次
- **功能**：扫描Level 1和Level 2新闻
- **通知**：发现新的高级别新闻时发送通知

### 小时总结 (hourly-summary)
- **频率**：工作时间(11:00-22:00)每小时整点执行
- **功能**：生成该小时的新闻总结
- **通知**：有高级别新闻时发送总结通知

### 每日总结 (daily-summary)
- **频率**：每天10:00执行
- **功能**：总结前一天22:00到当天10:00的新闻
- **通知**：发送每日总结通知

## 开发特性

- **热重载**：开发环境自动重载
- **类型检查**：TypeScript 严格模式
- **错误处理**：完整的错误处理机制
- **日志记录**：详细的操作日志

## 部署说明

1. 构建项目：
```bash
npm run build
```

2. 启动生产服务器：
```bash
npm start
```

3. 确保 Neo4j 数据库正常运行
4. 配置 Webhook URL 用于通知推送

## 注意事项

- 定时任务在服务器端自动启动
- 只有定时任务调用时才会发送通知
- 手动API调用不会发送通知
- 支持优雅关闭，可以安全停止服务
