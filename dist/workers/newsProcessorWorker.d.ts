/**
 * 新闻处理工作线程
 * 专门负责持续处理本地存储的未处理新闻，支持文件监听和消息驱动
 */
declare class NewsProcessorWorker {
    constructor();
    initialize(): Promise<void>;
    /**
     * 启动新闻处理
     * 可以通过文件监听或定时检查的方式
     */
    startProcessing(options?: {}): Promise<void>;
    /**
     * 启动文件监听
     */
    startFileWatcher(): void;
    /**
     * 启动定时检查
     */
    startIntervalCheck(interval: any): void;
    /**
     * 处理未处理的新闻
     */
    processUnhandledNews(): Promise<void>;
    /**
     * 批量处理新闻（增强版：支持流式处理）
     */
    batchProcessNews(newsItems: any): Promise<any[]>;
    /**
     * 处理单条新闻
     */
    processSingleNews(newsItem: any): Promise<{
        success: boolean;
        newsId: any;
        skipped: boolean;
        stats: {
            events: number;
            companies: number;
            persons: number;
            organizations?: number;
            locations?: number;
            times?: number;
        };
        newsLevel: any;
        shouldPush: any;
        error?: undefined;
    } | {
        success: boolean;
        newsId: any;
        error: any;
        skipped?: undefined;
        stats?: undefined;
        newsLevel?: undefined;
        shouldPush?: undefined;
    }>;
    /**
     * 停止新闻处理
     */
    stopProcessing(): void;
    /**
     * 触发立即处理（响应外部消息）
     */
    triggerProcessing(): Promise<void>;
    /**
     * 通知主线程
     */
    notifyMainThread(type: any, data: any): void;
    /**
     * 获取当前状态
     */
    getStatus(): {
        initialized: any;
        isProcessing: any;
        hasFileWatcher: boolean;
        hasIntervalCheck: boolean;
        stats: any;
        timestamp: number;
    };
}
export default NewsProcessorWorker;
