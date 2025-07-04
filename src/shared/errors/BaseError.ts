// @ts-nocheck

/**
 * 基础错误类
 * 提供统一的错误处理结构
 */
export class BaseError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly context?: any;
  public readonly timestamp: Date;

  constructor(
    message: string,
    code: string = 'UNKNOWN_ERROR',
    statusCode: number = 500,
    context?: any
  ) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.statusCode = statusCode;
    this.context = context;
    this.timestamp = new Date();

    // 确保堆栈跟踪正确
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  /**
   * 转换为JSON格式
   */
  toJSON(): any {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      statusCode: this.statusCode,
      context: this.context,
      timestamp: this.timestamp.toISOString(),
      stack: this.stack
    };
  }

  /**
   * 获取用户友好的错误信息
   */
  getUserMessage(): string {
    return this.message;
  }

  /**
   * 是否为客户端错误（4xx）
   */
  isClientError(): boolean {
    return this.statusCode >= 400 && this.statusCode < 500;
  }

  /**
   * 是否为服务器错误（5xx）
   */
  isServerError(): boolean {
    return this.statusCode >= 500;
  }
} 