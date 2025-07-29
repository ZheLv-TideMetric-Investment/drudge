import { neo4jConnection } from './connection';
import { NodeType } from '../../../constants/enums';

/**
 * 实体相关的数据库查询服务
 * 包含所有与实体节点相关的查询操作
 */
class Neo4jEntitiesService {
  /**
   * 搜索实体
   */
  async searchEntities(searchTerm: string, nodeType?: string, limit: number = 20): Promise<any[]> {
    try {
      const hasSearchTerm = searchTerm && searchTerm.trim() !== '';
      
      // 如果指定了节点类型，只搜索该类型
      if (nodeType) {
        let cypher: string;
        
        switch (nodeType.toLowerCase()) {
          case 'company':
            cypher = hasSearchTerm ? `
              MATCH (c:Company)
              WHERE c.company_name CONTAINS $searchTerm
              OPTIONAL MATCH (c)-[r]-()
              RETURN c as entity, 'Company' as type, c.company_name as name, count(r) as connections
              ORDER BY connections DESC, c.company_name
              LIMIT $limit
            ` : `
              MATCH (c:Company)
              OPTIONAL MATCH (c)-[r]-()
              RETURN c as entity, 'Company' as type, c.company_name as name, count(r) as connections
              ORDER BY connections DESC, c.company_name
              LIMIT $limit
            `;
            break;
            
          case 'organization':
            cypher = hasSearchTerm ? `
              MATCH (o:Organization)
              WHERE o.organization_name CONTAINS $searchTerm
              OPTIONAL MATCH (o)-[r]-()
              RETURN o as entity, 'Organization' as type, o.organization_name as name, count(r) as connections
              ORDER BY connections DESC, o.organization_name
              LIMIT $limit
            ` : `
              MATCH (o:Organization)
              OPTIONAL MATCH (o)-[r]-()
              RETURN o as entity, 'Organization' as type, o.organization_name as name, count(r) as connections
              ORDER BY connections DESC, o.organization_name
              LIMIT $limit
            `;
            break;
            
          case 'person':
            cypher = hasSearchTerm ? `
              MATCH (p:Person)
              WHERE p.person_name CONTAINS $searchTerm
              OPTIONAL MATCH (p)-[r]-()
              RETURN p as entity, 'Person' as type, p.person_name as name, count(r) as connections
              ORDER BY connections DESC, p.person_name
              LIMIT $limit
            ` : `
              MATCH (p:Person)
              OPTIONAL MATCH (p)-[r]-()
              RETURN p as entity, 'Person' as type, p.person_name as name, count(r) as connections
              ORDER BY connections DESC, p.person_name
              LIMIT $limit
            `;
            break;
            
          case 'location':
            cypher = hasSearchTerm ? `
              MATCH (l:Location)
              WHERE l.location_name CONTAINS $searchTerm
              OPTIONAL MATCH (l)-[r]-()
              RETURN l as entity, 'Location' as type, l.location_name as name, count(r) as connections
              ORDER BY connections DESC, l.location_name
              LIMIT $limit
            ` : `
              MATCH (l:Location)
              OPTIONAL MATCH (l)-[r]-()
              RETURN l as entity, 'Location' as type, l.location_name as name, count(r) as connections
              ORDER BY connections DESC, l.location_name
              LIMIT $limit
            `;
            break;
            
          case 'event':
            cypher = hasSearchTerm ? `
              MATCH (e:Event)
              WHERE e.event_name CONTAINS $searchTerm OR e.event_description CONTAINS $searchTerm
              OPTIONAL MATCH (e)-[r]-()
              RETURN e as entity, 'Event' as type, e.event_name as name, count(r) as connections
              ORDER BY connections DESC, e.event_name
              LIMIT $limit
            ` : `
              MATCH (e:Event)
              OPTIONAL MATCH (e)-[r]-()
              RETURN e as entity, 'Event' as type, e.event_name as name, count(r) as connections
              ORDER BY connections DESC, e.event_name
              LIMIT $limit
            `;
            break;
            
          default:
            throw new Error(`不支持的节点类型: ${nodeType}`);
        }
        
        const queryParams = hasSearchTerm ? { searchTerm, limit } : { limit };
        
        const result = await neo4jConnection.executeQuery(cypher, queryParams);
        
        return result.records.map((record: any) => {
          const entityNode = record.get('entity');
          return {
            entity: {
              id: entityNode.identity.toString(),
              name: record.get('name'),
              type: record.get('type'),
              properties: entityNode.properties,
              connections: record.get('connections').toNumber()
            },
            type: record.get('type'),
            name: record.get('name'),
            connections: record.get('connections').toNumber()
          };
        });
      }
      
      // 没有指定节点类型，搜索所有类型
      const results: any[] = [];
      
      // 定义查询列表
      const queries = [
        {
          name: 'company',
          cypher: hasSearchTerm ? `
            MATCH (c:Company)
            WHERE c.company_name CONTAINS $searchTerm
            OPTIONAL MATCH (c)-[r]-()
            RETURN c as entity, 'Company' as type, c.company_name as name, count(r) as connections
            ORDER BY connections DESC, c.company_name
            LIMIT $limit
          ` : `
            MATCH (c:Company)
            OPTIONAL MATCH (c)-[r]-()
            RETURN c as entity, 'Company' as type, c.company_name as name, count(r) as connections
            ORDER BY connections DESC, c.company_name
            LIMIT $limit
          `
        },
        {
          name: 'organization',
          cypher: hasSearchTerm ? `
            MATCH (o:Organization)
            WHERE o.organization_name CONTAINS $searchTerm
            OPTIONAL MATCH (o)-[r]-()
            RETURN o as entity, 'Organization' as type, o.organization_name as name, count(r) as connections
            ORDER BY connections DESC, o.organization_name
            LIMIT $limit
          ` : `
            MATCH (o:Organization)
            OPTIONAL MATCH (o)-[r]-()
            RETURN o as entity, 'Organization' as type, o.organization_name as name, count(r) as connections
            ORDER BY connections DESC, o.organization_name
            LIMIT $limit
          `
        },
        {
          name: 'person',
          cypher: hasSearchTerm ? `
            MATCH (p:Person)
            WHERE p.person_name CONTAINS $searchTerm
            OPTIONAL MATCH (p)-[r]-()
            RETURN p as entity, 'Person' as type, p.person_name as name, count(r) as connections
            ORDER BY connections DESC, p.person_name
            LIMIT $limit
          ` : `
            MATCH (p:Person)
            OPTIONAL MATCH (p)-[r]-()
            RETURN p as entity, 'Person' as type, p.person_name as name, count(r) as connections
            ORDER BY connections DESC, p.person_name
            LIMIT $limit
          `
        },
        {
          name: 'location',
          cypher: hasSearchTerm ? `
            MATCH (l:Location)
            WHERE l.location_name CONTAINS $searchTerm
            OPTIONAL MATCH (l)-[r]-()
            RETURN l as entity, 'Location' as type, l.location_name as name, count(r) as connections
            ORDER BY connections DESC, l.location_name
            LIMIT $limit
          ` : `
            MATCH (l:Location)
            OPTIONAL MATCH (l)-[r]-()
            RETURN l as entity, 'Location' as type, l.location_name as name, count(r) as connections
            ORDER BY connections DESC, l.location_name
            LIMIT $limit
          `
        },
        {
          name: 'event',
          cypher: hasSearchTerm ? `
            MATCH (e:Event)
            WHERE e.event_name CONTAINS $searchTerm OR e.event_description CONTAINS $searchTerm
            OPTIONAL MATCH (e)-[r]-()
            RETURN e as entity, 'Event' as type, e.event_name as name, count(r) as connections
            ORDER BY connections DESC, e.event_name
            LIMIT $limit
          ` : `
            MATCH (e:Event)
            OPTIONAL MATCH (e)-[r]-()
            RETURN e as entity, 'Event' as type, e.event_name as name, count(r) as connections
            ORDER BY connections DESC, e.event_name
            LIMIT $limit
          `
        }
      ];

      const queryParams = hasSearchTerm ? { searchTerm, limit } : { limit };
      
      // 逐个执行查询并处理错误
      for (const query of queries) {
        try {
          const result = await neo4jConnection.executeQuery(query.cypher, queryParams);
          result.records.forEach((record: any) => {
            const entityNode = record.get('entity');
            results.push({
              entity: {
                id: entityNode.identity.toString(),
                name: record.get('name'),
                type: record.get('type'),
                properties: entityNode.properties,
                connections: record.get('connections').toNumber()
              },
              type: record.get('type'),
              name: record.get('name'),
              connections: record.get('connections').toNumber()
            });
          });
        } catch (error) {
          console.error(`查询 ${query.name} 失败:`, error);
          // 继续执行其他查询
        }
      }
      
      // 按连接数排序并限制结果数量
      return results
        .sort((a, b) => b.connections - a.connections)
        .slice(0, limit);
        
    } catch (error: any) {
      console.error('搜索实体失败:', error);
      throw error;
    }
  }

  /**
   * 获取最活跃的实体
   */
  async getMostConnectedEntities(limit: number = 20): Promise<any[]> {
    try {
      const cypher = `
        MATCH (entity)<-[:INVOLVES|:LOCATED_AT]-(n:News)
        WHERE entity.name IS NOT NULL
        RETURN labels(entity) as labels, entity.name as name, count(n) as newsCount
        ORDER BY newsCount DESC
        LIMIT $limit
      `;

      const result = await neo4jConnection.executeQuery(cypher, { limit });
      
      return result.records.map((record: any) => ({
        labels: record.get('labels'),
        name: record.get('name'),
        newsCount: record.get('newsCount').toNumber()
      }));
    } catch (error: any) {
      console.error('获取最活跃实体失败:', error);
      throw error;
    }
  }

  /**
   * 根据实体名称查询相关新闻
   */
  async getEntityNews(entityName: string, limit: number = 10): Promise<any[]> {
    try {
      const cypher = `
        MATCH (entity {name: $entityName})<-[r]-(n:News)
        RETURN n.id as id, n.title as title, n.level as level, 
               n.timestamp as timestamp, type(r) as relationType
        ORDER BY n.timestamp DESC
        LIMIT $limit
      `;

      const result = await neo4jConnection.executeQuery(cypher, { entityName, limit });

      return result.records.map((record: any) => ({
        id: record.get('id'),
        title: record.get('title'),
        level: record.get('level'),
        timestamp: record.get('timestamp'),
        relationType: record.get('relationType')
      }));
    } catch (error: any) {
      console.error('查询实体相关新闻失败:', error);
      throw error;
    }
  }

  /**
   * 查找相似实体
   */
  async findSimilarEntities(entityId: string, entityType: string, limit: number = 10): Promise<any[]> {
    try {
      // 基于共同连接的实体进行相似度分析
      const cypher = `
        MATCH (source:${entityType})-[r1]-(common)-[r2]-(similar:${entityType})
        WHERE elementId(source) = $entityId AND source <> similar
        WITH similar, count(common) as commonConnections
        OPTIONAL MATCH (similar)-[r]-()
        WITH similar, commonConnections, count(r) as totalConnections
        RETURN similar as entity, 
               commonConnections,
               totalConnections,
               toFloat(commonConnections) / toFloat(totalConnections) as similarity
        ORDER BY similarity DESC, commonConnections DESC
        LIMIT $limit
      `;

      const result = await neo4jConnection.executeQuery(cypher, { entityId, limit });
      
      return result.records.map((record: any) => {
        const entity = record.get('entity');
        return {
          entity: {
            id: entity.identity.toString(),
            name: this.getEntityName(entity),
            type: entity.labels[0],
            properties: entity.properties
          },
          score: record.get('similarity').toNumber() || 0,
          connections: record.get('totalConnections').toNumber()
        };
      });
    } catch (error: any) {
      console.error('查找相似实体失败:', error);
      return [];
    }
  }

  /**
   * 获取实体关系
   */
  async getEntityRelationships(entityName: string, limit: number = 50): Promise<any[]> {
    try {
      const cypher = `
        MATCH (entity)-[r]-(connected)
        WHERE entity.name = $entityName 
           OR entity.company_name = $entityName 
           OR entity.person_name = $entityName 
           OR entity.organization_name = $entityName 
           OR entity.location_name = $entityName
        RETURN 
          type(r) as relationType,
          r.description as description,
          r.confidence as confidence,
          r.inferred as inferred,
          labels(entity) as entityLabels,
          entity,
          labels(connected) as connectedLabels,
          connected
        LIMIT $limit
      `;

      const result = await neo4jConnection.executeQuery(cypher, { entityName, limit });
      
      return result.records.map((record: any) => ({
        relationType: record.get('relationType'),
        description: record.get('description'),
        confidence: record.get('confidence'),
        inferred: record.get('inferred') || false,
        entity: {
          labels: record.get('entityLabels'),
          properties: record.get('entity').properties
        },
        connected: {
          labels: record.get('connectedLabels'),
          properties: record.get('connected').properties
        }
      }));
    } catch (error: any) {
      console.error('获取实体关系失败:', error);
      return [];
    }
  }

  /**
   * 获取实体名称的辅助方法
   */
  private getEntityName(entity: any): string {
    const properties = entity.properties;
    const labels = entity.labels;
    
    // 根据实体类型返回对应的名称属性
    if (labels.includes('Company')) {
      return properties.company_name || '';
    } else if (labels.includes('Person')) {
      return properties.person_name || '';
    } else if (labels.includes('Organization')) {
      return properties.organization_name || '';
    } else if (labels.includes('Location')) {
      return properties.location_name || '';
    } else if (labels.includes('Event')) {
      return properties.event_name || '';
    }
    
    return properties.name || '';
  }
}

export const neo4jEntitiesService = new Neo4jEntitiesService();
export { Neo4jEntitiesService }; 