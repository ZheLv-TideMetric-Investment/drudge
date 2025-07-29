import neo4j, { Driver, Session } from 'neo4j-driver';
import { config } from '../config';

/**
 * Neo4j 数据库连接服务
 * 负责管理数据库连接、会话和基础操作
 */
class Neo4jConnectionService {
  private driver: Driver | null = null;
  private connected: boolean = false;

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
      this.driver = null;
      this.connected = false;
      console.log('Neo4j 数据库连接已断开');
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
   * 检查连接状态
   */
  isConnected(): boolean {
    return this.connected;
  }

  /**
   * 获取驱动实例
   */
  getDriver(): Driver | null {
    return this.driver;
  }

  /**
   * 转换数字为Neo4j整数类型
   */
  convertNumbersToNeo4jInts(obj: any): any {
    if (obj === null || obj === undefined) {
      return obj;
    }
    
    if (typeof obj === 'number') {
      return neo4j.int(obj);
    }
    
    if (Array.isArray(obj)) {
      return obj.map(item => this.convertNumbersToNeo4jInts(item));
    }
    
    if (typeof obj === 'object') {
      const converted: any = {};
      for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
          converted[key] = this.convertNumbersToNeo4jInts(obj[key]);
        }
      }
      return converted;
    }
    
    return obj;
  }

  /**
   * 执行查询
   */
  async executeQuery(cypher: string, parameters: any = {}): Promise<any> {
    // 确保连接已建立
    if (!this.driver) {
      await this.connect();
    }
    
    // 转换参数中的数字为Neo4j整数类型
    const convertedParameters = this.convertNumbersToNeo4jInts(parameters);
    
    const session = this.getSession();
    try {
      const result = await session.run(cypher, convertedParameters);
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
}

export const neo4jConnection = new Neo4jConnectionService();
export { Neo4jConnectionService }; 