/**
 * 新闻处理工作线程管理器
 * 管理专门负责新闻处理的工作线程，支持文件监听和消息驱动
 */
declare class WorkerManager {
    constructor();
    /**
     * 初始化新闻处理工作线程
     */
    initialize(): Promise<void>;
    /**
     * 创建新闻处理工作线程
     */
    createNewsProcessor(): Promise<unknown>;
    /**
     * 处理工作线程消息
     */
    handleWorkerMessage(message: any): void;
    /**
     * 处理任务结果
     */
    handleTaskResult(taskId: any, result: any): void;
    /**
     * 处理任务错误
     */
    handleTaskError(taskId: any, error: any): void;
    /**
     * 处理新闻处理完成事件
     */
    handleNewsProcessed(data: any): void;
    /**
     * 处理新闻处理错误事件
     */
    handleProcessingError(data: any): void;
    /**
     * 处理工作线程错误
     */
    handleWorkerError(error: any): void;
    /**
     * 处理工作线程退出
     */
    handleWorkerExit(): void;
    /**
     * 重启新闻处理工作线程
     */
    restartNewsProcessor(): Promise<void>;
    /**
     * 初始化新闻处理器
     */
    initializeNewsProcessor(): Promise<unknown>;
    /**
     * 启动新闻处理服务
     */
    startNewsProcessing(options?: {}): Promise<unknown>;
    /**
     * 停止新闻处理服务
     */
    stopNewsProcessing(): Promise<unknown>;
    /**
     * 触发立即处理
     */
    triggerProcessing(): Promise<unknown>;
    /**
     * 执行任务
     */
    executeTask(type: any, data?: any): Promise<unknown>;
    /**
     * 获取新闻处理器状态
     */
    getProcessorStatus(): Promise<unknown>;
    /**
     * 获取工作线程管理器状态
     */
    getStatus(): {
        initialized: any;
        hasNewsProcessor: boolean;
        pendingTasks: any;
        stats: any;
        processorLastActivity: any;
    };
    /**
     * 健康检查
     */
    healthCheck(): Promise<{
        healthy: boolean;
        error: string;
        responseTime?: undefined;
        initialized?: undefined;
        stats?: undefined;
    } | {
        healthy: boolean;
        responseTime: unknown;
        initialized: any;
        stats: any;
        error?: undefined;
    } | {
        healthy: boolean;
        error: any;
        initialized: any;
        responseTime?: undefined;
        stats?: undefined;
    }>;
    /**
     * 关闭新闻处理工作线程管理器
     */
    shutdown(): Promise<void>;
}
declare const _default: WorkerManager;
export default _default;
