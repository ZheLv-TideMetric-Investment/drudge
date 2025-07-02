/**
 * 新闻等级检查脚本
 * 专门负责新闻等级分析、Break News识别和高级别新闻处理
 */
declare class NewsLevelChecker {
    constructor();
    /**
     * 初始化服务
     */
    initialize(): Promise<boolean>;
    /**
     * 检查新闻等级
     */
    checkNewsLevels(limit?: number): Promise<{
        success: boolean;
        checked: number;
        high_level?: undefined;
        break_news?: undefined;
        results?: undefined;
        timestamp?: undefined;
        error?: undefined;
    } | {
        success: boolean;
        checked: number;
        high_level: number;
        break_news: number;
        results: any[];
        timestamp: string;
        error?: undefined;
    } | {
        success: boolean;
        error: any;
        checked?: undefined;
        high_level?: undefined;
        break_news?: undefined;
        results?: undefined;
        timestamp?: undefined;
    }>;
    /**
     * 检查最近新闻的等级
     */
    checkRecentNews(hours?: number): Promise<{
        success: boolean;
        checked: number;
        period?: undefined;
        total?: undefined;
        high_level?: undefined;
        break_news?: undefined;
        high_level_news?: undefined;
        timestamp?: undefined;
        error?: undefined;
    } | {
        success: boolean;
        period: string;
        total: any;
        high_level: number;
        break_news: number;
        high_level_news: any[];
        timestamp: string;
        checked?: undefined;
        error?: undefined;
    } | {
        success: boolean;
        error: any;
        checked?: undefined;
        period?: undefined;
        total?: undefined;
        high_level?: undefined;
        break_news?: undefined;
        high_level_news?: undefined;
        timestamp?: undefined;
    }>;
    /**
     * 检查单条新闻的等级
     */
    checkSingleNews(newsId: any): Promise<{
        success: boolean;
        newsId: any;
        title: any;
        level: any;
        isHighLevel: any;
        isBreakNews: any;
        entities: any;
        timestamp: string;
        error?: undefined;
    } | {
        success: boolean;
        error: any;
        newsId?: undefined;
        title?: undefined;
        level?: undefined;
        isHighLevel?: undefined;
        isBreakNews?: undefined;
        entities?: undefined;
        timestamp?: undefined;
    }>;
    /**
     * 查找Break News
     */
    findBreakNews(days?: number): Promise<{
        success: boolean;
        count: number;
        period?: undefined;
        break_news?: undefined;
        timestamp?: undefined;
        error?: undefined;
    } | {
        success: boolean;
        period: string;
        count: any;
        break_news: any;
        timestamp: string;
        error?: undefined;
    } | {
        success: boolean;
        error: any;
        count?: undefined;
        period?: undefined;
        break_news?: undefined;
        timestamp?: undefined;
    }>;
    /**
     * 查找高级别新闻
     */
    findHighLevelNews(days?: number): Promise<{
        success: boolean;
        count: number;
        period?: undefined;
        high_level_news?: undefined;
        grouped?: undefined;
        timestamp?: undefined;
        error?: undefined;
    } | {
        success: boolean;
        period: string;
        count: any;
        high_level_news: any;
        grouped: any;
        timestamp: string;
        error?: undefined;
    } | {
        success: boolean;
        error: any;
        count?: undefined;
        period?: undefined;
        high_level_news?: undefined;
        grouped?: undefined;
        timestamp?: undefined;
    }>;
    /**
     * 重新扫描新闻等级
     */
    rescanNews(limit?: number): Promise<{
        success: boolean;
        rescanned: number;
        updated?: undefined;
        timestamp?: undefined;
        error?: undefined;
    } | {
        success: boolean;
        rescanned: number;
        updated: number;
        timestamp: string;
        error?: undefined;
    } | {
        success: boolean;
        error: any;
        rescanned?: undefined;
        updated?: undefined;
        timestamp?: undefined;
    }>;
    /**
     * 获取等级统计信息
     */
    getLevelStats(days?: number): Promise<{
        success: boolean;
        period: string;
        stats: any;
        timestamp: string;
        error?: undefined;
    } | {
        success: boolean;
        error: any;
        period?: undefined;
        stats?: undefined;
        timestamp?: undefined;
    }>;
    /**
     * 获取Break News历史
     */
    getBreakNewsHistory(days?: number): Promise<{
        success: boolean;
        count: number;
        period?: undefined;
        history?: undefined;
        timestamp?: undefined;
        error?: undefined;
    } | {
        success: boolean;
        period: string;
        count: any;
        history: any;
        timestamp: string;
        error?: undefined;
    } | {
        success: boolean;
        error: any;
        count?: undefined;
        period?: undefined;
        history?: undefined;
        timestamp?: undefined;
    }>;
    /**
     * 发送Break News通知
     */
    sendBreakNewsNotification(hours?: number): Promise<{
        success: boolean;
        sent: number;
        notification?: undefined;
        timestamp?: undefined;
        error?: undefined;
    } | {
        success: any;
        sent: any;
        notification: {
            type: string;
            period: string;
            count: any;
            news: any;
            timestamp: string;
        };
        timestamp: string;
        error?: undefined;
    } | {
        success: boolean;
        error: any;
        sent?: undefined;
        notification?: undefined;
        timestamp?: undefined;
    }>;
    /**
     * 获取服务状态
     */
    getStatus(): Promise<{
        service: string;
        status: string;
        timestamp: string;
        services: {
            newsLevelService: string;
            knowledgeGraph: string;
            storage: string;
            webhook: string;
        };
    } | {
        service: string;
        status: string;
        error: any;
        timestamp: string;
    }>;
    /**
     * 显示帮助信息
     */
    showHelp(): void;
    /**
     * 获取等级图标
     */
    getLevelIcon(level: any): any;
    /**
     * 运行命令
     */
    runCommand(command: any, ...args: any[]): Promise<any>;
}
export default NewsLevelChecker;
