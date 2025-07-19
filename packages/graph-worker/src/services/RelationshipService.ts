import { logger } from '../utils/logger';
import neo4jService from './Neo4jService';
import { getCurrentTime } from '../utils/timeUtils';
import { 
  NewsExtractionResult, 
  Relationship,
  Company,
  Person,
  Organization,
  Location
} from '../types/index';

/**
 * 关系服务
 * 负责知识图谱中实体关系的创建和管理
 */
export class RelationshipService {
  private neo4j = neo4jService;
  private initialized: boolean = false;

  constructor() {
    // 使用共享的 Neo4j 单例实例
  }

  /**
   * 初始化服务
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;
    
    try {
      await this.neo4j.initialize();
      this.initialized = true;
      logger.info('✅ 关系服务初始化完成');
    } catch (error) {
      logger.error('❌ 关系服务初始化失败:', error);
      throw error;
    }
  }

  /**
   * 创建单个关系
   */
  async createRelationship(relationship: Relationship, newsId: string): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }

    // 清理关系类型，确保是有效的Neo4j关系类型
    const cleanRelType = this.sanitizeRelationshipType(relationship.type);
    
    const cypher = `
      MATCH (from) 
      WHERE from.name = $fromName 
         OR from.company_name = $fromName 
         OR from.person_name = $fromName 
         OR from.organization_name = $fromName 
         OR from.location_name = $fromName
      MATCH (to) 
      WHERE to.name = $toName 
         OR to.company_name = $toName 
         OR to.person_name = $toName 
         OR to.organization_name = $toName 
         OR to.location_name = $toName
      MERGE (from)-[r:${cleanRelType}]->(to)
      SET r.description = $description,
          r.confidence = $confidence,
          r.newsId = $newsId,
          r.created_at = $createdAt,
          r.updated_at = $updatedAt
      RETURN r
    `;

    const parameters = {
      fromName: relationship.from,
      toName: relationship.to,
      description: relationship.description || '',
      confidence: relationship.confidence || 0.8,
      newsId,
      createdAt: getCurrentTime(),
      updatedAt: getCurrentTime()
    };

    try {
      await this.neo4j.executeQuery(cypher, parameters);
      logger.debug(`关系创建成功: ${relationship.from} -[${cleanRelType}]-> ${relationship.to}`);
    } catch (error) {
      logger.warn(`关系创建失败: ${relationship.from} -[${cleanRelType}]-> ${relationship.to}`, error);
    }
  }

  /**
   * 批量创建关系
   */
  async batchCreateRelationships(extractionResults: NewsExtractionResult[]): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }

    const queries: string[] = [];
    const parameters: any = {};
    let paramIndex = 0;

    for (const result of extractionResults) {
      for (const relationship of result.relationships) {
        const cleanRelType = this.sanitizeRelationshipType(relationship.type);
        const paramKey = `rel_${paramIndex}`;
        
        queries.push(`
          MATCH (from) 
          WHERE from.name = $${paramKey}.fromName 
             OR from.company_name = $${paramKey}.fromName 
             OR from.person_name = $${paramKey}.fromName 
             OR from.organization_name = $${paramKey}.fromName 
             OR from.location_name = $${paramKey}.fromName
          MATCH (to) 
          WHERE to.name = $${paramKey}.toName 
             OR to.company_name = $${paramKey}.toName 
             OR to.person_name = $${paramKey}.toName 
             OR to.organization_name = $${paramKey}.toName 
             OR to.location_name = $${paramKey}.toName
          MERGE (from)-[r:${cleanRelType}]->(to)
          SET r.description = $${paramKey}.description,
              r.confidence = $${paramKey}.confidence,
              r.newsId = $${paramKey}.newsId,
              r.created_at = $${paramKey}.createdAt,
              r.updated_at = $${paramKey}.updatedAt
        `);

        parameters[paramKey] = {
          fromName: relationship.from,
          toName: relationship.to,
          description: relationship.description || '',
          confidence: relationship.confidence || 0.8,
          newsId: result.newsId || '',
          createdAt: getCurrentTime(),
          updatedAt: getCurrentTime()
        };

        paramIndex++;
      }
    }

    if (queries.length > 0) {
      try {
        // 单独执行每个查询以避免变量冲突
        let successCount = 0;
        for (let i = 0; i < queries.length; i++) {
          const query = queries[i];
          if (!query) continue; // 跳过空查询
          
          const paramKey = `rel_${i}`;
          const queryParams = { [paramKey]: parameters[paramKey] };
          
          try {
            await this.neo4j.executeQuery(query, queryParams);
            successCount++;
          } catch (queryError) {
            logger.warn('单个关系创建失败:', queryError);
          }
        }
        logger.info(`批量关系创建完成: ${successCount}/${queries.length} 个关系`);
      } catch (error) {
        logger.error('批量关系创建失败:', error);
        // 回退到单个创建
        for (const result of extractionResults) {
          for (const relationship of result.relationships) {
            try {
              const newsId = result.newsId ?? '';
              await this.createRelationship(relationship, newsId);
            } catch (relError) {
              logger.warn(`单个关系创建失败: ${relationship.from} -> ${relationship.to}`, relError);
            }
          }
        }
      }
    }
  }

  /**
   * 创建推断关系
   * 基于共同出现在同一新闻中的实体，创建推断关系
   */
  async createInferredRelationships(extractionResults: NewsExtractionResult[]): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }

    const queries: string[] = [];
    const processedPairs = new Set<string>();

    for (const result of extractionResults) {
      const { companies, persons, organizations, locations } = result;

      // 公司-人物关系推断 (人物在公司工作)
      for (const company of companies) {
        for (const person of persons || []) {
          const pairKey = `${company.company_name}-${person.person_name}`;
          if (!processedPairs.has(pairKey)) {
            processedPairs.add(pairKey);
            queries.push(`
              MATCH (c:Company {company_name: "${this.escapeString(company.company_name)}"})
              MATCH (p:Person {person_name: "${this.escapeString(person.person_name)}"})
              MERGE (p)-[r:WORKS_FOR]->(c)
              SET r.inferred = true, 
                  r.confidence = 0.6,
                  r.source_news = "${result.newsId || ''}",
                  r.created_at = "${getCurrentTime()}",
                  r.updated_at = "${getCurrentTime()}"
            `);
          }
        }
      }

      // 公司-位置关系推断
      for (const company of companies) {
        for (const location of locations) {
          const pairKey = `${company.company_name}-${location.location_name}`;
          if (!processedPairs.has(pairKey)) {
            processedPairs.add(pairKey);
            queries.push(`
              MATCH (c:Company {company_name: "${this.escapeString(company.company_name)}"})
              MATCH (l:Location {location_name: "${this.escapeString(location.location_name)}"})
              MERGE (c)-[r:LOCATED_IN]->(l)
              SET r.inferred = true, 
                  r.confidence = 0.6,
                  r.source_news = "${result.newsId || ''}",
                  r.created_at = "${getCurrentTime()}",
                  r.updated_at = "${getCurrentTime()}"
            `);
          }
        }
      }

      // 人物-位置关系推断
      for (const person of persons || []) {
        for (const location of locations) {
          const pairKey = `${person.person_name}-${location.location_name}`;
          if (!processedPairs.has(pairKey)) {
            processedPairs.add(pairKey);
            queries.push(`
              MATCH (p:Person {person_name: "${this.escapeString(person.person_name)}"})
              MATCH (l:Location {location_name: "${this.escapeString(location.location_name)}"})
              MERGE (p)-[r:LOCATED_IN]->(l)
              SET r.inferred = true, 
                  r.confidence = 0.6,
                  r.source_news = "${result.newsId || ''}",
                  r.created_at = "${getCurrentTime()}",
                  r.updated_at = "${getCurrentTime()}"
            `);
          }
        }
      }

      // 机构-位置关系推断
      for (const organization of organizations) {
        for (const location of locations) {
          const pairKey = `${organization.organization_name}-${location.location_name}`;
          if (!processedPairs.has(pairKey)) {
            processedPairs.add(pairKey);
            queries.push(`
              MATCH (o:Organization {organization_name: "${this.escapeString(organization.organization_name)}"})
              MATCH (l:Location {location_name: "${this.escapeString(location.location_name)}"})
              MERGE (o)-[r:LOCATED_IN]->(l)
              SET r.inferred = true, 
                  r.confidence = 0.6,
                  r.source_news = "${result.newsId || ''}",
                  r.created_at = "${getCurrentTime()}",
                  r.updated_at = "${getCurrentTime()}"
            `);
          }
        }
      }
    }

    // 执行推断关系创建
    if (queries.length > 0) {
      try {
        // 单独执行每个查询以避免变量冲突
        let successCount = 0;
        for (const query of queries) {
          try {
            await this.neo4j.executeQuery(query);
            successCount++;
          } catch (queryError) {
            logger.warn('单个推断关系创建失败:', queryError);
          }
        }
        logger.info(`推断关系创建完成: ${successCount}/${queries.length} 个关系`);
      } catch (error) {
        logger.error('推断关系创建失败:', error);
      }
    }
  }

  /**
   * 获取实体关系
   */
  async getEntityRelationships(entityName: string, limit: number = 50): Promise<any[]> {
    if (!this.initialized) {
      await this.initialize();
    }

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

    try {
      const result = await this.neo4j.executeQuery(cypher, { entityName, limit });
      
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
    } catch (error) {
      logger.error('获取实体关系失败:', error);
      return [];
    }
  }

  /**
   * 验证并标准化关系类型
   */
  private sanitizeRelationshipType(relType: string): string {
    // 标准关系类型
    const validRelationships = [
      'LOCATED_IN', 'WORKS_FOR', 'OWNS', 'PARTICIPATES_IN', 'MERGES_WITH', 'ACQUIRES',
      'SUPPLIES', 'PARTNERS_WITH', 'SUED_BY', 'REGULATED_BY', 'INVESTS_IN', 'OTHER'
    ];
    
    // 检查是否是标准关系类型
    const upperRelType = relType.toUpperCase();
    if (validRelationships.includes(upperRelType)) {
      return upperRelType;
    }
    
    // 尝试映射常见的关系类型
    const typeMapping: { [key: string]: string } = {
      'DESCRIBES': 'OTHER',
      'INVOLVES': 'PARTICIPATES_IN',
      'MENTIONS': 'OTHER',
      'LOCATED_AT': 'LOCATED_IN',
      'OCCURRED_AT': 'OTHER',
      'RELATED': 'OTHER',
      'ASSOCIATED_WITH': 'OTHER',
      'MEMBER_OF': 'PARTICIPATES_IN',
      'SUBSIDIARY_OF': 'OWNS',
      'PARENT_OF': 'OWNS',
      'COMPETITOR_OF': 'OTHER'
    };
    
    const mapped = typeMapping[upperRelType];
    if (mapped) {
      return mapped;
    }
    
    // 默认返回 OTHER
    logger.warn(`未知关系类型: ${relType}，使用默认值 OTHER`);
    return 'OTHER';
  }

  /**
   * 转义字符串中的特殊字符
   */
  private escapeString(str: string): string {
    return str.replace(/"/g, '\\"').replace(/'/g, "\\'");
  }

  /**
   * 关闭服务
   */
  async close(): Promise<void> {
    if (this.neo4j) {
      await this.neo4j.close();
    }
    this.initialized = false;
  }
}

// 导出单例
export default new RelationshipService(); 