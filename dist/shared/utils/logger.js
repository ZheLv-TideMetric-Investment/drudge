// @ts-nocheck
import winston from 'winston';
import config from '../config/config.js';
// 创建 Winston 日志记录器
const logger = winston.createLogger({
    level: config.logging.level,
    format: winston.format.combine(winston.format.timestamp({
        format: 'YYYY-MM-DD HH:mm:ss'
    }), winston.format.errors({ stack: true }), winston.format.printf(({ timestamp, level, message, stack }) => {
        return `${timestamp} [${level.toUpperCase()}]: ${stack || message}`;
    })),
    transports: [
        // 控制台输出
        new winston.transports.Console({
            format: winston.format.combine(winston.format.colorize(), winston.format.printf(({ timestamp, level, message, stack }) => {
                return `${timestamp} [${level}]: ${stack || message}`;
            }))
        }),
        // 文件输出
        new winston.transports.File({
            filename: config.logging.file,
            maxsize: 5242880, // 5MB
            maxFiles: 5,
        })
    ]
});
export default logger;
