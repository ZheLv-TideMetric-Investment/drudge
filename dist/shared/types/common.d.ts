/**
 * 通用类型定义
 */
/**
 * 基础实体接口
 */
export interface BaseEntity {
    created_at: string;
    updated_at?: string;
}
/**
 * 新闻接口
 */
export interface NewsItem {
    id: string;
    title: string;
    content: string;
    timestamp: string;
    source?: string;
    url?: string;
    level?: number;
    processed?: boolean;
    fingerprint?: string;
}
/**
 * 批处理结果接口
 */
export interface BatchResult {
    success: boolean;
    newsId: string;
    error?: string;
    stats?: {
        events: number;
        companies: number;
        persons: number;
        organizations?: number;
        locations?: number;
        times?: number;
    };
    extractionResult?: any;
    processed_at: string;
    skipped?: boolean;
    reason?: string;
}
/**
 * 批处理汇总接口
 */
export interface BatchSummary {
    total: number;
    success: number;
    failed: number;
    success_rate?: number;
    processed_batches?: number;
    total_batches?: number;
    start_time?: string;
    end_time?: string;
    duration_ms?: number;
    message?: string;
}
/**
 * 批处理回调数据接口
 */
export interface BatchCallbackData {
    batchNumber: number;
    totalBatches: number;
    batchResults: BatchResult[];
    batchSummary: BatchSummary;
    error?: string;
    overallProgress: {
        processed: number;
        total: number;
        percentage: number;
    };
}
/**
 * 系统状态接口
 */
export interface SystemStatus {
    initialized: boolean;
    started: boolean;
    scheduler: any;
    workers: {
        enabled: boolean;
        status: any;
    };
    uptime: number;
    timestamp: string;
}
/**
 * 健康检查结果接口
 */
export interface HealthCheckResult {
    status: 'healthy' | 'unhealthy';
    timestamp: string;
    database?: string;
    error?: string;
}
/**
 * 数据库统计信息接口
 */
export interface DatabaseStats {
    nodeCount: number;
    relationshipCount: number;
    labelCount?: number;
    relationshipTypeCount?: number;
    propertyKeyCount?: number;
    timestamp: string;
    error?: string;
}
/**
 * 配置接口
 */
export interface Config {
    newsApi: {
        url: string;
        pageSize: number;
        interval: number;
        requestInterval: number;
    };
    summary: {
        interval: number;
    };
    webhook: {
        url: string;
    };
    storage: {
        path: string;
    };
    logging: {
        level: string;
        file: string;
    };
    ai: {
        baseURL: string;
        apiKey: string;
        model: string;
    };
    neo4j: {
        uri: string;
        username: string;
        password: string;
        database: string;
    };
    batch: {
        enabled: boolean;
        minBatchSize: number;
        maxBatchSize: number;
        aiRetryAttempts: number;
        dbBatchSize: number;
        delayBetweenBatches: number;
    };
    workers: {
        enabled: boolean;
        maxWorkers: number;
        timeout: number;
        healthCheckInterval: number;
    };
}
/**
 * Neo4j查询参数接口
 */
export interface Neo4jQueryParams {
    [key: string]: any;
}
/**
 * Neo4j查询结果接口
 */
export interface Neo4jQuery {
    cypher: string;
    parameters?: Neo4jQueryParams;
}
/**
 * 实体提取结果接口
 */
export interface EntityExtractionResult {
    events?: any[];
    companies?: any[];
    persons?: any[];
    organizations?: any[];
    locations?: any[];
    times?: any[];
    relationships?: any[];
}
