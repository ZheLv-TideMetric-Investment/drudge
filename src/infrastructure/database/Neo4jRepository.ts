// @ts-nocheck
import neo4j, { Driver, Session, Result, QueryResult } from 'neo4j-driver';
import config from '../../shared/config/config';
import logger from '../../shared/utils/logger';
import { HealthCheckResult, DatabaseStats, Neo4jQuery, Neo4jQueryParams } from '../../shared/types/common';

/**
 * Neo4j 数据库连接服务
 * 提供数据库连接管理和基础操作
 */
class Neo4jService {
  private driver: Driver | null = null;

  // 初始化数据库连接
  async connect(): Promise<boolean> {
    try {
      this.driver = neo4j.driver(
        config.neo4j.uri,
        neo4j.auth.basic(config.neo4j.username, config.neo4j.password),
        {
          connectionTimeout: 20000,
          maxConnectionLifetime: 3 * 60 * 60 * 1000, // 3 hours
          maxConnectionPoolSize: 50,
          connectionAcquisitionTimeout: 2 * 60 * 1000, // 2 minutes
        }
      );

      // 验证连接
      await this.driver.verifyConnectivity();
      logger.info('Neo4j 数据库连接成功');

      // 创建索引
      await this.createIndexes();
      return true;
    } catch (error) {
      logger.error('Neo4j 数据库连接失败:', error);
      throw error;
    }
  }

  // 创建数据库索引
  private async createIndexes(): Promise<void> {
    const session = this.getSession();
    try {
      // 为实体名称创建索引
      await session.run(
        'CREATE INDEX entity_name_index IF NOT EXISTS FOR (e:Entity) ON (e.name)'
      );

      // 为事件类型创建索引
      await session.run(
        'CREATE INDEX event_type_index IF NOT EXISTS FOR (e:Event) ON (e.type)'
      );

      // 为新闻ID创建索引
      await session.run('CREATE INDEX news_id_index IF NOT EXISTS FOR (n:News) ON (n.id)');

      // 为实体类型创建索引
      await session.run(
        'CREATE INDEX entity_type_index IF NOT EXISTS FOR (e:Entity) ON (e.type)'
      );

      // 为时间戳创建索引
      await session.run(
        'CREATE INDEX event_timestamp_index IF NOT EXISTS FOR (e:Event) ON (e.timestamp)'
      );

      logger.info('Neo4j 数据库索引创建完成');
    } catch (error) {
      logger.error('创建数据库索引失败:', error);
    } finally {
      await session.close();
    }
  }

  // 获取数据库会话
  getSession(): Session {
    if (!this.driver) {
      throw new Error('Neo4j 驱动未初始化，请先调用 connect()');
    }
    return this.driver.session({ database: config.neo4j.database });
  }

  // 执行 Cypher 查询
  async executeQuery(cypher: string, parameters: Neo4jQueryParams = {}): Promise<QueryResult> {
    const session = this.getSession();
    try {
      const result = await session.run(cypher, parameters);
      return result;
    } catch (error) {
      logger.error('执行 Cypher 查询失败:', error);
      logger.error('查询语句:', cypher);
      logger.error('参数:', parameters);
      throw error;
    } finally {
      await session.close();
    }
  }

  // 执行事务
  async executeTransaction<T>(transactionFunction: (tx: any) => Promise<T>): Promise<T> {
    const session = this.getSession();
    try {
      const result = await session.executeWrite(transactionFunction);
      return result;
    } catch (error) {
      logger.error('执行事务失败:', error);
      throw error;
    } finally {
      await session.close();
    }
  }

  // 批量执行查询
  async executeBatch(queries: Neo4jQuery[]): Promise<QueryResult[]> {
    const session = this.getSession();
    const tx = session.beginTransaction();

    try {
      const results: QueryResult[] = [];
      for (const { cypher, parameters } of queries) {
        const result = await tx.run(cypher, parameters);
        results.push(result);
      }
      await tx.commit();
      return results;
    } catch (error) {
      await tx.rollback();
      logger.error('批量执行查询失败:', error);
      throw error;
    } finally {
      await session.close();
    }
  }

  // 检查数据库健康状态
  async healthCheck(): Promise<HealthCheckResult> {
    try {
      const result = await this.executeQuery('RETURN 1 as health');
      const isHealthy = result.records.length > 0;
      return {
        status: isHealthy ? 'healthy' : 'unhealthy',
        timestamp: new Date().toISOString(),
        database: config.neo4j.database,
      };
    } catch (error: any) {
      logger.error('数据库健康检查失败:', error);
      return {
        status: 'unhealthy',
        error: error.message,
        timestamp: new Date().toISOString(),
        database: config.neo4j.database,
      };
    }
  }

  // 获取数据库统计信息
  async getStats(): Promise<DatabaseStats> {
    try {
      const result = await this.executeQuery(`
        CALL apoc.meta.stats() YIELD labelCount, relTypeCount, propertyKeyCount, nodeCount, relCount
        RETURN labelCount, relTypeCount, propertyKeyCount, nodeCount, relCount
      `);

      if (result.records.length > 0) {
        const record = result.records[0];
        return {
          nodeCount: record.get('nodeCount').toNumber(),
          relationshipCount: record.get('relCount').toNumber(),
          labelCount: record.get('labelCount').toNumber(),
          relationshipTypeCount: record.get('relTypeCount').toNumber(),
          propertyKeyCount: record.get('propertyKeyCount').toNumber(),
          timestamp: new Date().toISOString(),
        };
      }

      // 如果没有 APOC，使用基础查询
      const nodeResult = await this.executeQuery('MATCH (n) RETURN count(n) as nodeCount');
      const relResult = await this.executeQuery('MATCH ()-[r]->() RETURN count(r) as relCount');

      return {
        nodeCount: nodeResult.records[0].get('nodeCount').toNumber(),
        relationshipCount: relResult.records[0].get('relCount').toNumber(),
        timestamp: new Date().toISOString(),
      };
    } catch (error: any) {
      logger.error('获取数据库统计信息失败:', error);
      return {
        nodeCount: 0,
        relationshipCount: 0,
        error: error.message,
        timestamp: new Date().toISOString(),
      };
    }
  }

  // 清空数据库（谨慎使用）
  async clearDatabase(): Promise<boolean> {
    try {
      await this.executeQuery('MATCH (n) DETACH DELETE n');
      logger.info('数据库已清空');
      return true;
    } catch (error) {
      logger.error('清空数据库失败:', error);
      throw error;
    }
  }

  // 关闭数据库连接
  async close(): Promise<void> {
    try {
      if (this.driver) {
        await this.driver.close();
        this.driver = null;
        logger.info('Neo4j 数据库连接已关闭');
      }
    } catch (error) {
      logger.error('关闭数据库连接失败:', error);
    }
  }

  // 检查连接状态
  isConnected(): boolean {
    return this.driver !== null;
  }
}

export default new Neo4jService(); 