/**
 * 图数据库基础仓储
 * 提供基础的Neo4j操作
 */
declare class GraphRepository {
    constructor(neo4jService: any);
    /**
     * 执行Cypher查询
     */
    executeQuery(cypher: any, parameters?: {}): Promise<any>;
    /**
     * 批量执行查询
     */
    executeBatchQueries(queries: any, queryType?: string): Promise<any[]>;
    /**
     * 获取图统计信息
     */
    getGraphStats(): Promise<{
        labels: any;
        relationships: any;
        nodes: any;
        relations: any;
    }>;
    /**
     * 获取基础统计信息（不依赖APOC）
     */
    getBasicStats(): Promise<{
        nodes: any;
        relations: any;
        labels: number;
        relationships: number;
    }>;
    /**
     * 健康检查
     */
    healthCheck(): Promise<{
        healthy: boolean;
        error?: undefined;
    } | {
        healthy: boolean;
        error: any;
    }>;
}
export default GraphRepository;
