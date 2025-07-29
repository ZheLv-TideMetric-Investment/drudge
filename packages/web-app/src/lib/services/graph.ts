import { neo4jGraphService, neo4jEntitiesService } from '../neo4j';
import { GraphData, EntitySearchResult } from '@/types';

/**
 * 图谱查询服务 - 重构后的包装器
 * 提供高级图谱查询功能，基于重构后的数据库服务
 */
class GraphService {
  private graphService = neo4jGraphService;
  private entitiesService = neo4jEntitiesService;

  /**
   * 获取图谱概览数据
   */
  async getGraphOverview(limit: number = 50): Promise<GraphData> {
    return await this.graphService.getGraphOverview(limit);
  }

  /**
   * 搜索图谱数据
   */
  async searchGraph(query: string, limit: number = 100): Promise<GraphData> {
    return await this.graphService.searchGraph(query, limit);
  }

  /**
   * 获取实体的邻居关系
   */
  async getEntityNeighborhood(entityId: string, depth: number = 1, limit: number = 50): Promise<GraphData> {
    return await this.graphService.getEntityNeighborhood(entityId, depth, limit);
  }

  /**
   * 按节点类型获取图谱数据
   */
  async getGraphByNodeType(nodeType: string, limit: number = 100): Promise<GraphData> {
    return await this.graphService.getGraphByNodeType(nodeType, limit);
  }

  /**
   * 获取最活跃的实体
   */
  async getMostConnectedEntities(limit: number = 20): Promise<EntitySearchResult[]> {
    const entities = await this.entitiesService.getMostConnectedEntities(limit);
    return entities.map(entity => ({
      entity: {
        id: '', // 需要时可以添加
        name: entity.name,
        type: entity.labels[0] as any,
        properties: {}
      },
      score: 1.0,
      connections: entity.newsCount,
      relevanceScore: 1.0,
      matchedProperties: []
    }));
  }

  /**
   * 获取特定新闻的知识图谱
   */
  async getNewsKnowledgeGraph(newsId: string): Promise<GraphData> {
    return await this.graphService.getNewsKnowledgeGraph(newsId);
  }

  /**
   * 获取公司关系网络
   */
  async getCompanyNetwork(companyName?: string, limit: number = 50): Promise<GraphData> {
    return await this.graphService.getCompanyNetwork(companyName, limit);
  }

  /**
   * 获取热点排行数据
   */
  async getHotRankData(days: number = 7, limit: number = 20): Promise<any> {
    return await this.graphService.getHotRankData(days, limit);
  }

  /**
   * 实体相似度分析
   */
  async findSimilarEntities(entityId: string, entityType: string, limit: number = 10): Promise<EntitySearchResult[]> {
    return await this.entitiesService.findSimilarEntities(entityId, entityType, limit);
  }
}

export const graphService = new GraphService();
export { GraphService }; 