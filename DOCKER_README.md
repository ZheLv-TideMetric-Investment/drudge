# Docker 部署指南

本文档介绍如何使用 Docker 部署 Drudge 项目的 Graph Worker 和 Ingest Worker 服务。

## 📋 服务架构

- **Ingest Worker** (端口 39110) - 新闻数据获取服务
- **Graph Worker** (端口 39111) - 知识图谱处理服务  
- **Neo4j** (端口 7474/7687) - 图数据库

## 🚀 快速开始

### 1. 环境变量配置

创建 `.env` 文件并设置必要的环境变量：

```bash
# AI 服务配置
DEEPSEEK_API_KEY=your-deepseek-api-key-here
GOOGLE_API_KEY=your-google-api-key-here

# 钉钉通知配置
WEBHOOK_URL=https://oapi.dingtalk.com/robot/send?access_token=your-dingtalk-token-here
```

### 2. 构建和启动服务

```bash
# 构建并启动所有服务
docker-compose -f docker-compose.workers.yml up -d

# 查看服务状态
docker-compose -f docker-compose.workers.yml ps

# 查看日志
docker-compose -f docker-compose.workers.yml logs -f
```

### 3. 服务访问

- **Ingest Worker**: http://localhost:39110
- **Graph Worker**: http://localhost:39111  
- **Neo4j Browser**: http://localhost:7474

## 🔧 详细配置

### 服务启动顺序

1. **Neo4j** - 首先启动图数据库
2. **Ingest Worker** - 启动新闻获取服务
3. **Graph Worker** - 最后启动图谱处理服务

### 健康检查

所有服务都配置了健康检查：
- **Neo4j**: Cypher 查询测试
- **Ingest Worker**: HTTP /health 端点
- **Graph Worker**: HTTP /health 端点

### 数据持久化

使用 Docker Volumes 持久化数据：
- `drudge_neo4j_data` - Neo4j 数据
- `drudge_ingest_data` - 新闻数据文件
- `drudge_graph_data` - 图谱处理数据
- `drudge_*_logs` - 各服务日志

## 📊 监控和管理

### 查看服务状态

```bash
# 查看所有容器状态
docker-compose -f docker-compose.workers.yml ps

# 查看特定服务日志
docker-compose -f docker-compose.workers.yml logs ingest-worker
docker-compose -f docker-compose.workers.yml logs graph-worker
docker-compose -f docker-compose.workers.yml logs neo4j
```

### 服务管理命令

```bash
# 停止所有服务
docker-compose -f docker-compose.workers.yml down

# 重启特定服务
docker-compose -f docker-compose.workers.yml restart graph-worker

# 重新构建并启动
docker-compose -f docker-compose.workers.yml up -d --build
```

### Neo4j 管理

```bash
# 进入 Neo4j 容器
docker exec -it drudge-neo4j bash

# 使用 Cypher Shell
docker exec -it drudge-neo4j cypher-shell -u neo4j -p niuniuniu
```

## 🔍 故障排除

### 常见问题

1. **服务启动失败**
   ```bash
   # 检查日志
   docker-compose -f docker-compose.workers.yml logs [service-name]
   
   # 检查环境变量
   docker-compose -f docker-compose.workers.yml config
   ```

2. **Neo4j 连接失败**
   ```bash
   # 确认 Neo4j 已启动
   docker-compose -f docker-compose.workers.yml ps neo4j
   
   # 测试连接
   docker exec drudge-neo4j cypher-shell -u neo4j -p niuniuniu "RETURN 1"
   ```

3. **API 密钥配置**
   ```bash
   # 检查环境变量是否正确设置
   docker-compose -f docker-compose.workers.yml exec graph-worker env | grep API_KEY
   ```

### 重置和清理

```bash
# 完全清理（会删除所有数据）
docker-compose -f docker-compose.workers.yml down -v
docker system prune -f

# 仅清理应用数据（保留 Neo4j 数据）
docker volume rm drudge_ingest_data drudge_graph_data
```

## 🏭 生产环境配置

### 资源限制

在生产环境中建议添加资源限制：

```yaml
services:
  graph-worker:
    deploy:
      resources:
        limits:
          memory: 2G
          cpus: '1.0'
        reservations:
          memory: 1G
          cpus: '0.5'
```

### 安全配置

1. **更改默认密码**
   ```bash
   NEO4J_AUTH=neo4j/your-strong-password
   ```

2. **网络隔离**
   ```yaml
   networks:
     internal:
       driver: bridge
       internal: true
   ```

3. **只暴露必要端口**
   ```yaml
   # 生产环境中可能不需要暴露 Neo4j 的 7474 端口
   ports:
     - "7687:7687"  # 仅保留 Bolt 协议端口
   ```

## 📈 性能调优

### Neo4j 优化

```yaml
environment:
  - NEO4J_dbms_memory_heap_initial__size=1G
  - NEO4J_dbms_memory_heap_max__size=2G
  - NEO4J_dbms_memory_pagecache_size=1G
```

### Worker 优化

```yaml
environment:
  - BATCH_SIZE=20           # 增加批处理大小
  - RETRY_ATTEMPTS=5        # 增加重试次数
  - NEWS_API_REQUEST_INTERVAL=500  # 减少请求间隔
```

## 🔄 更新和维护

### 服务更新

```bash
# 更新代码后重新构建
git pull
docker-compose -f docker-compose.workers.yml build --no-cache
docker-compose -f docker-compose.workers.yml up -d

# 滚动更新（零停机）
docker-compose -f docker-compose.workers.yml up -d --no-deps graph-worker
```

### 备份策略

```bash
# 备份 Neo4j 数据
docker exec drudge-neo4j neo4j-admin database dump neo4j

# 备份应用数据
docker run --rm -v drudge_ingest_data:/data -v $(pwd):/backup alpine tar czf /backup/ingest-data-backup.tar.gz /data
```

---

## 🆘 支持

如果遇到问题，请检查：
1. Docker 和 Docker Compose 版本
2. 环境变量配置
3. 服务日志输出
4. 网络连接状态

更多详情请参考各个服务的 README 文档。 