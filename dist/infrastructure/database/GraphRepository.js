// @ts-nocheck
import logger from '../../shared/utils/logger.js';
/**
 * 图数据库基础仓储
 * 提供基础的Neo4j操作
 */
class GraphRepository {
    constructor(neo4jService) {
        this.neo4j = neo4jService;
    }
    /**
     * 执行Cypher查询
     */
    async executeQuery(cypher, parameters = {}) {
        return await this.neo4j.executeQuery(cypher, parameters);
    }
    /**
     * 批量执行查询
     */
    async executeBatchQueries(queries, queryType = 'batch') {
        if (queries.length === 0) {
            return [];
        }
        logger.debug(`执行批量${queryType}查询，共${queries.length}条`);
        const results = [];
        const batchSize = 50; // 每批处理50条
        for (let i = 0; i < queries.length; i += batchSize) {
            const batch = queries.slice(i, i + batchSize);
            const batchResults = await Promise.all(batch.map(query => this.executeQuery(query.cypher, query.parameters)));
            results.push(...batchResults);
        }
        return results;
    }
    /**
     * 获取图统计信息
     */
    async getGraphStats() {
        const cypher = `
      CALL apoc.meta.stats() YIELD labelCount, relTypeCount, nodeCount, relCount
      RETURN labelCount, relTypeCount, nodeCount, relCount
    `;
        try {
            const result = await this.executeQuery(cypher);
            if (result.records.length > 0) {
                const record = result.records[0];
                return {
                    labels: record.get('labelCount'),
                    relationships: record.get('relTypeCount'),
                    nodes: record.get('nodeCount'),
                    relations: record.get('relCount'),
                };
            }
        }
        catch (error) {
            // 如果APOC不可用，使用基础查询
            logger.debug('APOC不可用，使用基础统计查询');
            return await this.getBasicStats();
        }
        return { labels: 0, relationships: 0, nodes: 0, relations: 0 };
    }
    /**
     * 获取基础统计信息（不依赖APOC）
     */
    async getBasicStats() {
        const nodeCountCypher = 'MATCH (n) RETURN count(n) as nodeCount';
        const relCountCypher = 'MATCH ()-[r]->() RETURN count(r) as relCount';
        const [nodeResult, relResult] = await Promise.all([
            this.executeQuery(nodeCountCypher),
            this.executeQuery(relCountCypher)
        ]);
        return {
            nodes: nodeResult.records[0]?.get('nodeCount')?.toNumber() || 0,
            relations: relResult.records[0]?.get('relCount')?.toNumber() || 0,
            labels: 0,
            relationships: 0,
        };
    }
    /**
     * 健康检查
     */
    async healthCheck() {
        try {
            const cypher = 'RETURN "OK" as status';
            await this.executeQuery(cypher);
            return { healthy: true };
        }
        catch (error) {
            return { healthy: false, error: error.message };
        }
    }
}
export default GraphRepository;
