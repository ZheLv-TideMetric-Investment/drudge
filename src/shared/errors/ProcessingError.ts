// @ts-nocheck
import { BaseError } from './BaseError';

/**
 * 处理错误类
 * 用于新闻处理过程中的错误
 */
export class ProcessingError extends BaseError {
  constructor(
    message: string,
    context?: any,
    code: string = 'PROCESSING_ERROR'
  ) {
    super(message, code, 500, context);
  }
}

/**
 * 实体提取错误
 */
export class EntityExtractionError extends ProcessingError {
  constructor(message: string, newsId?: string, context?: any) {
    super(message, { newsId, ...context }, 'ENTITY_EXTRACTION_ERROR');
  }
}

/**
 * 知识图谱构建错误
 */
export class KnowledgeGraphError extends ProcessingError {
  constructor(message: string, context?: any) {
    super(message, context, 'KNOWLEDGE_GRAPH_ERROR');
  }
}

/**
 * AI调用错误
 */
export class AIServiceError extends ProcessingError {
  constructor(message: string, context?: any) {
    super(message, context, 'AI_SERVICE_ERROR');
  }
}

/**
 * 数据库操作错误
 */
export class DatabaseError extends ProcessingError {
  constructor(message: string, operation?: string, context?: any) {
    super(message, { operation, ...context }, 'DATABASE_ERROR');
  }
} 