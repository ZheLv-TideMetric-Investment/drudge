import neo4j from 'neo4j-driver';
import logger from '../dist/shared/utils/logger.js';
import moment from 'moment-timezone';

// 设置默认时区为北京时间
moment.tz.setDefault('Asia/Shanghai');

class Neo4jCleaner {
  constructor() {
    this.driver = null;
  }

  /**
   * 初始化Neo4j连接
   */
  async initialize() {
    try {
      const uri = process.env.NEO4J_URI || 'bolt://localhost:7687';
      const user = process.env.NEO4J_USERNAME || 'neo4j';
      const password = process.env.NEO4J_PASSWORD || 'password';

      this.driver = neo4j.driver(uri, neo4j.auth.basic(user, password));
      
      // 测试连接
      const session = this.driver.session();
      await session.run('RETURN 1');
      await session.close();
      
      console.log('✅ Neo4j连接成功');
    } catch (error) {
      console.error('❌ Neo4j连接失败:', error);
      throw error;
    }
  }

  /**
   * 清理所有数据
   */
  async cleanAllData() {
    const session = this.driver.session();
    try {
      console.log('🗑️  开始清理所有数据...');
      
      // 删除所有关系
      console.log('删除所有关系...');
      const deleteRelResult = await session.run('MATCH ()-[r]-() DELETE r');
      console.log(`✅ 删除了 ${deleteRelResult.summary.counters.updates().relationshipsDeleted} 个关系`);
      
      // 删除所有节点
      console.log('删除所有节点...');
      const deleteNodeResult = await session.run('MATCH (n) DELETE n');
      console.log(`✅ 删除了 ${deleteNodeResult.summary.counters.updates().nodesDeleted} 个节点`);
      
      console.log('🎉 所有数据清理完成');
    } catch (error) {
      console.error('❌ 清理所有数据失败:', error);
      throw error;
    } finally {
      await session.close();
    }
  }

  /**
   * 清理指定类型的节点
   */
  async cleanNodesByLabel(label) {
    const session = this.driver.session();
    try {
      console.log(`🗑️  开始清理 ${label} 节点...`);
      
      // 首先删除相关关系
      console.log(`删除 ${label} 节点的相关关系...`);
      const deleteRelResult = await session.run(
        `MATCH (n:${label})-[r]-() DELETE r`
      );
      console.log(`✅ 删除了 ${deleteRelResult.summary.counters.updates().relationshipsDeleted} 个关系`);
      
      // 删除节点
      console.log(`删除 ${label} 节点...`);
      const deleteNodeResult = await session.run(
        `MATCH (n:${label}) DELETE n`
      );
      console.log(`✅ 删除了 ${deleteNodeResult.summary.counters.updates().nodesDeleted} 个节点`);
      
    } catch (error) {
      console.error(`❌ 清理 ${label} 节点失败:`, error);
      throw error;
    } finally {
      await session.close();
    }
  }

  /**
   * 清理指定日期之前的数据
   */
  async cleanDataBeforeDate(beforeDate) {
    const session = this.driver.session();
    try {
      console.log(`🗑️  开始清理 ${beforeDate} 之前的数据...`);
      
      const targetDate = moment(beforeDate).format('YYYY-MM-DD');
      
      // 清理旧的新闻节点
      console.log('清理旧的新闻节点...');
      const deleteNewsResult = await session.run(`
        MATCH (n:News)
        WHERE n.timestamp < date('${targetDate}')
        DETACH DELETE n
      `);
      console.log(`✅ 删除了 ${deleteNewsResult.summary.counters.updates().nodesDeleted} 个新闻节点`);
      
      // 清理旧的事件节点
      console.log('清理旧的事件节点...');
      const deleteEventResult = await session.run(`
        MATCH (e:Event)
        WHERE e.event_date < date('${targetDate}')
        DETACH DELETE e
      `);
      console.log(`✅ 删除了 ${deleteEventResult.summary.counters.updates().nodesDeleted} 个事件节点`);
      
      // 清理孤立的时间节点
      console.log('清理孤立的时间节点...');
      const deleteTimeResult = await session.run(`
        MATCH (t:Time)
        WHERE t.date < date('${targetDate}')
        AND NOT (t)--()
        DELETE t
      `);
      console.log(`✅ 删除了 ${deleteTimeResult.summary.counters.updates().nodesDeleted} 个孤立时间节点`);
      
    } catch (error) {
      console.error(`❌ 清理 ${beforeDate} 之前的数据失败:`, error);
      throw error;
    } finally {
      await session.close();
    }
  }

  /**
   * 清理孤立节点（没有任何关系的节点）
   */
  async cleanOrphanedNodes() {
    const session = this.driver.session();
    try {
      console.log('🗑️  开始清理孤立节点...');
      
      const labels = ['Company', 'Person', 'Organization', 'Location', 'Time'];
      let totalDeleted = 0;
      
      for (const label of labels) {
        const result = await session.run(`
          MATCH (n:${label})
          WHERE NOT (n)--()
          DELETE n
        `);
        const deleted = result.summary.counters.updates().nodesDeleted;
        console.log(`✅ 删除了 ${deleted} 个孤立的 ${label} 节点`);
        totalDeleted += deleted;
      }
      
      console.log(`🎉 总共删除了 ${totalDeleted} 个孤立节点`);
    } catch (error) {
      console.error('❌ 清理孤立节点失败:', error);
      throw error;
    } finally {
      await session.close();
    }
  }

  /**
   * 获取数据库统计信息
   */
  async getDbStats() {
    const session = this.driver.session();
    try {
      console.log('📊 获取数据库统计信息...\n');
      
      // 节点统计
      const nodeStats = await session.run(`
        MATCH (n)
        RETURN labels(n) as labels, count(n) as count
        ORDER BY count DESC
      `);
      
      console.log('📈 节点统计:');
      nodeStats.records.forEach(record => {
        const labels = record.get('labels');
        const count = record.get('count').toNumber();
        console.log(`  ${labels.join(':')} : ${count}`);
      });
      
      // 关系统计
      const relStats = await session.run(`
        MATCH ()-[r]->()
        RETURN type(r) as type, count(r) as count
        ORDER BY count DESC
      `);
      
      console.log('\n🔗 关系统计:');
      relStats.records.forEach(record => {
        const type = record.get('type');
        const count = record.get('count').toNumber();
        console.log(`  ${type} : ${count}`);
      });
      
      // 总计
      const totalNodes = await session.run('MATCH (n) RETURN count(n) as total');
      const totalRels = await session.run('MATCH ()-[r]->() RETURN count(r) as total');
      
      console.log('\n📋 总计:');
      console.log(`  总节点数: ${totalNodes.records[0].get('total').toNumber()}`);
      console.log(`  总关系数: ${totalRels.records[0].get('total').toNumber()}`);
      
    } catch (error) {
      console.error('❌ 获取统计信息失败:', error);
      throw error;
    } finally {
      await session.close();
    }
  }

  /**
   * 重建索引
   */
  async rebuildIndexes() {
    const session = this.driver.session();
    try {
      console.log('🔧 重建索引...');
      
      const indexes = [
        'CREATE INDEX IF NOT EXISTS FOR (n:News) ON (n.id)',
        'CREATE INDEX IF NOT EXISTS FOR (n:News) ON (n.timestamp)',
        'CREATE INDEX IF NOT EXISTS FOR (e:Event) ON (e.id)',
        'CREATE INDEX IF NOT EXISTS FOR (e:Event) ON (e.event_date)',
        'CREATE INDEX IF NOT EXISTS FOR (c:Company) ON (c.name)',
        'CREATE INDEX IF NOT EXISTS FOR (p:Person) ON (p.name)',
        'CREATE INDEX IF NOT EXISTS FOR (o:Organization) ON (o.name)',
        'CREATE INDEX IF NOT EXISTS FOR (l:Location) ON (l.name)',
        'CREATE INDEX IF NOT EXISTS FOR (t:Time) ON (t.date)',
      ];
      
      for (const indexQuery of indexes) {
        await session.run(indexQuery);
      }
      
      console.log('✅ 索引重建完成');
    } catch (error) {
      console.error('❌ 重建索引失败:', error);
      throw error;
    } finally {
      await session.close();
    }
  }

  /**
   * 关闭连接
   */
  async close() {
    if (this.driver) {
      await this.driver.close();
      console.log('🔌 Neo4j连接已关闭');
    }
  }
}

// 主函数
async function main() {
  const command = process.argv[2];
  const param = process.argv[3];

  const cleaner = new Neo4jCleaner();
  
  try {
    await cleaner.initialize();
    
    console.log('='.repeat(60));
    console.log('🧹 Neo4j数据清理工具');
    console.log('='.repeat(60));
    
    switch (command) {
      case 'all':
        console.log('⚠️  警告: 这将删除所有数据!');
        console.log('如果确定要继续，请在5秒内按Ctrl+C取消...');
        await new Promise(resolve => setTimeout(resolve, 5000));
        await cleaner.cleanAllData();
        break;
        
      case 'label':
        if (!param) {
          console.error('❌ 请指定要删除的标签，如: npm run clean:neo4j label News');
          process.exit(1);
        }
        await cleaner.cleanNodesByLabel(param);
        break;
        
      case 'before':
        if (!param) {
          console.error('❌ 请指定日期，如: npm run clean:neo4j before 2024-01-01');
          process.exit(1);
        }
        await cleaner.cleanDataBeforeDate(param);
        break;
        
      case 'orphaned':
        await cleaner.cleanOrphanedNodes();
        break;
        
      case 'stats':
        await cleaner.getDbStats();
        break;
        
      case 'rebuild':
        await cleaner.rebuildIndexes();
        break;
        
      default:
        console.log('📖 使用说明:');
        console.log('');
        console.log('  npm run clean:neo4j stats              # 查看数据库统计');
        console.log('  npm run clean:neo4j orphaned           # 清理孤立节点');
        console.log('  npm run clean:neo4j label <标签>        # 删除指定标签的节点');
        console.log('  npm run clean:neo4j before <日期>       # 删除指定日期之前的数据');
        console.log('  npm run clean:neo4j rebuild            # 重建索引');
        console.log('  npm run clean:neo4j all                # ⚠️ 删除所有数据');
        console.log('');
        console.log('📝 示例:');
        console.log('  npm run clean:neo4j stats              # 查看当前数据统计');
        console.log('  npm run clean:neo4j orphaned           # 清理孤立节点');
        console.log('  npm run clean:neo4j label News         # 删除所有News节点');
        console.log('  npm run clean:neo4j before 2024-06-01  # 删除6月1日之前的数据');
        break;
    }
    
  } catch (error) {
    console.error('💥 执行失败:', error);
    process.exit(1);
  } finally {
    await cleaner.close();
  }
}

// 运行主函数
main().catch(error => {
  console.error('💥 系统错误:', error);
  process.exit(1);
}); 