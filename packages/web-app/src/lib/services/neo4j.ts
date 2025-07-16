import neo4j, { Driver, Session } from 'neo4j-driver';
import { config } from '../config';

/**
 * Neo4j 数据库服务
 */
class Neo4jService {
  public driver: Driver | null = null;
  public connected: boolean = false;

  constructor() {
    this.driver = null;
  }

  /**
   * 连接数据库
   */
  async connect(): Promise<void> {
    try {
      this.driver = neo4j.driver(
        config.neo4j.uri,
        neo4j.auth.basic(config.neo4j.user, config.neo4j.password)
      );

      // 测试连接
      await this.driver.verifyConnectivity();
      this.connected = true;
      console.log('✅ Neo4j 数据库连接成功');
    } catch (error) {
      console.error('❌ Neo4j 数据库连接失败:', error);
      throw error;
    }
  }

  /**
   * 断开连接
   */
  async disconnect(): Promise<void> {
    if (this.driver) {
      await this.driver.close();
      this.connected = false;
      console.log('Neo4j 数据库连接已关闭');
    }
  }

  /**
   * 创建会话
   */
  getSession(): Session {
    if (!this.driver) {
      throw new Error('Neo4j 驱动未初始化');
    }
    return this.driver.session({ database: config.neo4j.database });
  }

  /**
   * 执行查询
   */
  async executeQuery(cypher: string, parameters: any = {}): Promise<any> {
    // 确保连接已建立
    if (!this.driver) {
      await this.connect();
    }
    
    const session = this.getSession();
    try {
      const result = await session.run(cypher, parameters);
      return result;
    } catch (error) {
      console.error('Neo4j 查询执行失败:', error);
      throw error;
    } finally {
      await session.close();
    }
  }

  /**
   * 执行事务
   */
  async executeTransaction(work: (tx: any) => Promise<any>): Promise<any> {
    // 确保连接已建立
    if (!this.driver) {
      await this.connect();
    }
    
    const session = this.getSession();
    try {
      return await session.executeWrite(work);
    } catch (error) {
      console.error('Neo4j 事务执行失败:', error);
      throw error;
    } finally {
      await session.close();
    }
  }

  /**
   * 健康检查
   */
  async healthCheck(): Promise<boolean> {
    try {
      if (!this.driver) {
        try {
          await this.connect();
        } catch (error) {
          console.error('Neo4j 自动连接失败:', error);
          return false;
        }
      }
      
      if (!this.driver) {
        return false;
      }
      
      await this.driver.verifyConnectivity();
      return true;
    } catch (error) {
      console.error('Neo4j 健康检查失败:', error);
      return false;
    }
  }

  /**
   * 获取数据库统计信息
   */
  async getDatabaseStats(): Promise<any> {
    try {
      const cypher = `
        CALL {
          MATCH (n:News) RETURN count(n) as news_count
          UNION ALL
          MATCH (n:Company) RETURN count(n) as company_count
          UNION ALL
          MATCH (n:Person) RETURN count(n) as person_count
          UNION ALL
          MATCH (n:Organization) RETURN count(n) as organization_count
          UNION ALL
          MATCH (n:Location) RETURN count(n) as location_count
          UNION ALL
          MATCH (n:Event) RETURN count(n) as event_count
          UNION ALL
          MATCH (n:Time) RETURN count(n) as time_count
          UNION ALL
          MATCH ()-[r]->() RETURN count(r) as relationship_count
          UNION ALL
          MATCH (n) RETURN count(n) as total_nodes
        }
        RETURN collect({news: news_count, companies: company_count, persons: person_count, 
                       organizations: organization_count, locations: location_count, 
                       events: event_count, times: time_count, relationships: relationship_count, 
                       totalNodes: total_nodes}) as stats
      `;
      
      const result = await this.executeQuery(cypher);
      
      if (result.records.length === 0) {
        return { 
          totalNodes: 0, 
          relationships: 0,
          news: 0,
          companies: 0,
          persons: 0,
          organizations: 0,
          locations: 0,
          events: 0,
          times: 0,
          connected: this.connected 
        };
      }

      // 简化统计数据提取
      const simpleStats = await this.getSimpleStats();
      return {
        ...simpleStats,
        connected: this.connected
      };
    } catch (error: any) {
      console.error('获取数据库统计信息失败:', error);
      return { error: error.message, connected: this.connected };
    }
  }

  /**
   * 获取简化的统计信息
   */
  async getSimpleStats(): Promise<any> {
    try {
      const cypher = `
        MATCH (n:News) WITH count(n) as news_count
        MATCH (c:Company) WITH news_count, count(c) as company_count
        MATCH (p:Person) WITH news_count, company_count, count(p) as person_count
        MATCH (o:Organization) WITH news_count, company_count, person_count, count(o) as organization_count
        MATCH (l:Location) WITH news_count, company_count, person_count, organization_count, count(l) as location_count
        MATCH (e:Event) WITH news_count, company_count, person_count, organization_count, location_count, count(e) as event_count
        MATCH (t:Time) WITH news_count, company_count, person_count, organization_count, location_count, event_count, count(t) as time_count
        MATCH ()-[r]->() WITH news_count, company_count, person_count, organization_count, location_count, event_count, time_count, count(r) as relationship_count
        RETURN 
          news_count + company_count + person_count + organization_count + location_count + event_count + time_count as totalNodes,
          relationship_count as relationships,
          news_count as news,
          company_count as companies,
          person_count as persons,
          organization_count as organizations,
          location_count as locations,
          event_count as events,
          time_count as times
      `;

      const result = await this.executeQuery(cypher);
      
      if (result.records.length === 0) {
        return {
          totalNodes: 0,
          relationships: 0,
          news: 0,
          companies: 0,
          persons: 0,
          organizations: 0,
          locations: 0,
          events: 0,
          times: 0
        };
      }

      const record = result.records[0];
      return {
        totalNodes: record.get('totalNodes').toNumber(),
        relationships: record.get('relationships').toNumber(),
        news: record.get('news').toNumber(),
        companies: record.get('companies').toNumber(),
        persons: record.get('persons').toNumber(),
        organizations: record.get('organizations').toNumber(),
        locations: record.get('locations').toNumber(),
        events: record.get('events').toNumber(),
        times: record.get('times').toNumber()
      };
    } catch (error: any) {
      console.error('获取简化统计信息失败:', error);
      return {
        totalNodes: 0,
        relationships: 0,
        news: 0,
        companies: 0,
        persons: 0,
        organizations: 0,
        locations: 0,
        events: 0,
        times: 0
      };
    }
  }

  /**
   * 获取关系类型统计
   */
  async getRelationshipStats(): Promise<any> {
    try {
      const cypher = `
        MATCH ()-[r]->()
        RETURN type(r) as relationshipType, count(r) as count
        ORDER BY count DESC
      `;

      const result = await this.executeQuery(cypher);
      
      const stats: Record<string, number> = {};
      result.records.forEach((record: any) => {
        stats[record.get('relationshipType')] = record.get('count').toNumber();
      });

      return stats;
    } catch (error: any) {
      console.error('获取关系类型统计失败:', error);
      return {};
    }
  }

  /**
   * 获取节点标签统计
   */
  async getNodeLabelStats(): Promise<any> {
    try {
      const cypher = `
        CALL db.labels() YIELD label
        CALL apoc.cypher.run('MATCH (n:' + label + ') RETURN count(n) as count', {}) YIELD value
        RETURN label, value.count as count
        ORDER BY count DESC
      `;

      const result = await this.executeQuery(cypher);
      
      const stats: Record<string, number> = {};
      result.records.forEach((record: any) => {
        stats[record.get('label')] = record.get('count').toNumber();
      });

      return stats;
    } catch (error: any) {
      // 如果不支持APOC，使用基础查询
      return await this.getBasicNodeStats();
    }
  }

  /**
   * 获取基础节点统计（不依赖APOC）
   */
  async getBasicNodeStats(): Promise<any> {
    try {
      const cypher = `
        CALL {
          MATCH (n:News) RETURN 'News' as label, count(n) as count
          UNION ALL
          MATCH (n:Company) RETURN 'Company' as label, count(n) as count
          UNION ALL
          MATCH (n:Person) RETURN 'Person' as label, count(n) as count
          UNION ALL
          MATCH (n:Organization) RETURN 'Organization' as label, count(n) as count
          UNION ALL
          MATCH (n:Location) RETURN 'Location' as label, count(n) as count
          UNION ALL
          MATCH (n:Event) RETURN 'Event' as label, count(n) as count
          UNION ALL
          MATCH (n:Time) RETURN 'Time' as label, count(n) as count
        }
        RETURN label, count
        ORDER BY count DESC
      `;

      const result = await this.executeQuery(cypher);
      
      const stats: Record<string, number> = {};
      result.records.forEach((record: any) => {
        stats[record.get('label')] = record.get('count').toNumber();
      });

      return stats;
    } catch (error: any) {
      console.error('获取基础节点统计失败:', error);
      return {};
    }
  }

  /**
   * 获取数据库详细信息
   */
  async getDatabaseInfo(): Promise<any> {
    try {
      const [stats, relationshipStats, nodeStats] = await Promise.all([
        this.getSimpleStats(),
        this.getRelationshipStats(),
        this.getBasicNodeStats()
      ]);

      return {
        overview: stats,
        nodeTypes: nodeStats,
        relationshipTypes: relationshipStats,
        connected: this.connected,
        timestamp: new Date().toISOString()
      };
    } catch (error: any) {
      console.error('获取数据库详细信息失败:', error);
      return {
        error: error.message,
        connected: this.connected,
        timestamp: new Date().toISOString()
      };
    }
  }
}

export const neo4jService = new Neo4jService(); 