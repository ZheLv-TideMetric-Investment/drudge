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
   * 获取连接状态
   */
  isConnected(): boolean {
    return this.connected;
  }

  /**
   * 获取数据库统计信息
   */
  async getDatabaseStats(): Promise<any> {
    try {
      const result = await this.executeQuery(`
        MATCH (n)
        RETURN 
          count(n) as totalNodes,
          count(labels(n)) as totalLabels
      `);
      
      return result.records[0] ? {
        totalNodes: result.records[0].get('totalNodes').toNumber(),
        totalLabels: result.records[0].get('totalLabels').toNumber(),
        connected: this.connected
      } : { totalNodes: 0, totalLabels: 0, connected: this.connected };
    } catch (error: any) {
      console.error('获取数据库统计信息失败:', error);
      return { error: error.message, connected: this.connected };
    }
  }
}

export const neo4jService = new Neo4jService(); 