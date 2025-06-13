import knowledgeGraphService from '../services/knowledgeGraphService.js';
import neo4jService from '../services/neo4jService.js';
import storageService from '../services/storageService.js';
import logger from '../utils/logger.js';
import moment from 'moment-timezone';

// 设置默认时区为北京时间
moment.tz.setDefault('Asia/Shanghai');

/**
 * 知识图谱触发器脚本
 * 用于管理知识图谱的各种操作
 */

const COMMANDS = {
  INIT: 'init',
  PROCESS: 'process',
  QUERY: 'query',
  HEALTH: 'health',
  STATS: 'stats',
  SEARCH: 'search',
};

async function main() {
  const command = process.argv[2];
  const args = process.argv.slice(3);

  console.log('='.repeat(50));
  console.log('知识图谱管理系统');
  console.log('='.repeat(50));

  try {
    switch (command) {
      case COMMANDS.INIT:
        await initializeGraph();
        break;

      case COMMANDS.PROCESS:
        await processNews(args);
        break;

      case COMMANDS.QUERY:
        await queryGraph(args);
        break;

      case COMMANDS.HEALTH:
        await healthCheck();
        break;

      case COMMANDS.STATS:
        await showStats();
        break;

      case COMMANDS.SEARCH:
        await searchEntities(args);
        break;

      default:
        showHelp();
        break;
    }
  } catch (error) {
    console.error('执行失败:', error.message);
    logger.error('图谱操作失败:', error);
    process.exit(1);
  }
}

/**
 * 初始化知识图谱
 */
async function initializeGraph() {
  console.log('🚀 初始化知识图谱...');

  // 初始化服务
  await knowledgeGraphService.initialize();

  console.log('✅ 知识图谱初始化完成');
  console.log('📊 数据库统计:');

  const stats = await knowledgeGraphService.getGraphStats();
  console.table({
    节点数量: stats.nodeCount || 0,
    关系数量: stats.relationshipCount || 0,
    标签数量: stats.labelCount || 0,
    关系类型数量: stats.relationshipTypeCount || 0,
  });

  await neo4jService.close();
}

/**
 * 处理新闻
 */
async function processNews(args) {
  console.log('📰 开始处理新闻...');

  await knowledgeGraphService.initialize();

  let newsItems = [];

  if (args.length > 0 && args[0] === 'latest') {
    // 处理最新新闻
    const hours = parseInt(args[1]) || 1;
    const startTime = moment().subtract(hours, 'hours');
    const endTime = moment();

    console.log(`📅 获取最近 ${hours} 小时的新闻...`);
    newsItems = await storageService.getByTimeRange(startTime, endTime);
    console.log(`📄 找到 ${newsItems.length} 条新闻`);
  } else if (args.length > 0 && args[0] === 'range') {
    // 处理指定时间范围的新闻
    const startDate = args[1];
    const endDate = args[2];

    if (!startDate || !endDate) {
      console.error('❌ 请提供开始和结束时间 (YYYY-MM-DD)');
      return;
    }

    const startTime = moment(startDate);
    const endTime = moment(endDate).endOf('day');

    console.log(`📅 获取 ${startDate} 到 ${endDate} 的新闻...`);
    newsItems = await storageService.getByTimeRange(startTime, endTime);
    console.log(`📄 找到 ${newsItems.length} 条新闻`);
  } else {
    // 处理最近1小时的新闻
    console.log('📅 获取最近1小时的新闻...');
    const startTime = moment().subtract(1, 'hours');
    const endTime = moment();
    newsItems = await storageService.getByTimeRange(startTime, endTime);
    console.log(`📄 找到 ${newsItems.length} 条新闻`);
  }

  if (newsItems.length === 0) {
    console.log('ℹ️  没有找到需要处理的新闻');
    await neo4jService.close();
    return;
  }

  // 批量处理新闻
  console.log('🔄 开始批量处理新闻...');
  const results = await knowledgeGraphService.batchProcessNews(newsItems);

  // 统计结果
  const successCount = results.filter(r => r.success).length;
  const failureCount = results.length - successCount;

  const totalStats = results.reduce(
    (acc, r) => {
      if (r.success && r.stats) {
        acc.entities += r.stats.entityCount || 0;
        acc.events += r.stats.eventCount || 0;
        acc.relationships += r.stats.relationshipCount || 0;
      }
      return acc;
    },
    { entities: 0, events: 0, relationships: 0 }
  );

  console.log('\n📈 处理结果:');
  console.table({
    处理新闻总数: newsItems.length,
    成功处理: successCount,
    处理失败: failureCount,
    提取实体数: totalStats.entities,
    提取事件数: totalStats.events,
    提取关系数: totalStats.relationships,
  });

  // 显示失败的新闻
  if (failureCount > 0) {
    console.log('\n❌ 处理失败的新闻:');
    results
      .filter(r => !r.success)
      .forEach(r => {
        console.log(`  - 新闻ID: ${r.newsId}, 错误: ${r.error}`);
      });
  }

  await neo4jService.close();
  console.log('✅ 新闻处理完成');
}

/**
 * 查询图谱
 */
async function queryGraph(args) {
  console.log('🔍 查询知识图谱...');

  await knowledgeGraphService.initialize();

  const queryType = args[0];

  switch (queryType) {
    case 'entity': {
      const entityName = args[1];
      if (!entityName) {
        console.error('❌ 请提供实体名称');
        return;
      }

      console.log(`🔍 查询实体: ${entityName}`);
      const result = await knowledgeGraphService.getEntityGraph(entityName);

      console.log(
        `📊 找到 ${result.getNodeCount()} 个节点, ${result.getRelationshipCount()} 个关系`
      );

      // 显示相关实体
      const entities = result.nodes.filter(n => n.labels.includes('Entity'));
      if (entities.length > 0) {
        console.log('\n🏷️  相关实体:');
        entities.slice(0, 10).forEach(entity => {
          console.log(`  - ${entity.properties.name} (${entity.properties.type})`);
        });
      }
      break;
    }

    case 'events': {
      const eventType = args[1];
      if (!eventType) {
        console.error('❌ 请提供事件类型');
        return;
      }

      console.log(`🔍 查询事件类型: ${eventType}`);
      const result = await knowledgeGraphService.getEventEntities(eventType);

      console.log(
        `📊 找到 ${result.getNodeCount()} 个节点, ${result.getRelationshipCount()} 个关系`
      );
      break;
    }

    case 'popular': {
      console.log('🔍 查询热门实体...');
      const popular = await knowledgeGraphService.getPopularEntities(10);

      console.log('\n🔥 热门实体 (按提及次数排序):');
      popular.forEach((item, index) => {
        console.log(
          `${index + 1}. ${item.entity.name} (${item.entity.type}) - ${item.mentions} 次提及`
        );
      });
      break;
    }

    case 'timeline': {
      const entityName = args[1];
      const days = parseInt(args[2]) || 7;

      if (!entityName) {
        console.error('❌ 请提供实体名称');
        return;
      }

      console.log(`🔍 查询实体时间线: ${entityName} (最近 ${days} 天)`);
      const endDate = moment();
      const startDate = moment().subtract(days, 'days');

      const result = await knowledgeGraphService.getEntityTimeline(
        entityName,
        startDate.toDate(),
        endDate.toDate()
      );

      console.log(
        `📊 找到 ${result.getNodeCount()} 个节点, ${result.getRelationshipCount()} 个关系`
      );
      break;
    }

    default:
      console.error('❌ 不支持的查询类型');
      console.log('支持的查询类型: entity, events, popular, timeline');
      break;
  }

  await neo4jService.close();
}

/**
 * 搜索实体
 */
async function searchEntities(args) {
  const searchTerm = args[0];
  const entityType = args[1];

  if (!searchTerm) {
    console.error('❌ 请提供搜索关键词');
    return;
  }

  console.log(`🔍 搜索实体: "${searchTerm}"${entityType ? ` (类型: ${entityType})` : ''}`);

  await knowledgeGraphService.initialize();

  const entities = await knowledgeGraphService.searchEntities(searchTerm, entityType);

  if (entities.length === 0) {
    console.log('😥 没有找到匹配的实体');
  } else {
    console.log(`\n📋 找到 ${entities.length} 个匹配的实体:`);
    entities.forEach((entity, index) => {
      console.log(`${index + 1}. ${entity.name} (${entity.type})`);
      if (entity.aliases && entity.aliases.length > 0) {
        console.log(`   别名: ${entity.aliases.join(', ')}`);
      }
      if (entity.description) {
        console.log(`   描述: ${entity.description}`);
      }
      console.log('');
    });
  }

  await neo4jService.close();
}

/**
 * 健康检查
 */
async function healthCheck() {
  console.log('🏥 知识图谱健康检查...');

  const health = await knowledgeGraphService.healthCheck();

  console.log(`\n📋 健康状态: ${health.status === 'healthy' ? '✅ 健康' : '❌ 异常'}`);
  console.log(`🔧 服务初始化: ${health.initialized ? '✅ 已初始化' : '❌ 未初始化'}`);

  if (health.database) {
    console.log(`💾 数据库状态: ${health.database.status === 'healthy' ? '✅ 健康' : '❌ 异常'}`);
    if (health.database.error) {
      console.log(`❌ 数据库错误: ${health.database.error}`);
    }
  }

  console.log(`⏰ 检查时间: ${moment(health.timestamp).format('YYYY-MM-DD HH:mm:ss')}`);

  if (health.status === 'healthy') {
    await showStats();
  }

  await neo4jService.close();
}

/**
 * 显示统计信息
 */
async function showStats() {
  console.log('📊 获取图谱统计信息...');

  await knowledgeGraphService.initialize();

  const stats = await knowledgeGraphService.getGraphStats();

  console.log('\n📈 整体统计:');
  console.table({
    节点总数: stats.nodeCount || 0,
    关系总数: stats.relationshipCount || 0,
    标签数量: stats.labelCount || 0,
    关系类型数量: stats.relationshipTypeCount || 0,
  });

  if (stats.nodeTypes && stats.nodeTypes.length > 0) {
    console.log('\n🏷️  节点类型分布:');
    const nodeTypeTable = {};
    stats.nodeTypes.forEach(nt => {
      const label = nt.labels.join(', ') || '无标签';
      nodeTypeTable[label] = nt.count;
    });
    console.table(nodeTypeTable);
  }

  if (stats.relationshipTypes && stats.relationshipTypes.length > 0) {
    console.log('\n🔗 关系类型分布:');
    const relTypeTable = {};
    stats.relationshipTypes.forEach(rt => {
      relTypeTable[rt.type] = rt.count;
    });
    console.table(relTypeTable);
  }

  await neo4jService.close();
}

/**
 * 显示帮助信息
 */
function showHelp() {
  console.log(`
📖 知识图谱管理系统 - 使用说明

🔧 初始化:
  npm run graph:init
  
📰 处理新闻:
  npm run graph:process                    # 处理最近1小时的新闻
  npm run graph:process latest 3          # 处理最近3小时的新闻
  npm run graph:process range 2024-01-01 2024-01-02  # 处理指定日期范围的新闻

🔍 查询图谱:
  npm run graph:query entity "特斯拉"       # 查询实体关系网络
  npm run graph:query events PriceChange  # 查询特定类型事件
  npm run graph:query popular            # 查询热门实体
  npm run graph:query timeline "马斯克" 7  # 查询实体时间线(最近7天)

🔍 搜索实体:
  npm run graph:search "特斯拉"            # 搜索实体
  npm run graph:search "马斯克" Person     # 按类型搜索实体

📊 系统状态:
  npm run graph:health                    # 健康检查
  npm run graph:stats                     # 显示统计信息
  
💡 提示:
  - 确保 Neo4j 数据库已启动并配置正确
  - 首次使用请先运行 npm run graph:init 初始化
  - 处理新闻前确保已有新闻数据
  `);
}

// 运行主函数
main().catch(error => {
  console.error('💥 系统错误:', error);
  process.exit(1);
});
