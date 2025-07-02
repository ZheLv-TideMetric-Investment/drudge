import { HourlySummary } from '../../domain/entities/index';
/**
 * 新闻处理与图数据库存储系统 - 知识图谱服务
 * 基于新闻六要素（5W1H）构建和查询知识图谱
 */
declare class KnowledgeGraphService {
    constructor();
    /**
     * 初始化服务
     */
    initialize(): Promise<void>;
    /**
     * 检查新闻是否已经处理过
     * @param {string} newsId - 新闻ID
     * @returns {boolean} - 是否已处理
     */
    isNewsProcessed(newsId: any): Promise<boolean>;
    /**
     * 批量检查新闻是否已处理过
     * @param {Array} newsIds - 新闻ID列表
     * @returns {Array} - 未处理的新闻ID列表
     */
    getUnprocessedNewsIds(newsIds: any): Promise<any[]>;
    /**
     * 处理新闻并构建知识图谱（幂等性保证）
     * @param {Object} newsItem - 新闻对象
     * @returns {Object} - 处理结果
     */
    processNews(newsItem: any): Promise<{
        success: boolean;
        skipped: boolean;
        reason: string;
        stats: {
            events: number;
            companies: number;
            persons: number;
        };
        extractionResult?: undefined;
        error?: undefined;
    } | {
        success: boolean;
        stats: any;
        extractionResult: import("../../domain/entities/NewsExtractionResult").NewsExtractionResult;
        skipped?: undefined;
        reason?: undefined;
        error?: undefined;
    } | {
        success: boolean;
        error: any;
        skipped?: undefined;
        reason?: undefined;
        stats?: undefined;
        extractionResult?: undefined;
    }>;
    /**
     * 创建新闻节点
     */
    createNewsNode(newsItem: any, newsLevel?: string): Promise<void>;
    /**
     * 处理所有节点创建
     */
    processAllNodes(extractionResult: any, newsId: any): Promise<{
        events: number;
        companies: number;
        persons: number;
        organizations: number;
        locations: number;
        times: number;
    }>;
    /**
     * 创建事件节点
     */
    createEventNode(event: any): Promise<void>;
    /**
     * 创建公司节点
     */
    createCompanyNode(company: any): Promise<void>;
    /**
     * 创建人物节点
     */
    createPersonNode(person: any): Promise<void>;
    /**
     * 创建机构节点
     */
    createOrganizationNode(organization: any): Promise<void>;
    /**
     * 创建地点节点
     */
    createLocationNode(location: any): Promise<void>;
    /**
     * 创建时间节点
     */
    createTimeNode(time: any): Promise<void>;
    /**
     * 创建关系
     */
    createRelationships(extractionResult: any, newsId: any): Promise<void>;
    /**
     * 创建事件与新闻的关系
     */
    createEventNewsRelation(eventId: any, newsId: any): Promise<void>;
    /**
     * 创建自定义关系
     */
    createCustomRelationship(relationship: any): Promise<void>;
    /**
     * 创建推断的自然关系
     */
    createInferredRelationships(extractionResult: any): Promise<void>;
    /**
     * 创建事件与公司的关系
     */
    createEventCompanyRelation(eventId: any, companyName: any): Promise<void>;
    /**
     * 创建事件与人物的关系
     */
    createEventPersonRelation(eventId: any, personName: any, role: any): Promise<void>;
    /**
     * 创建事件与地点的关系
     */
    createEventLocationRelation(eventId: any, locationName: any): Promise<void>;
    /**
     * 创建事件与时间的关系
     */
    createEventTimeRelation(eventId: any, timestamp: any): Promise<void>;
    /**
     * 获取特定级别的新闻事件
     * @param {string} newsLevel - 新闻级别 (Level 1/Level 2/Level 3/Level 4)
     * @param {number} limit - 限制数量
     * @returns {Array} - 指定级别的事件列表
     */
    getNewsByLevel(newsLevel?: string, limit?: number): Promise<{
        event: any;
        news: any;
    }[]>;
    /**
     * 查询公司相关事件
     * @param {string} companyName - 公司名称
     * @param {number} limit - 限制数量
     * @returns {Array} - 相关事件列表
     */
    getCompanyEvents(companyName: any, limit?: number): Promise<any[]>;
    /**
     * 查询多公司关联事件
     * @param {Array} companyNames - 公司名称列表
     * @param {number} limit - 限制数量
     * @returns {Array} - 关联事件列表
     */
    getMultiCompanyEvents(companyNames: any, limit?: number): Promise<{
        event: any;
        companies: any;
    }[]>;
    /**
     * 查询某日所有事件
     * @param {string} date - 日期 (YYYY-MM-DD)
     * @returns {Array} - 当日事件列表
     */
    getDayEvents(date: any): Promise<{
        event: any;
        companies: any;
        persons: any;
        locations: any;
    }[]>;
    /**
     * 按小时总结功能 - 获取某小时的新闻统计
     * @param {string} hourStart - 开始时间
     * @param {string} hourEnd - 结束时间
     * @returns {HourlySummary} - 小时总结
     */
    getHourlySummary(hourStart: any, hourEnd: any): Promise<HourlySummary>;
    /**
     * 搜索实体
     * @param {string} searchTerm - 搜索词
     * @param {string} nodeType - 节点类型
     * @param {number} limit - 限制数量
     * @returns {Array} - 搜索结果
     */
    searchEntities(searchTerm: any, nodeType?: any, limit?: number): Promise<{
        node: any;
        nodeType: any;
    }[]>;
    /**
     * 获取节点的主要属性名
     */
    getMainProperty(nodeType: any): any;
    /**
     * 获取图谱统计信息
     */
    getGraphStats(): Promise<{
        nodeType: any;
        count: any;
    }[]>;
    /**
     * 获取新闻的提取结果（用于等级检查等）
     * @param {string} newsId - 新闻ID
     * @returns {Object|null} - 新闻提取结果
     */
    getNewsExtractionResult(newsId: any): Promise<{
        news_id: any;
        news_level: any;
        confidence: any;
        entities: any[];
        events: any;
        companies: any;
        persons: any;
        organizations: any;
        locations: any;
        times: any;
        processed_at: any;
    }>;
    /**
     * 获取统计信息（用于脚本调用）
     * @returns {Object} - 图谱统计信息
     */
    getStats(): Promise<{
        nodes: any;
        relationships: any;
        news: any;
        entities: unknown;
        entity_types: {};
        node_distribution: {};
        timestamp: string;
        error?: undefined;
    } | {
        nodes: number;
        relationships: number;
        news: number;
        entities: number;
        entity_types: {};
        error: any;
        timestamp: string;
        node_distribution?: undefined;
    }>;
    /**
     * 导出图谱数据
     * @param {string} format - 导出格式 ('json', 'cypher', 'csv')
     * @returns {string|Object} - 导出的数据
     */
    exportGraph(format?: string): Promise<string | {
        metadata: {
            exportTime: string;
            nodeCount: number;
            relationshipCount: number;
            version: string;
        };
        nodes: {
            type: any;
            properties: any;
            id: any;
        }[];
        relationships: {
            source: {
                type: any;
                properties: any;
            };
            relationship: {
                type: any;
                properties: any;
            };
            target: {
                type: any;
                properties: any;
            };
        }[];
    }>;
    /**
     * 导出为JSON格式
     * @returns {Object} - JSON格式的图谱数据
     */
    exportAsJson(): Promise<{
        metadata: {
            exportTime: string;
            nodeCount: number;
            relationshipCount: number;
            version: string;
        };
        nodes: {
            type: any;
            properties: any;
            id: any;
        }[];
        relationships: {
            source: {
                type: any;
                properties: any;
            };
            relationship: {
                type: any;
                properties: any;
            };
            target: {
                type: any;
                properties: any;
            };
        }[];
    }>;
    /**
     * 导出为Cypher语句格式
     * @returns {string} - Cypher语句
     */
    exportAsCypher(): Promise<string>;
    /**
     * 导出为CSV格式
     * @returns {string} - CSV格式数据
     */
    exportAsCsv(): Promise<string>;
    /**
     * 健康检查
     */
    healthCheck(): Promise<{
        status: string;
        totalNodes: any;
        nodeTypes: {
            nodeType: any;
            count: any;
        }[];
        timestamp: string;
        error?: undefined;
    } | {
        status: string;
        error: any;
        timestamp: string;
        totalNodes?: undefined;
        nodeTypes?: undefined;
    }>;
    /**
     * 批量创建知识图谱（供NewsProcessingService调用）
     * @param {Array} extractionResults - 实体提取结果数组
     * @returns {Array} - 处理结果数组
     */
    batchCreateGraphData(extractionResults: any): Promise<any>;
    /**
     * 从提取结果批量创建新闻节点
     * @param {Array} extractionResults - 提取结果数组
     */
    batchCreateNewsNodesFromExtractions(extractionResults: any): Promise<void>;
    /**
     * 批量创建实体节点和关系
     * @param {Array} extractionResults - 提取结果数组
     */
    batchCreateEntitiesAndRelationships(extractionResults: any): Promise<void>;
    /**
     * 收集实体创建查询
     * @param {NewsExtractionResult} extractionResult - 提取结果
     * @returns {Array} - 查询数组
     */
    collectEntityQueries(extractionResult: any): Promise<any[]>;
    /**
     * 收集关系创建查询
     * @param {NewsExtractionResult} extractionResult - 提取结果
     * @returns {Array} - 查询数组
     */
    collectRelationshipQueries(extractionResult: any): Promise<any[]>;
    /**
     * 批量执行查询
     * @param {Array} queries - 查询数组
     * @param {string} queryType - 查询类型（用于日志）
     */
    executeBatchQueries(queries: any, queryType: any): Promise<void>;
}
declare const _default: KnowledgeGraphService;
export default _default;
