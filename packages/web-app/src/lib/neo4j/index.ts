// 统一导出所有Neo4j数据库服务

// 基础连接服务
export { neo4jConnection, Neo4jConnectionService } from './connection';

// 新闻相关查询服务
export { neo4jNewsService, Neo4jNewsService } from './news';

// 实体相关查询服务
export { neo4jEntitiesService, Neo4jEntitiesService } from './entities';

// 图谱查询服务
export { neo4jGraphService, Neo4jGraphService } from './graph';

// 分析和统计查询服务
export { neo4jAnalyticsService, Neo4jAnalyticsService } from './analytics';

// 导入各个服务实例
import { neo4jConnection, Neo4jConnectionService } from './connection';
import { neo4jNewsService, Neo4jNewsService } from './news';
import { neo4jEntitiesService, Neo4jEntitiesService } from './entities';
import { neo4jGraphService, Neo4jGraphService } from './graph';
import { neo4jAnalyticsService, Neo4jAnalyticsService } from './analytics';

// 统一的数据库服务接口
export interface INeo4jServices {
  connection: Neo4jConnectionService;
  news: Neo4jNewsService;
  entities: Neo4jEntitiesService;
  graph: Neo4jGraphService;
  analytics: Neo4jAnalyticsService;
}

// 创建统一的服务实例
export const neo4jServices: INeo4jServices = {
  connection: neo4jConnection,
  news: neo4jNewsService,
  entities: neo4jEntitiesService,
  graph: neo4jGraphService,
  analytics: neo4jAnalyticsService
};

// 默认导出连接服务（保持向后兼容）
export default neo4jConnection; 