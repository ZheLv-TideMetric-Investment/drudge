# 新闻聚合和AI总结服务

这是一个自动化的新闻聚合和AI总结服务，它会定期获取新闻，并使用AI进行总结。

## 功能特点

- 每分钟自动获取最新新闻
- 每小时自动总结过去一小时的新闻
- 支持将总结结果发送到指定的webhook
- 完整的日志记录
- 错误处理和自动恢复

## 安装

1. 克隆仓库
```bash
git clone [repository-url]
cd drudge
```

2. 安装依赖
```bash
npm install
```

3. 配置环境变量
```bash
cp .env.example .env
# 编辑.env文件，填入必要的配置信息：
# - WEBHOOK_URL: 消息推送的webhook地址
# - AI_API_KEY: DeepSeek API密钥
# - 其他配置项可以根据需要调整
```

## 开发

### 代码格式化

项目使用 Prettier 和 ESLint 进行代码格式化：

```bash
# 格式化代码
npm run format

# 检查代码格式
npm run format:check

# 运行 ESLint
npm run lint

# 自动修复 ESLint 问题
npm run lint:fix
```

### 运行

开发环境：
```bash
npm run dev
```

生产环境：
```bash
npm start
```

## 使用PM2部署（推荐）

1. 安装PM2
```bash
npm install -g pm2
```

2. 启动服务
```bash
pm2 start src/index.js --name drudge
```

3. 其他PM2命令
```bash
pm2 status          # 查看状态
pm2 logs drudge     # 查看日志
pm2 restart drudge  # 重启服务
```

## 项目结构

```
src/
  ├── config/       # 配置文件
  ├── services/     # 业务服务
  ├── utils/        # 工具函数
  └── index.js      # 入口文件
```

## 环境变量说明

- `WEBHOOK_URL`: 消息推送的webhook地址
- `STORAGE_PATH`: 数据存储路径
- `LOG_LEVEL`: 日志级别
- `LOG_FILE`: 日志文件路径
- `AI_BASE_URL`: AI服务的基础URL
- `AI_API_KEY`: DeepSeek API密钥
- `AI_MODEL`: 使用的AI模型
- `NEWS_API_PAGE_SIZE`: 新闻API每页数量
- `NEWS_API_INTERVAL`: 新闻获取间隔（毫秒）
- `NEWS_API_REQUEST_INTERVAL`: 新闻API请求间隔（毫秒）

## 注意事项

1. 确保服务器已安装Node.js环境
2. 配置正确的webhook URL和AI API密钥
3. 确保存储目录有写入权限
4. 建议使用PM2进行进程管理
5. 提交代码前请运行 `npm run format` 和 `npm run lint` 确保代码格式正确
6. 不要提交 `.env` 文件到版本控制系统