import neo4j, { Driver, Session } from 'neo4j-driver';
import { logger } from '../utils/logger';
import config from '../config/config';

/**
 * Neo4j 数据库服务
 */
export class Neo4jService {
  private driver: Driver | null = null;
  private isConnected = false;

  /**
   * 初始化连接
   */
  async initialize(): Promise<void> {
    try {
      logger.info('🔗 正在连接Neo4j数据库...');
      
      this.driver = neo4j.driver(
        config.neo4j.uri,
        neo4j.auth.basic(config.neo4j.user, config.neo4j.password)
      );

      // 测试连接
      const session = this.driver.session();
      try {
        await session.run('RETURN 1');
        this.isConnected = true;
        logger.info('✅ Neo4j数据库连接成功');
        
        // 创建唯一约束
        await this.createUniqueConstraints();
        
      } finally {
        await session.close();
      }

    } catch (error) {
      logger.error('❌ Neo4j数据库连接失败:', error);
      throw error;
    }
  }

  /**
   * 获取session
   */
  getSession(): Session {
    if (!this.driver || !this.isConnected) {
      throw new Error('Neo4j数据库未连接');
    }
    return this.driver.session();
  }

  /**
   * 执行查询
   */
  async executeQuery(query: string, params: any = {}): Promise<any> {
    const session = this.getSession();
    try {
      const result = await session.run(query, params);
      return result;
    } finally {
      await session.close();
    }
  }

  /**
   * 执行事务
   */
  async executeTransaction(queries: Array<{ query: string; params?: any }>): Promise<any> {
    const session = this.getSession();
    try {
      return await session.writeTransaction(async (tx) => {
        const results = [];
        for (const { query, params } of queries) {
          const result = await tx.run(query, params || {});
          results.push(result);
        }
        return results;
      });
    } finally {
      await session.close();
    }
  }

  /**
   * 创建数据库索引
   */
  async createIndexes(): Promise<void> {
    const session = this.getSession();
    try {
      logger.info('🔍 创建数据库索引...');
      
      // 新闻节点索引
      await session.run(
        'CREATE INDEX news_id_index IF NOT EXISTS FOR (n:News) ON (n.id)'
      );
      
      await session.run(
        'CREATE INDEX news_timestamp_index IF NOT EXISTS FOR (n:News) ON (n.timestamp)'
      );
      
      await session.run(
        'CREATE INDEX news_level_index IF NOT EXISTS FOR (n:News) ON (n.news_level)'
      );
      
      // 实体节点索引
      await session.run(
        'CREATE INDEX company_name_index IF NOT EXISTS FOR (c:Company) ON (c.company_name)'
      );
      
      await session.run(
        'CREATE INDEX person_name_index IF NOT EXISTS FOR (p:Person) ON (p.person_name)'
      );
      
      await session.run(
        'CREATE INDEX organization_name_index IF NOT EXISTS FOR (o:Organization) ON (o.organization_name)'
      );
      
      await session.run(
        'CREATE INDEX location_name_index IF NOT EXISTS FOR (l:Location) ON (l.location_name)'
      );
      
      await session.run(
        'CREATE INDEX time_value_index IF NOT EXISTS FOR (t:Time) ON (t.time_value)'
      );
      
      // 事件节点索引
      await session.run(
        'CREATE INDEX event_id_index IF NOT EXISTS FOR (e:Event) ON (e.event_id)'
      );
      
      await session.run(
        'CREATE INDEX event_type_index IF NOT EXISTS FOR (e:Event) ON (e.event_type)'
      );
      
      await session.run(
        'CREATE INDEX event_date_index IF NOT EXISTS FOR (e:Event) ON (e.event_date)'
      );
      
      await session.run(
        'CREATE INDEX event_level_index IF NOT EXISTS FOR (e:Event) ON (e.event_level)'
      );
      
      logger.info('✅ 数据库索引创建完成');
    } catch (error) {
      logger.error('❌ 创建数据库索引失败:', error);
      throw error;
    } finally {
      await session.close();
    }
  }

  /**
   * 获取数据库统计信息
   */
  async getDbStats(): Promise<any> {
    const session = this.getSession();
    try {
      // 获取节点统计
      const nodeStats = await session.run(`
        MATCH (n)
        RETURN labels(n) as labels, count(n) as count
        ORDER BY count DESC
      `);
      
      // 获取关系统计
      const relStats = await session.run(`
        MATCH ()-[r]->()
        RETURN type(r) as type, count(r) as count
        ORDER BY count DESC
      `);
      
      // 获取总数
      const totalNodes = await session.run('MATCH (n) RETURN count(n) as total');
      const totalRels = await session.run('MATCH ()-[r]->() RETURN count(r) as total');
      
      return {
        nodes: {
          byLabel: nodeStats.records.map(record => ({
            labels: record.get('labels'),
            count: record.get('count').toNumber()
          })),
          total: totalNodes.records[0]?.get('total').toNumber() || 0
        },
        relationships: {
          byType: relStats.records.map(record => ({
            type: record.get('type'),
            count: record.get('count').toNumber()
          })),
          total: totalRels.records[0]?.get('total').toNumber() || 0
        }
      };
    } catch (error) {
      logger.error('获取数据库统计失败:', error);
      throw error;
    } finally {
      await session.close();
    }
  }

  /**
   * 清理数据库
   */
  async clearDatabase(): Promise<void> {
    const session = this.getSession();
    try {
      logger.info('🗑️ 清理数据库...');
      
      // 删除所有关系
      await session.run('MATCH ()-[r]->() DELETE r');
      
      // 删除所有节点
      await session.run('MATCH (n) DELETE n');
      
      logger.info('✅ 数据库清理完成');
    } catch (error) {
      logger.error('❌ 数据库清理失败:', error);
      throw error;
    } finally {
      await session.close();
    }
  }

  /**
   * 健康检查
   */
  async healthCheck(): Promise<boolean> {
    const session = this.getSession();
    try {
      await session.run('MATCH (n) RETURN count(n) LIMIT 1');
      return true;
    } catch (error) {
      logger.error('Neo4j健康检查失败:', error);
      return false;
    } finally {
      await session.close();
    }
  }

  /**
   * 创建唯一约束（避免实体重复）
   */
  async createUniqueConstraints(): Promise<void> {
    const session = this.getSession();
    try {
      logger.info('🔒 创建唯一约束...');
      
      // 先删除可能存在的冲突索引
      await this.dropConflictingIndexes(session);
      
      // 公司唯一约束
      await session.run(`
        CREATE CONSTRAINT IF NOT EXISTS
        FOR (c:Company) REQUIRE c.company_name IS UNIQUE
      `);
      
      // 人物唯一约束
      await session.run(`
        CREATE CONSTRAINT IF NOT EXISTS
        FOR (p:Person) REQUIRE p.person_name IS UNIQUE
      `);
      
      // 机构唯一约束
      await session.run(`
        CREATE CONSTRAINT IF NOT EXISTS
        FOR (o:Organization) REQUIRE o.organization_name IS UNIQUE
      `);
      
      // 地点唯一约束
      await session.run(`
        CREATE CONSTRAINT IF NOT EXISTS
        FOR (l:Location) REQUIRE l.location_name IS UNIQUE
      `);
      
      // 新闻唯一约束
      await session.run(`
        CREATE CONSTRAINT IF NOT EXISTS
        FOR (n:News) REQUIRE n.id IS UNIQUE
      `);
      
      // 事件唯一约束
      await session.run(`
        CREATE CONSTRAINT IF NOT EXISTS
        FOR (e:Event) REQUIRE e.event_id IS UNIQUE
      `);
      
      logger.info('✅ 唯一约束创建完成');
    } catch (error) {
      logger.error('❌ 创建唯一约束失败:', error);
      throw error;
    } finally {
      await session.close();
    }
  }

  /**
   * 删除可能冲突的索引（简化版）
   */
  private async dropConflictingIndexes(session: Session): Promise<void> {
    try {
      logger.info('🧹 删除可能冲突的索引...');
      
      // 尝试删除可能存在的冲突索引
      const potentialIndexes = [
        'company_name_index',
        'person_name_index', 
        'organization_name_index',
        'location_name_index',
        'news_id_index',
        'event_id_index'
      ];
      
      for (const indexName of potentialIndexes) {
        try {
          await session.run(`DROP INDEX ${indexName} IF EXISTS`);
          logger.debug(`🗑️ 尝试删除索引: ${indexName}`);
        } catch (error) {
          // 忽略索引不存在的错误
          logger.debug(`索引不存在或已删除: ${indexName}`);
        }
      }
      
      logger.info('✅ 冲突索引清理完成');
    } catch (error) {
      logger.warn('⚠️ 清理冲突索引失败，继续执行...', error);
    }
  }

  /**
   * 批量执行 MERGE 写入（标准模板）
   */
  async batchMergeEntities(entityType: string, entities: any[]): Promise<void> {
    if (entities.length === 0) return;
    
    const session = this.getSession();
    try {
      logger.info(`🔄 批量MERGE写入 ${entityType}: ${entities.length} 个实体`);
      
      let cypher = '';
      
      switch (entityType) {
        case 'Company':
          cypher = `
            UNWIND $entities AS c
            MERGE (co:Company {company_name: c.company_name})
              ON CREATE SET co += c, co.created_at = timestamp()
              ON MATCH SET co += c, co.updated_at = timestamp()
            RETURN co
          `;
          break;
          
        case 'Person':
          cypher = `
            UNWIND $entities AS p
            MERGE (pe:Person {person_name: p.person_name})
              ON CREATE SET pe += p, pe.created_at = timestamp()
              ON MATCH SET pe += p, pe.updated_at = timestamp()
            RETURN pe
          `;
          break;
          
        case 'Organization':
          cypher = `
            UNWIND $entities AS o
            MERGE (org:Organization {organization_name: o.organization_name})
              ON CREATE SET org += o, org.created_at = timestamp()
              ON MATCH SET org += o, org.updated_at = timestamp()
            RETURN org
          `;
          break;
          
        case 'Location':
          cypher = `
            UNWIND $entities AS l
            MERGE (loc:Location {location_name: l.location_name})
              ON CREATE SET loc += l, loc.created_at = timestamp()
              ON MATCH SET loc += l, loc.updated_at = timestamp()
            RETURN loc
          `;
          break;
          
        case 'Event':
          cypher = `
            UNWIND $entities AS e
            MERGE (ev:Event {event_id: e.event_id})
              ON CREATE SET ev += e, ev.created_at = timestamp()
              ON MATCH SET ev += e, ev.updated_at = timestamp()
            RETURN ev
          `;
          break;
          
        case 'News':
          cypher = `
            UNWIND $entities AS n
            MERGE (news:News {id: n.id})
              ON CREATE SET news += n, news.created_at = timestamp()
              ON MATCH SET news += n, news.updated_at = timestamp()
            RETURN news
          `;
          break;
          
        case 'Time':
          cypher = `
            UNWIND $entities AS t
            MERGE (time:Time {time_value: t.time_value})
              ON CREATE SET time += t, time.created_at = timestamp()
              ON MATCH SET time += t, time.updated_at = timestamp()
            RETURN time
          `;
          break;
          
        default:
          throw new Error(`不支持的实体类型: ${entityType}`);
      }
      
      await session.run(cypher, { entities });
      logger.debug(`✅ ${entityType} 批量MERGE完成`);
      
    } catch (error) {
      logger.error(`❌ ${entityType} 批量MERGE失败:`, error);
      throw error;
    } finally {
      await session.close();
    }
  }

  /**
   * 批量创建关系（MERGE模板）
   */
  async batchMergeRelationships(relationships: Array<{
    fromType: string;
    fromKey: string;
    fromValue: string;
    toType: string;
    toKey: string;
    toValue: string;
    relType: string;
    properties?: any;
  }>): Promise<void> {
    if (relationships.length === 0) return;
    
    const session = this.getSession();
    try {
      logger.info(`🔄 批量MERGE关系: ${relationships.length} 个关系`);
      
      for (const rel of relationships) {
        const cypher = `
          MERGE (from:${rel.fromType} {${rel.fromKey}: $fromValue})
          MERGE (to:${rel.toType} {${rel.toKey}: $toValue})
          MERGE (from)-[r:${rel.relType}]->(to)
          ON CREATE SET r += $properties, r.created_at = timestamp()
          ON MATCH SET r += $properties, r.updated_at = timestamp()
          RETURN r
        `;
        
        await session.run(cypher, {
          fromValue: rel.fromValue,
          toValue: rel.toValue,
          properties: rel.properties || {}
        });
      }
      
      logger.debug(`✅ 关系批量MERGE完成`);
      
    } catch (error) {
      logger.error(`❌ 关系批量MERGE失败:`, error);
      throw error;
    } finally {
      await session.close();
    }
  }

  /**
   * 关闭连接
   */
  async close(): Promise<void> {
    if (this.driver) {
      await this.driver.close();
      this.isConnected = false;
      logger.info('🔌 Neo4j数据库连接已关闭');
    }
  }
}

export default new Neo4jService(); 