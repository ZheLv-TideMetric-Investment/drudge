declare class NewsService {
    constructor();
    getLastNewsId(): Promise<any>;
    fetchNews(): Promise<any>;
    makeRequest(seqMark: any): Promise<import("axios").AxiosResponse<any, any>>;
    filterNewNews(news: any): Promise<any>;
    getLastHourNews(): Promise<any[]>;
    getNewsByTimeRange(startTime: any, endTime: any): Promise<any[]>;
    /**
     * 获取最新新闻（为兼容 newsAcquisition.js）
     * @returns {Array} - 新闻列表
     */
    fetchLatestNews(): Promise<any>;
    /**
     * 按时间范围获取新闻（为兼容 newsAcquisition.js）
     * @param {moment} startTime - 开始时间
     * @param {moment} endTime - 结束时间
     * @returns {Array} - 新闻列表
     */
    fetchNewsByTimeRange(startTime: any, endTime: any): Promise<any[]>;
    /**
     * 健康检查
     * @returns {Object} - 健康状态
     */
    healthCheck(): Promise<{
        status: string;
        message: string;
        timestamp: string;
        lastRequestTime: string;
        error?: undefined;
    } | {
        status: string;
        message: string;
        timestamp: string;
        error: any;
        lastRequestTime?: undefined;
    }>;
    /**
     * 获取服务统计信息
     * @returns {Object} - 统计信息
     */
    getStats(): Promise<{
        totalNews: number;
        isFirstRun: any;
        lastRequestTime: string;
        minRequestInterval: any;
        latestNews: {
            id: any;
            title: any;
            time: string;
        };
        error?: undefined;
    } | {
        totalNews: number;
        error: any;
        isFirstRun?: undefined;
        lastRequestTime?: undefined;
        minRequestInterval?: undefined;
        latestNews?: undefined;
    }>;
}
declare const _default: NewsService;
export default _default;
