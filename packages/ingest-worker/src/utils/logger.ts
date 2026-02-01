import winston from 'winston';
import config from '../config/config';

// 创建日志格式
const logFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.printf(({ level, message, timestamp: _timestamp, ...meta }) => {
    // 安全地序列化meta，避免循环引用
    const metaStr = Object.keys(meta).length
      ? JSON.stringify(meta, (key, value) => {
          if (value instanceof Error) {
            return value.message;
          }
          // 过滤掉可能的循环引用对象
          if (typeof value === 'object' && value !== null) {
            if (
              value.constructor &&
              (value.constructor.name === 'ClientRequest' ||
                value.constructor.name === 'IncomingMessage')
            ) {
              return '[CircularReference]';
            }
          }
          return value;
        })
      : '';

    return `${level}: ${message} ${metaStr}`;
  })
);

// 创建 winston logger 实例
const logger = winston.createLogger({
  level: config.log.level,
  format: logFormat,
  defaultMeta: { service: 'ingest-worker' },
  transports: [
    // 控制台输出
    new winston.transports.Console({
      format: winston.format.combine(winston.format.colorize(), winston.format.simple()),
    }),
  ],
});

// 如果不是生产环境，添加文件输出
if (process.env.NODE_ENV !== 'production') {
  // 确保有日志目录
  const fs = require('fs');
  const path = require('path');
  const logDir = path.dirname(config.log.file);
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }
}

// 添加文件传输
if (config.log.file) {
  logger.add(new winston.transports.File({ filename: config.log.file }));
}

export { logger };
