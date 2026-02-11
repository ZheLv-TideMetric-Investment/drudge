import { logger } from '../utils/logger';
import knowledgeGraphService from '../services/KnowledgeGraphService';
import config from '../config/config';
import { getCurrentTime } from '../utils/timeUtils';
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import scheduler from '../scheduler/index';
import failedNewsProcessor from '../services/FailedNewsProcessor';

const execAsync = promisify(exec);

/**
 * 处理未处理的新闻
 */
async function processNews(limit: number = 100): Promise<void> {
  try {
    logger.info(`🔄 开始处理未处理的新闻，限制: ${limit} 条`);

    // 这里应该从ingest-worker获取新闻数据
    // 当前返回提示信息
    console.log('📝 此功能需要从ingest-worker获取新闻数据');
    console.log('💡 请使用HTTP API /api/news/batch 来批量处理新闻');
  } catch (error) {
    logger.error('处理新闻失败:', error);
    process.exit(1);
  }
}

/**
 * 批量处理新闻
 */
async function processBatch(count: number = 50): Promise<void> {
  try {
    logger.info(`🔄 开始批量处理新闻: ${count} 条`);

    console.log('📝 此功能需要从外部提供新闻数据');
    console.log('💡 请使用HTTP API /api/news/batch 来批量处理新闻');
  } catch (error) {
    logger.error('批量处理失败:', error);
    process.exit(1);
  }
}

/**
 * 处理最近N小时的新闻
 */
async function processRecent(hours: number = 24): Promise<void> {
  try {
    logger.info(`🔄 开始处理最近 ${hours} 小时的新闻`);

    console.log('📝 此功能需要从ingest-worker获取新闻数据');
    console.log('💡 请使用HTTP API /api/news/batch 来批量处理新闻');
  } catch (error) {
    logger.error('处理最近新闻失败:', error);
    process.exit(1);
  }
}

/**
 * 重新处理指定新闻
 */
async function reprocessNews(newsId: string): Promise<void> {
  try {
    logger.info(`🔄 重新处理新闻: ${newsId}`);

    console.log('📝 此功能需要从ingest-worker获取指定新闻数据');
    console.log('💡 请使用HTTP API /api/news/process 来处理单条新闻');
  } catch (error) {
    logger.error('重新处理新闻失败:', error);
    process.exit(1);
  }
}

/**
 * 批量重新处理失败的新闻
 */
async function retryFailedNews(limit?: number): Promise<void> {
  try {
    logger.info(`🔄 开始批量重新处理失败的新闻${limit ? `，限制: ${limit} 条` : ''}`);

    const stats = await failedNewsProcessor.retryFailedNews(limit);

    console.log('\n📊 重新处理结果:');
    console.log('='.repeat(50));
    console.log(`✅ 总计: ${stats.total} 条`);
    console.log(`🎉 成功: ${stats.successful} 条`);
    console.log(`❌ 失败: ${stats.failed} 条`);

    if (stats.results.length > 0) {
      console.log('\n📋 详细结果:');
      stats.results.forEach((result, index) => {
        const status = result.success ? '✅' : '❌';
        const error = result.error ? ` (${result.error})` : '';
        console.log(`${index + 1}. ${status} ${result.newsId} - ${result.fileName}${error}`);
      });
    }
  } catch (error) {
    logger.error('批量重新处理失败新闻失败:', error);
    process.exit(1);
  }
}

/**
 * 根据ID重新处理失败的新闻
 */
async function retryFailedNewsByIds(newsIds: string[]): Promise<void> {
  try {
    logger.info(`🔄 根据ID重新处理失败的新闻: ${newsIds.join(', ')}`);

    const stats = await failedNewsProcessor.retryFailedNewsByIds(newsIds);

    console.log('\n📊 重新处理结果:');
    console.log('='.repeat(50));
    console.log(`✅ 总计: ${stats.total} 条`);
    console.log(`🎉 成功: ${stats.successful} 条`);
    console.log(`❌ 失败: ${stats.failed} 条`);

    if (stats.results.length > 0) {
      console.log('\n📋 详细结果:');
      stats.results.forEach((result, index) => {
        const status = result.success ? '✅' : '❌';
        const error = result.error ? ` (${result.error})` : '';
        console.log(`${index + 1}. ${status} ${result.newsId} - ${result.fileName}${error}`);
      });
    }
  } catch (error) {
    logger.error('根据ID重新处理失败新闻失败:', error);
    process.exit(1);
  }
}

/**
 * 列出失败的新闻
 */
async function listFailedNews(limit: number = 20): Promise<void> {
  try {
    logger.info(`📋 列出失败的新闻，限制: ${limit} 条`);

    const failedNewsList = await failedNewsProcessor.listFailedNews(limit);

    if (failedNewsList.length === 0) {
      console.log('✅ 没有找到失败的新闻文件');
      return;
    }

    console.log(`\n📋 失败新闻列表 (共 ${failedNewsList.length} 条):`);
    console.log('='.repeat(80));

    failedNewsList.forEach((failedNews, index) => {
      console.log(`${index + 1}. 📰 ${failedNews.newsItem.id} - ${failedNews.metadata.title}`);
      console.log(`   📅 失败时间: ${failedNews.metadata.failedAt}`);
      console.log(`   📡 来源: ${failedNews.metadata.source}`);
      console.log(`   ❌ 错误: ${failedNews.error.message}`);
      console.log(`   🔧 服务: ${failedNews.error.service}`);
      console.log('-'.repeat(80));
    });
  } catch (error) {
    logger.error('列出失败新闻失败:', error);
    process.exit(1);
  }
}

/**
 * 清理旧的失败文件
 */
async function cleanFailedFiles(daysOld: number = 30): Promise<void> {
  try {
    logger.info(`🧹 清理超过 ${daysOld} 天的失败文件`);

    const deletedCount = await failedNewsProcessor.cleanOldFailedFiles(daysOld);

    console.log('\n🧹 清理结果:');
    console.log('='.repeat(50));
    console.log(`🗑️ 删除文件数: ${deletedCount} 个`);
    console.log(`📅 清理标准: 超过 ${daysOld} 天的文件`);
  } catch (error) {
    logger.error('清理失败文件失败:', error);
    process.exit(1);
  }
}

/**
 * 查询知识图谱
 */
async function queryGraph(keyword: string, limit: number = 10): Promise<void> {
  try {
    logger.info(`🔍 查询知识图谱: ${keyword}, 限制: ${limit} 条`);

    await knowledgeGraphService.initialize();
    const entities = await knowledgeGraphService.searchEntities(keyword, limit);

    console.log('\n📊 查询结果:');
    console.log('='.repeat(50));

    if (entities.length === 0) {
      console.log('❌ 未找到相关实体');
      return;
    }

    entities.forEach((entity, index) => {
      console.log(
        `${index + 1}. [${entity.labels.join(', ')}] ${JSON.stringify(entity.properties, null, 2)}`
      );
    });

    console.log(`\n✅ 共找到 ${entities.length} 个相关实体`);
  } catch (error) {
    logger.error('查询失败:', error);
    process.exit(1);
  }
}

/**
 * 显示图谱统计信息
 */
async function showStats(): Promise<void> {
  try {
    logger.info('📊 获取图谱统计信息...');

    await knowledgeGraphService.initialize();
    const stats = await knowledgeGraphService.getGraphStats();

    console.log('\n📊 知识图谱统计信息:');
    console.log('='.repeat(50));
    console.log(`⏰ 时间戳: ${stats.timestamp}`);
    console.log(`📦 版本: ${stats.version}`);
    console.log(`🔧 初始化状态: ${stats.initialized ? '✅' : '❌'}`);

    console.log('\n🛠️ 服务状态:');
    Object.entries(stats.services || {}).forEach(([service, status]) => {
      console.log(`  ${service}: ${status}`);
    });

    if (stats.database) {
      console.log('\n💾 数据库状态:');
      console.log(`  状态: ${stats.database.status}`);
      console.log(`  服务: ${stats.database.service}`);
      console.log(`  Neo4j连接: ${stats.database.neo4j_connection || 'unknown'}`);

      // 显示节点统计
      if (stats.database.nodes) {
        console.log('\n📈 节点统计:');
        if (stats.database.nodes.byLabel && stats.database.nodes.byLabel.length > 0) {
          stats.database.nodes.byLabel.forEach((item: any) => {
            console.log(`  ${item.labels.join(':')} : ${item.count} 个`);
          });
        } else {
          console.log('  (暂无数据)');
        }
        console.log(`  总节点数: ${stats.database.nodes.total} 个`);
      }

      // 显示关系统计
      if (stats.database.relationships) {
        console.log('\n🔗 关系统计:');
        if (stats.database.relationships.byType && stats.database.relationships.byType.length > 0) {
          stats.database.relationships.byType.forEach((item: any) => {
            console.log(`  ${item.type} : ${item.count} 个`);
          });
        } else {
          console.log('  (暂无数据)');
        }
        console.log(`  总关系数: ${stats.database.relationships.total} 个`);
      }
    }

    if (!stats.success) {
      console.log(`\n❌ 错误信息: ${stats.error}`);
    }
  } catch (error) {
    logger.error('获取统计信息失败:', error);
    process.exit(1);
  }
}

/**
 * 导出图谱数据
 */
async function exportData(format: string = 'json'): Promise<void> {
  try {
    logger.info(`📤 导出图谱数据，格式: ${format}`);

    console.log('📝 导出功能开发中...');
    console.log('💡 当前支持通过HTTP API查询数据:');
    console.log('  - GET /api/stats - 获取统计信息');
    console.log('  - GET /api/entities/search?q=keyword - 搜索实体');
    console.log('  - GET /api/entities/:name/relations - 获取关系图');
  } catch (error) {
    logger.error('导出失败:', error);
    process.exit(1);
  }
}

/**
 * 重建知识图谱
 */
async function rebuildGraph(): Promise<void> {
  try {
    logger.info('🔄 重建知识图谱...');

    console.log('⚠️ 重建功能需要谨慎操作');
    console.log('📝 此功能会清空现有图谱数据并重新处理所有新闻');
    console.log('💡 建议先备份数据，然后通过HTTP API批量重新处理新闻');
  } catch (error) {
    logger.error('重建失败:', error);
    process.exit(1);
  }
}

/**
 * 检查服务状态
 */
async function checkStatus(): Promise<void> {
  try {
    logger.info('🔧 检查服务状态...');

    await knowledgeGraphService.initialize();
    const health = await knowledgeGraphService['entityService']['neo4j'].healthCheck();

    console.log('\n🔧 服务状态检查:');
    console.log('='.repeat(50));
    console.log(`🏥 状态: ${health ? '✅ 健康' : '❌ 异常'}`);
    console.log(`🔧 初始化: ${knowledgeGraphService['initialized'] ? '✅' : '❌'}`);
    console.log(`⏰ 时间: ${getCurrentTime()}`);
    console.log(`📋 版本: 2.0`);

    if (!health) {
      console.log('\n❌ 数据库连接异常');
    }
  } catch (error) {
    logger.error('状态检查失败:', error);
    process.exit(1);
  }
}

/**
 * 数据库统计信息
 */
async function dbStats(): Promise<void> {
  try {
    logger.info('📊 获取数据库统计信息...');

    await knowledgeGraphService.initialize();
    const stats = await knowledgeGraphService['entityService']['neo4j'].getDbStats();

    console.log('\n📊 Neo4j数据库统计信息:');
    console.log('='.repeat(50));

    console.log('\n📈 节点统计:');
    if (stats.nodes && stats.nodes.byLabel) {
      stats.nodes.byLabel.forEach((item: any) => {
        console.log(`  ${item.labels.join(':')} : ${item.count}`);
      });
      console.log(`  总节点数: ${stats.nodes.total}`);
    }

    console.log('\n🔗 关系统计:');
    if (stats.relationships && stats.relationships.byType) {
      stats.relationships.byType.forEach((item: any) => {
        console.log(`  ${item.type} : ${item.count}`);
      });
      console.log(`  总关系数: ${stats.relationships.total}`);
    }
  } catch (error) {
    logger.error('获取数据库统计信息失败:', error);
    process.exit(1);
  }
}

/**
 * 清理数据库
 */
async function dbClean(): Promise<void> {
  try {
    logger.info('🗑️ 清理数据库...');

    await knowledgeGraphService.initialize();
    await knowledgeGraphService['entityService']['neo4j'].clearDatabase();

    console.log('✅ 数据库清理完成');
  } catch (error) {
    logger.error('清理数据库失败:', error);
    process.exit(1);
  }
}

/**
 * 重建索引
 */
async function dbRebuildIndexes(): Promise<void> {
  try {
    logger.info('🔧 重建数据库索引...');

    await knowledgeGraphService.initialize();

    const session = knowledgeGraphService['entityService']['neo4j'].getSession();
    try {
      const indexes = [
        'CREATE INDEX IF NOT EXISTS FOR (n:News) ON (n.id)',
        'CREATE INDEX IF NOT EXISTS FOR (n:News) ON (n.timestamp)',
        'CREATE INDEX IF NOT EXISTS FOR (e:Event) ON (e.id)',
        'CREATE INDEX IF NOT EXISTS FOR (e:Event) ON (e.timestamp)',
        'CREATE INDEX IF NOT EXISTS FOR (c:Company) ON (c.company_name)',
        'CREATE INDEX IF NOT EXISTS FOR (p:Person) ON (p.person_name)',
        'CREATE INDEX IF NOT EXISTS FOR (o:Organization) ON (o.organization_name)',
        'CREATE INDEX IF NOT EXISTS FOR (l:Location) ON (l.location_name)',
        'CREATE INDEX IF NOT EXISTS FOR (t:Time) ON (t.date)',
      ];

      for (const indexQuery of indexes) {
        try {
          await session.run(indexQuery);
        } catch (error: any) {
          logger.warn(`索引创建可能已存在: ${error.message}`);
        }
      }

      console.log('✅ 索引重建完成');
    } finally {
      await session.close();
    }
  } catch (error) {
    logger.error('重建索引失败:', error);
    process.exit(1);
  }
}

/**
 * 数据库健康检查
 */
async function dbHealthCheck(): Promise<void> {
  try {
    logger.info('🏥 数据库健康检查...');

    await knowledgeGraphService.initialize();

    // 通过知识图谱服务的entityService访问Neo4j
    const session = knowledgeGraphService['entityService']['neo4j'].getSession();
    try {
      await session.run('RETURN 1');
      console.log('✅ Neo4j数据库连接正常');

      // 检查基本表结构
      const result = await session.run('CALL db.labels()');
      const labels = result.records.map((record: any) => record.get('label'));

      console.log('\n📋 已存在的节点标签:');
      if (labels.length > 0) {
        labels.forEach((label: string) => console.log(`  - ${label}`));
      } else {
        console.log('  (暂无数据)');
      }
    } finally {
      await session.close();
    }
  } catch (error) {
    logger.error('数据库健康检查失败:', error);
    console.log('❌ Neo4j数据库连接异常');
    process.exit(1);
  }
}

/**
 * 导出数据库配置
 */
async function dbExportConfig(): Promise<void> {
  try {
    logger.info('📋 导出数据库配置...');

    const dbConfig = {
      neo4j: config.neo4j,
      timestamp: getCurrentTime(),
      environment: config.nodeEnv || 'development',
    };

    // 创建备份目录
    const backupDir = path.join(process.cwd(), 'backup');
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    // 生成配置文件
    const configFile = path.join(backupDir, `db-config-${getCurrentTime().split('T')[0]}.json`);
    fs.writeFileSync(configFile, JSON.stringify(dbConfig, null, 2));

    console.log(`✅ 数据库配置已导出到: ${configFile}`);
  } catch (error) {
    logger.error('导出数据库配置失败:', error);
    process.exit(1);
  }
}

/**
 * 数据库安装和设置
 */
async function setupDb(): Promise<void> {
  try {
    logger.info('🛠️ 开始安装Neo4j数据库...');

    const scriptPath = path.join(process.cwd(), 'scripts/db/install_neo4j.sh');

    if (!fs.existsSync(scriptPath)) {
      console.error('❌ 安装脚本不存在:', scriptPath);
      process.exit(1);
    }

    console.log('🚀 正在执行Neo4j安装脚本...');
    console.log('这可能需要几分钟时间，请耐心等待...\n');

    const { stdout, stderr } = await execAsync(`bash ${scriptPath}`);

    if (stdout) {
      console.log(stdout);
    }

    if (stderr) {
      console.error('安装过程中的警告信息:', stderr);
    }

    console.log('\n✅ Neo4j数据库安装完成');
    console.log('请检查上述输出以确认安装状态');
  } catch (error: any) {
    logger.error('Neo4j数据库安装失败:', error);
    console.error('\n❌ 安装失败:', error.message);
    process.exit(1);
  }
}

/**
 * 清理指定标签的节点
 */
async function dbCleanByLabel(label: string): Promise<void> {
  try {
    logger.info(`🗑️ 开始清理 ${label} 节点...`);

    await knowledgeGraphService.initialize();

    const session = knowledgeGraphService['entityService']['neo4j'].getSession();
    try {
      // 首先删除相关关系
      console.log(`删除 ${label} 节点的相关关系...`);
      const deleteRelResult = await session.run(`MATCH (n:${label})-[r]-() DELETE r`);
      console.log(
        `✅ 删除了 ${deleteRelResult.summary.counters.updates().relationshipsDeleted} 个关系`
      );

      // 删除节点
      console.log(`删除 ${label} 节点...`);
      const deleteNodeResult = await session.run(`MATCH (n:${label}) DELETE n`);
      console.log(`✅ 删除了 ${deleteNodeResult.summary.counters.updates().nodesDeleted} 个节点`);
    } finally {
      await session.close();
    }
  } catch (error) {
    logger.error(`清理 ${label} 节点失败:`, error);
    process.exit(1);
  }
}

/**
 * 清理指定日期之前的数据
 */
async function dbCleanBeforeDate(beforeDate: string): Promise<void> {
  try {
    logger.info(`🗑️ 开始清理 ${beforeDate} 之前的数据...`);

    await knowledgeGraphService.initialize();

    const session = knowledgeGraphService['entityService']['neo4j'].getSession();
    try {
      // 清理旧的新闻节点
      console.log('清理旧的新闻节点...');
      const deleteNewsResult = await session.run(`
        MATCH (n:News)
        WHERE n.timestamp < date('${beforeDate}')
        DETACH DELETE n
      `);
      console.log(
        `✅ 删除了 ${deleteNewsResult.summary.counters.updates().nodesDeleted} 个新闻节点`
      );

      // 清理旧的事件节点
      console.log('清理旧的事件节点...');
      const deleteEventResult = await session.run(`
        MATCH (e:Event)
        WHERE e.timestamp < '${beforeDate}T00:00:00.000Z'
        DETACH DELETE e
      `);
      console.log(
        `✅ 删除了 ${deleteEventResult.summary.counters.updates().nodesDeleted} 个事件节点`
      );

      // 清理孤立的时间节点
      console.log('清理孤立的时间节点...');
      const deleteTimeResult = await session.run(`
        MATCH (t:Time)
        WHERE t.date < date('${beforeDate}')
        AND NOT (t)--()
        DELETE t
      `);
      console.log(
        `✅ 删除了 ${deleteTimeResult.summary.counters.updates().nodesDeleted} 个孤立时间节点`
      );
    } finally {
      await session.close();
    }
  } catch (error) {
    logger.error(`清理 ${beforeDate} 之前的数据失败:`, error);
    process.exit(1);
  }
}

/**
 * 清理孤立节点
 */
async function dbCleanOrphaned(): Promise<void> {
  try {
    logger.info('🗑️ 开始清理孤立节点...');

    await knowledgeGraphService.initialize();

    const session = knowledgeGraphService['entityService']['neo4j'].getSession();
    try {
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
    } finally {
      await session.close();
    }
  } catch (error) {
    logger.error('清理孤立节点失败:', error);
    process.exit(1);
  }
}

/**
 * 清理重复数据
 */
async function dbCleanDuplicates(): Promise<void> {
  try {
    logger.info('🔧 开始清理重复数据...');

    await knowledgeGraphService.initialize();

    const session = knowledgeGraphService['entityService']['neo4j'].getSession();
    try {
      // 清理重复的公司节点
      console.log('清理重复的公司节点...');
      await session.run(`
        MATCH (c1:Company), (c2:Company)
        WHERE c1.company_name = c2.company_name AND id(c1) > id(c2)
        DETACH DELETE c1
      `);

      // 清理重复的人物节点
      console.log('清理重复的人物节点...');
      await session.run(`
        MATCH (p1:Person), (p2:Person)
        WHERE p1.person_name = p2.person_name AND id(p1) > id(p2)
        DETACH DELETE p1
      `);

      // 清理重复的机构节点
      console.log('清理重复的机构节点...');
      await session.run(`
        MATCH (o1:Organization), (o2:Organization)
        WHERE o1.organization_name = o2.organization_name AND id(o1) > id(o2)
        DETACH DELETE o1
      `);

      // 清理重复的地点节点
      console.log('清理重复的地点节点...');
      await session.run(`
        MATCH (l1:Location), (l2:Location)
        WHERE l1.location_name = l2.location_name AND id(l1) > id(l2)
        DETACH DELETE l1
      `);

      console.log('✅ 重复数据清理完成');
    } finally {
      await session.close();
    }
  } catch (error) {
    logger.error('清理重复数据失败:', error);
    process.exit(1);
  }
}

/**
 * 数据库备份统计信息
 */
async function dbBackup(): Promise<void> {
  try {
    logger.info('💾 备份数据库统计信息...');

    await knowledgeGraphService.initialize();
    const stats = await knowledgeGraphService['entityService']['neo4j'].getDbStats();

    // 创建备份目录
    const backupDir = path.join(process.cwd(), 'backup');
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    // 生成备份文件
    const timestamp = getCurrentTime().replace(/[:.]/g, '-').split('T');
    const datePart = timestamp[0] || 'unknown';
    const timePart = timestamp[1]?.split('.')[0] || '000000';
    const backupFile = path.join(backupDir, `db-stats-${datePart}_${timePart}.json`);

    const backupData = {
      timestamp: getCurrentTime(),
      environment: config.nodeEnv || 'development',
      config: {
        neo4j: {
          uri: config.neo4j.uri,
          user: config.neo4j.user,
          database: config.neo4j.database,
        },
      },
      statistics: stats,
    };

    fs.writeFileSync(backupFile, JSON.stringify(backupData, null, 2));

    console.log(`✅ 数据库统计信息已备份到: ${backupFile}`);

    // 也输出到控制台
    console.log('\n📊 当前数据库统计:');
    console.log('='.repeat(50));

    if (stats.nodes && stats.nodes.byLabel) {
      console.log('\n📈 节点统计:');
      stats.nodes.byLabel.forEach((item: any) => {
        console.log(`  ${item.labels.join(':')} : ${item.count}`);
      });
      console.log(`  总节点数: ${stats.nodes.total}`);
    }

    if (stats.relationships && stats.relationships.byType) {
      console.log('\n🔗 关系统计:');
      stats.relationships.byType.forEach((item: any) => {
        console.log(`  ${item.type} : ${item.count}`);
      });
      console.log(`  总关系数: ${stats.relationships.total}`);
    }
  } catch (error) {
    logger.error('备份数据库统计信息失败:', error);
    process.exit(1);
  }
}

/**
 * 手动触发文件扫描
 */
async function triggerFileScan(): Promise<void> {
  try {
    logger.info('🔍 手动触发文件扫描...');

    const result = await scheduler.triggerManualScan();

    console.log('\n📄 文件扫描结果:');
    console.log('='.repeat(50));
    console.log(`✅ 扫描状态: ${result.success ? '成功' : '失败'}`);

    if (result.success) {
      console.log(`📊 处理结果: ${result.message}`);
      if (result.processed > 0) {
        console.log(`📈 成功处理: ${result.processed} 个文件`);
        if (result.failed > 0) {
          console.log(`❌ 失败: ${result.failed} 个文件`);
        }
        console.log(`📦 总计: ${result.total} 个文件`);
      }
    } else {
      console.log(`❌ 错误: ${result.error}`);
    }
  } catch (error) {
    logger.error('手动触发文件扫描失败:', error);
    process.exit(1);
  }
}

/**
 * 查看文件处理状态
 */
async function showFileStats(): Promise<void> {
  try {
    logger.info('📊 获取文件处理状态...');

    const { getFileProcessingStats } = await import('../services/FileScanner');
    const { getProcessorStats } = await import('../services/NewsProcessor');

    const fileStats = await getFileProcessingStats();
    const processorStats = await getProcessorStats();

    console.log('\n📂 文件处理统计:');
    console.log('='.repeat(50));
    console.log(`📁 新闻目录: ${config.dataSource.newsDirectory}`);
    console.log(`📄 总文件数: ${fileStats.totalFiles}`);
    console.log(`✅ 已处理: ${fileStats.processedFiles}`);
    console.log(`⏳ 未处理: ${fileStats.unprocessedFiles}`);
    console.log(`⏰ 扫描时间: ${fileStats.lastScanTime}`);

    console.log('\n🔧 处理器配置:');
    console.log(`📦 批次大小: ${processorStats.config.batchSize}`);
    console.log(`🔄 重试次数: ${processorStats.config.retryAttempts}`);
    console.log(`⏱️ 重试延迟: ${processorStats.config.retryDelay}ms`);

    console.log('\n✨ 支持的文件格式:');
    processorStats.supportedFormats.forEach((format: string) => {
      console.log(`  - ${format}`);
    });
  } catch (error) {
    logger.error('获取文件状态失败:', error);
    process.exit(1);
  }
}

/**
 * 查看调度器状态
 */
async function showSchedulerStatus(): Promise<void> {
  try {
    logger.info('📅 获取调度器状态...');

    const healthCheck = await scheduler.healthCheck();
    const serviceInfo = scheduler.getServiceInfo();

    console.log('\n📅 调度器状态:');
    console.log('='.repeat(50));
    console.log(`🏥 状态: ${healthCheck.status === 'healthy' ? '✅ 健康' : '❌ 异常'}`);
    console.log(`🔧 初始化: ${healthCheck.initialized ? '✅' : '❌'}`);
    console.log(`📋 活跃任务: ${healthCheck.activeTasks}`);
    console.log(`⏰ 时间: ${healthCheck.timestamp}`);

    console.log('\n🛠️ 服务信息:');
    console.log(`📦 版本: ${serviceInfo.version}`);
    console.log(`📝 描述: ${serviceInfo.description}`);
    console.log(`🎯 主要任务: ${serviceInfo.mainTask}`);

    if (healthCheck.error) {
      console.log(`\n❌ 错误: ${healthCheck.error}`);
    }
  } catch (error) {
    logger.error('获取调度器状态失败:', error);
    process.exit(1);
  }
}

/**
 * 创建数据库索引
 */
async function createIndexes(): Promise<void> {
  try {
    logger.info('🔍 开始创建数据库索引...');

    await knowledgeGraphService.initialize();
    await knowledgeGraphService['entityService']['neo4j'].createIndexes();

    console.log('✅ 数据库索引创建完成');
  } catch (error) {
    logger.error('创建数据库索引失败:', error);
    process.exit(1);
  }
}

/**
 * 显示帮助信息
 */
function showHelp(): void {
  console.log('\n🧠 知识图谱工具 - Graph Worker\n');
  console.log('用法:');
  console.log('  npm run cli <command> [options]\n');

  console.log('📊 核心功能:');
  console.log('  process [限制数]           处理未处理的新闻 (默认100条)');
  console.log('  process-batch [数量]       批量处理新闻 (默认50条)');
  console.log('  process-recent [小时]      处理最近N小时的新闻 (默认24小时)');
  console.log('  reprocess <新闻ID>         重新处理指定新闻');
  console.log('  query <关键词> [限制数]    查询知识图谱 (默认10条结果)');
  console.log('  stats                      显示图谱统计信息');
  console.log('  export [格式]              导出图谱数据 (默认json格式)');
  console.log('  rebuild                    重建整个知识图谱');
  console.log('  status                     检查服务状态');
  console.log('  help                       显示帮助信息\n');

  console.log('📁 文件处理:');
  console.log('  scan                       手动触发文件扫描');
  console.log('  file-stats                 查看文件处理统计');
  console.log('  scheduler-status           查看调度器状态\n');

  console.log('🔄 失败新闻处理:');
  console.log('  retry-failed [限制数]      批量重新处理失败的新闻 (默认全部)');
  console.log('  retry-failed-by-id <ID...> 根据ID重新处理失败的新闻');
  console.log('  list-failed [限制数]       列出失败的新闻 (默认20条)');
  console.log('  clean-failed [天数]        清理旧的失败文件 (默认30天)\n');

  console.log('📝 示例:');
  console.log('  npm run cli scan                    # 手动扫描新闻文件');
  console.log('  npm run cli file-stats              # 查看文件处理状态');
  console.log('  npm run cli scheduler-status        # 查看调度器状态');
  console.log('  npm run cli process 50              # 处理50条未处理新闻');
  console.log('  npm run cli query "小米" 5          # 查询"小米"相关新闻，限制5条');
  console.log('  npm run cli stats                   # 显示统计信息');
  console.log('  npm run cli status                  # 检查状态');
  console.log('  npm run cli retry-failed 10         # 重新处理10条失败新闻');
  console.log('  npm run cli retry-failed-by-id 123  # 重新处理ID为123的失败新闻');
  console.log('  npm run cli list-failed 5           # 列出最近5条失败新闻');
  console.log('  npm run cli clean-failed 7          # 清理7天前的失败文件\n');

  console.log('🌐 HTTP API:');
  console.log('  curl http://localhost:39111/health                    # 健康检查');
  console.log('  curl http://localhost:39111/api/stats                 # 获取统计信息');
  console.log('  curl http://localhost:39111/api/entities/search?q=小米 # 搜索实体');
  console.log('  curl -X POST http://localhost:39111/api/news/process   # 处理单条新闻');
  console.log('  curl -X POST http://localhost:39111/api/news/batch     # 批量处理新闻\n');

  showDbHelp();
}

/**
 * 显示数据库帮助信息
 */
function showDbHelp(): void {
  console.log('\n🗄️ 数据库管理命令:');
  console.log('');
  console.log('  npm run cli setup-db              # 🛠️ 安装Neo4j数据库');
  console.log('  npm run cli db-stats              # 📊 查看数据库统计信息');
  console.log('  npm run cli db-health             # 🏥 数据库健康检查');
  console.log('  npm run cli db-backup             # 💾 备份数据库统计信息');
  console.log('  npm run cli db-rebuild            # 🔧 重建数据库索引');
  console.log('  npm run cli db-export-config      # 📋 导出数据库配置');
  console.log('  npm run cli create-indexes      # 🔍 创建数据库索引');
  console.log('');
  console.log('🗑️ 数据清理命令:');
  console.log('  npm run cli db-clean              # ⚠️ 清理所有数据');
  console.log('  npm run cli db-clean-label <标签>  # 清理指定标签的节点');
  console.log('  npm run cli db-clean-before <日期> # 清理指定日期前的数据');
  console.log('  npm run cli db-clean-orphaned     # 清理孤立节点');
  console.log('  npm run cli db-clean-duplicates   # 清理重复数据');
  console.log('');
  console.log('📝 示例:');
  console.log('  npm run cli setup-db              # 安装Neo4j数据库');
  console.log('  npm run cli db-stats              # 查看当前数据统计');
  console.log('  npm run cli db-clean-label News   # 删除所有News节点');
  console.log('  npm run cli db-clean-before 2024-06-01 # 删除6月1日前数据');
  console.log('  npm run cli db-clean-orphaned     # 清理孤立节点');
  console.log('  npm run cli db-clean-duplicates   # 清理重复实体节点');
  console.log('  npm run cli db-backup             # 备份当前数据统计');
  console.log('  npm run cli create-indexes      # 创建数据库索引');
}

/**
 * CLI入口函数
 */
export async function runCLI(): Promise<void> {
  const args = process.argv.slice(2);
  const command = args[0];

  // 如果没有提供命令，显示帮助信息
  if (!command) {
    showHelp();
    return;
  }

  try {
    switch (command) {
      // 核心图谱功能
      case 'process':
        await processNews(parseInt(args[1] || '100') || 100);
        break;

      case 'process-batch':
        await processBatch(parseInt(args[1] || '50') || 50);
        break;

      case 'process-recent':
        await processRecent(parseInt(args[1] || '24'));
        break;

      case 'reprocess':
        if (!args[1]) {
          console.error('❌ 请提供新闻ID');
          process.exit(1);
        }
        await reprocessNews(args[1]);
        break;

      case 'query':
        if (!args[1]) {
          console.error('❌ 请提供查询关键词');
          process.exit(1);
        }
        // 确保 limit 参数是正整数
        const limitArg = parseInt(args[2] || '10', 10);
        const safeLimit = isNaN(limitArg) || limitArg <= 0 ? 10 : limitArg;
        await queryGraph(args[1] || '', safeLimit);
        break;

      case 'stats':
        await showStats();
        break;

      case 'export':
        await exportData(args[1] || 'json');
        break;

      case 'rebuild':
        await rebuildGraph();
        break;

      case 'status':
        await checkStatus();
        break;

      // 文件处理功能
      case 'scan':
        await triggerFileScan();
        break;

      case 'file-stats':
        await showFileStats();
        break;

      case 'scheduler-status':
        await showSchedulerStatus();
        break;

      // 数据库安装和设置
      case 'setup-db':
        await setupDb();
        break;

      // 数据库管理命令
      case 'db-stats':
        await dbStats();
        break;

      case 'db-health':
        await dbHealthCheck();
        break;

      case 'db-backup':
        await dbBackup();
        break;

      case 'db-clean':
        console.log('⚠️  警告: 这将删除所有数据!');
        console.log('如果确定要继续，请在5秒内按Ctrl+C取消...');
        await new Promise(resolve => setTimeout(resolve, 5000));
        await dbClean();
        break;

      case 'db-clean-label':
        if (!args[1]) {
          console.error('❌ 请指定要删除的标签，如: npm run cli db-clean-label News');
          process.exit(1);
        }
        await dbCleanByLabel(args[1]);
        break;

      case 'db-clean-before':
        if (!args[1]) {
          console.error('❌ 请指定日期，如: npm run cli db-clean-before 2024-01-01');
          process.exit(1);
        }
        await dbCleanBeforeDate(args[1]);
        break;

      case 'db-clean-orphaned':
        await dbCleanOrphaned();
        break;

      case 'db-clean-duplicates':
        await dbCleanDuplicates();
        break;

      case 'db-rebuild':
        await dbRebuildIndexes();
        break;

      case 'db-export-config':
        await dbExportConfig();
        break;

      case 'create-indexes':
        await createIndexes();
        break;

      case 'db-help':
        showDbHelp();
        break;

      // 失败新闻处理命令
      case 'retry-failed':
        const retryLimit = args[1] ? parseInt(args[1], 10) : undefined;
        if (retryLimit && (isNaN(retryLimit) || retryLimit <= 0)) {
          console.error('❌ 限制数量必须是正整数');
          process.exit(1);
        }
        await retryFailedNews(retryLimit);
        break;

      case 'retry-failed-by-id':
        if (args.length < 2) {
          console.error('❌ 请提供至少一个新闻ID');
          console.error('用法: npm run cli retry-failed-by-id <newsId1> [newsId2] ...');
          process.exit(1);
        }
        const newsIdsToRetry = args.slice(1);
        await retryFailedNewsByIds(newsIdsToRetry);
        break;

      case 'list-failed':
        const listLimit = args[1] ? parseInt(args[1], 10) : 20;
        if (isNaN(listLimit) || listLimit <= 0) {
          console.error('❌ 限制数量必须是正整数');
          process.exit(1);
        }
        await listFailedNews(listLimit);
        break;

      case 'clean-failed':
        const daysOld = args[1] ? parseInt(args[1], 10) : 30;
        if (isNaN(daysOld) || daysOld <= 0) {
          console.error('❌ 天数必须是正整数');
          process.exit(1);
        }
        await cleanFailedFiles(daysOld);
        break;

      case 'help':
      case '--help':
      case '-h':
        showHelp();
        break;

      default:
        console.log(`❌ 未知命令: ${command}`);
        showHelp();
        process.exit(1);
    }
  } catch (error) {
    logger.error('CLI执行失败:', error);
    process.exit(1);
  }
}
