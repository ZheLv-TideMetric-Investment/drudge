import winston from 'winston';
import { existsSync, mkdirSync } from 'fs';

// 确保日志目录存在
if (!existsSync('logs')) {
  mkdirSync('logs', { recursive: true });
}

// 日志格式
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

// 创建logger实例
export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: logFormat,
  transports: [
    // 控制台输出
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    }),
    // 文件输出
    new winston.transports.File({ 
      filename: 'logs/graph-worker-error.log', 
      level: 'error' 
    }),
    new winston.transports.File({ 
      filename: 'logs/graph-worker.log' 
    })
  ]
}); 