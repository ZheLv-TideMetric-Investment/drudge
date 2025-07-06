# 🚀 Monorepo 迁移指南

## 📋 重构完成清单

### ✅ 已完成的重构内容

1. **根目录配置**
   - ✅ 创建 `pnpm-workspace.yaml` 工作空间配置
   - ✅ 重构 `package.json` 为 monorepo 管理器
   - ✅ 创建 `docker-compose.yml` 多服务编排
   - ✅ 更新 `.gitignore` 支持多包环境变量

2. **四个独立包**
   - ✅ **web-app** (`packages/web-app/`): Next.js前端应用
   - ✅ **scheduler**: 已迁移到 web-app 中
   - ✅ **ingest-worker** (`packages/ingest-worker/`): 数据摄取工作器
   - ✅ **graph-worker** (`packages/graph-worker/`): 图谱处理工作器

3. **环境变量分离**
   - ✅ 每个包有独立的 `.env.example` 模板
   - ✅ 机密配置完全隔离
   - ✅ 支持不同环境配置

4. **Docker化部署**
   - ✅ 每个包有独立的 Dockerfile
   - ✅ Docker Compose 一键部署
   - ✅ 生产环境优化配置

5. **开发工具链**
   - ✅ 统一的 TypeScript 配置
   - ✅ 并行开发模式
   - ✅ 代码检查和格式化

## 🏗️ 新架构说明

### 服务端口分配
```
┌─────────────────┬──────┬─────────────────────────┐
│     服务        │ 端口 │         描述            │
├─────────────────┼──────┼─────────────────────────┤
│ web-app         │ 3000 │ Next.js前端应用         │
│ scheduler       │ 3002 │ 定时任务调度服务        │
│ ingest-worker   │ 3003 │ 新闻获取和级别评估      │
│ graph-worker    │ 3004 │ 图谱构建和实体提取      │
│ Neo4j (HTTP)    │ 7474 │ 图数据库Web界面         │
│ Neo4j (Bolt)    │ 7687 │ 图数据库连接端口        │
└─────────────────┴──────┴─────────────────────────┘
```

### 服务间通信
```
scheduler (3002)
    ↓ HTTP POST
    ├── ingest-worker (3003) → 新闻获取 → Neo4j
    └── graph-worker (3004)  → 图谱处理 → Neo4j
                ↑
web-app (3000) ──┘ HTTP GET (统计、查询)
```

## 🚀 快速启动指南

### 1. 环境准备
```bash
# 确保安装了必要工具
node --version  # 需要 18+
pnpm --version  # 需要 8+

# 克隆或更新代码
git pull origin feature/s
```

### 2. 安装依赖
```bash
# 安装所有包的依赖
pnpm install

# 验证安装
pnpm list --depth=0
```

### 3. 配置环境变量
```bash
# 复制环境变量模板
cp packages/web-app/.env.example packages/web-app/.env
cp packages/scheduler/.env.example packages/scheduler/.env  
cp packages/ingest-worker/.env.example packages/ingest-worker/.env
cp packages/graph-worker/.env.example packages/graph-worker/.env

# 编辑每个包的 .env 文件，配置：
# - NEO4J_URI, NEO4J_USER, NEO4J_PASSWORD
# - DEEPSEEK_API_KEY, GOOGLE_API_KEY
# - NEWS_API_KEY
# - WEBHOOK_URL
```

### 4. 启动数据库
```bash
# 启动Neo4j (Docker)
docker run -d --name neo4j \
  -p 7474:7474 -p 7687:7687 \
  -e NEO4J_AUTH=neo4j/password \
  neo4j:5.15-community

# 应用数据库schema
pnpm run schema:apply
```

### 5. 启动所有服务
```bash
# 开发模式 - 并行启动所有服务
pnpm run dev

# 或者分别启动
pnpm --filter @drudge/scheduler run dev &
pnpm --filter @drudge/ingest-worker run dev &  
pnpm --filter @drudge/graph-worker run dev &
pnpm --filter @drudge/web-app run dev
```

### 6. 验证启动
```bash
# 检查服务健康状态
curl http://localhost:3002/health  # scheduler
curl http://localhost:3003/health  # ingest-worker  
curl http://localhost:3004/health  # graph-worker

# 访问前端
open http://localhost:3000
```

## 🔧 开发工作流

### 单包开发
```bash
# 只开发特定包
pnpm --filter @drudge/web-app run dev
pnpm --filter @drudge/scheduler run dev

# 构建特定包
pnpm --filter @drudge/ingest-worker run build

# 检查特定包
pnpm --filter @drudge/graph-worker run lint
```

### 多包开发
```bash
# 在所有包中运行命令
pnpm -r run lint       # 检查所有包
pnpm -r run build      # 构建所有包
pnpm -r run test       # 测试所有包

# 并行运行
pnpm --parallel -r run dev  # 并行启动所有包
```

### 依赖管理
```bash
# 添加依赖到特定包
pnpm --filter @drudge/web-app add react-query
pnpm --filter @drudge/scheduler add node-cron

# 添加开发依赖
pnpm --filter @drudge/graph-worker add -D @types/node

# 添加全局依赖
pnpm add -w typescript  # 添加到根目录
```

## 🐳 生产部署

### Docker Compose 部署
```bash
# 构建所有镜像
pnpm run docker:build

# 启动所有服务
pnpm run docker:up

# 查看日志
pnpm run docker:logs

# 停止服务
pnpm run docker:down
```

### 手动部署
```bash
# 构建所有包
pnpm run build

# 启动数据库
docker run -d --name neo4j -p 7474:7474 -p 7687:7687 \
  -e NEO4J_AUTH=neo4j/password neo4j:5.15-community

# 启动服务 (使用PM2)
cd packages/scheduler && npm run pm2:start
cd packages/ingest-worker && npm run pm2:start  
cd packages/graph-worker && npm run pm2:start
cd packages/web-app && npm start
```

## 🔍 故障排除

### 常见问题

1. **pnpm 命令不存在**
   ```bash
   npm install -g pnpm
   ```

2. **端口占用**
   ```bash
   # 检查占用进程
   lsof -i :3000,3002,3003,3004
   # 终止进程
   kill -9 <PID>
   ```

3. **Neo4j连接失败**
   ```bash
   # 检查容器状态
   docker ps | grep neo4j
   # 重启容器
   docker restart neo4j
   ```

4. **环境变量未生效**
   ```bash
   # 检查 .env 文件是否存在
   ls -la packages/*/. env
   # 重启相关服务
   ```

### 调试技巧

1. **查看服务日志**
   ```bash
   # Docker 日志
   docker logs neo4j
   
   # 包日志 (如果使用文件日志)
   tail -f packages/scheduler/logs/scheduler.log
   tail -f packages/ingest-worker/logs/ingest-worker.log
   tail -f packages/graph-worker/logs/graph-worker.log
   ```

2. **健康检查**
   ```bash
   # 脚本检查所有服务
   #!/bin/bash
   services=("3002" "3003" "3004")
   for port in "${services[@]}"; do
     curl -f "http://localhost:$port/health" || echo "Service on port $port is down"
   done
   ```

## 📚 迁移对比

### 迁移前 (单体架构)
```
drudge/
├── src/           # 所有后端代码
├── web/           # 前端代码  
├── package.json   # 单一依赖文件
└── .env           # 单一环境变量
```

### 迁移后 (Monorepo)
```
drudge/
├── packages/
│   ├── web-app/        # 独立前端包
│   ├── scheduler/      # 独立调度包
│   ├── ingest-worker/  # 独立摄取包
│   └── graph-worker/   # 独立图谱包
├── shared/            # 共享资源
├── package.json       # Monorepo管理
└── docker-compose.yml # 服务编排
```

## ✨ 新功能优势

1. **独立部署**: 每个服务可以独立部署和扩展
2. **环境隔离**: 每个包有独立的环境配置
3. **并行开发**: 多个包可以并行开发
4. **容器化**: 每个服务有独立的Docker容器
5. **微服务架构**: 符合现代微服务设计原则

---

🎉 **恭喜！** 你现在拥有了一个现代化的微服务架构新闻知识图谱系统！ 