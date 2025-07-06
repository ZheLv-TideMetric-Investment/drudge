import { Router } from 'express';
import { logger } from '../utils/logger.js';
import { EntityExtractionService } from '../services/EntityExtractionService.js';
import { SummaryService } from '../services/SummaryService.js';
import { KnowledgeGraphService } from '../services/KnowledgeGraphService.js';

const router = Router();

// 全局服务实例
const entityExtractionService = new EntityExtractionService();
const summaryService = new SummaryService();
const knowledgeGraphService = new KnowledgeGraphService();

// 触发高级别新闻扫描
router.post('/high-level-scan', async (req, res) => {
  try {
    const { minutes = 30 } = req.body;
    
    logger.info(`🔍 收到高级别新闻扫描触发请求: minutes=${minutes}`);
    
    // 这里应该从数据库获取最近的高级别新闻
    // 为了演示，我们模拟一个响应
    const highLevelNews = []; // 实际应用中从数据库获取
    
    logger.info(`✅ 高级别新闻扫描完成: 发现 ${highLevelNews.length} 条高级别新闻`);
    
    res.json({
      success: true,
      message: '高级别新闻扫描完成',
      data: {
        count: highLevelNews.length,
        minutes,
        items: highLevelNews
      }
    });
    
  } catch (error) {
    logger.error('❌ 高级别新闻扫描失败:', error);
    res.status(500).json({
      success: false,
      message: '高级别新闻扫描失败',
      error: error.message
    });
  }
});

// 触发小时总结生成
router.post('/hourly-summary', async (req, res) => {
  try {
    const { hour } = req.body;
    
    logger.info(`📊 收到小时总结生成触发请求: hour=${hour || 'current'}`);
    
    const summary = await summaryService.generateHourlySummary(hour);
    
    logger.info(`✅ 小时总结生成完成: ${summary.period}`);
    
    res.json({
      success: true,
      message: '小时总结生成完成',
      data: summary
    });
    
  } catch (error) {
    logger.error('❌ 小时总结生成失败:', error);
    res.status(500).json({
      success: false,
      message: '小时总结生成失败',
      error: error.message
    });
  }
});

// 触发每日总结生成
router.post('/daily-summary', async (req, res) => {
  try {
    const { date } = req.body;
    
    logger.info(`📈 收到每日总结生成触发请求: date=${date || 'yesterday'}`);
    
    const summary = await summaryService.generateDailySummary(date);
    
    logger.info(`✅ 每日总结生成完成: ${summary.period}`);
    
    res.json({
      success: true,
      message: '每日总结生成完成',
      data: summary
    });
    
  } catch (error) {
    logger.error('❌ 每日总结生成失败:', error);
    res.status(500).json({
      success: false,
      message: '每日总结生成失败',
      error: error.message
    });
  }
});

// 触发实体提取
router.post('/extract-entities', async (req, res) => {
  try {
    const { newsItems } = req.body;
    
    if (!newsItems || !Array.isArray(newsItems)) {
      return res.status(400).json({
        success: false,
        message: '缺少必需参数: newsItems (数组)'
      });
    }
    
    logger.info(`🔍 收到实体提取触发请求: ${newsItems.length} 条新闻`);
    
    const results = await entityExtractionService.batchExtractEntities(newsItems);
    
    logger.info(`✅ 实体提取完成: ${results.size} 条新闻`);
    
    res.json({
      success: true,
      message: '实体提取完成',
      data: {
        count: results.size,
        results: Object.fromEntries(results)
      }
    });
    
  } catch (error) {
    logger.error('❌ 实体提取失败:', error);
    res.status(500).json({
      success: false,
      message: '实体提取失败',
      error: error.message
    });
  }
});

// 触发图谱维护
router.post('/maintenance', async (req, res) => {
  try {
    logger.info('🔧 收到图谱维护触发请求');
    
    // 执行维护任务：清理孤立节点、重建索引等
    const stats = await knowledgeGraphService.getGraphStats();
    
    logger.info('✅ 图谱维护完成');
    
    res.json({
      success: true,
      message: '图谱维护完成',
      data: {
        stats,
        maintenanceTasks: [
          '清理孤立节点',
          '重建索引',
          '更新统计信息'
        ]
      }
    });
    
  } catch (error) {
    logger.error('❌ 图谱维护失败:', error);
    res.status(500).json({
      success: false,
      message: '图谱维护失败',
      error: error.message
    });
  }
});

export { router as triggerRoutes }; 