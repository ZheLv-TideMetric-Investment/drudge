import { logger } from '../../utils/logger';
import knowledgeGraphService from '../../services/KnowledgeGraphService';
import { NewsItem } from '../../types/index';
import { getCurrentTime } from '../../utils/timeUtils';

/**
 * 处理单条新闻
 */
export async function processNews(newsItem: NewsItem): Promise<any> {
  try {
    if (!newsItem || !newsItem.id || !newsItem.title || !newsItem.content) {
      return {
        success: false,
        error: '缺少必要的新闻数据字段 (id, title, content)',
        timestamp: getCurrentTime()
      };
    }

    logger.info(`📰 开始处理新闻: ${newsItem.id}`);

    const result = await knowledgeGraphService.processNews(newsItem);

    return {
      success: true,
      data: result,
      timestamp: getCurrentTime()
    };

  } catch (error: any) {
    logger.error('处理新闻失败:', error);
    return {
      success: false,
      error: error.message,
      timestamp: getCurrentTime()
    };
  }
}

/**
 * 批量处理新闻
 */
export async function batchProcessNews(newsItems: NewsItem[]): Promise<any> {
  try {
    if (!Array.isArray(newsItems) || newsItems.length === 0) {
      return {
        success: false,
        error: 'newsItems 必须是非空数组',
        timestamp: getCurrentTime()
      };
    }

    logger.info(`📰 开始批量处理新闻: ${newsItems.length} 条`);

    const results = await knowledgeGraphService.batchProcessNews(newsItems);

    const summary = {
      total: results.length,
      success: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length
    };

    return {
      success: true,
      data: results,
      summary,
      timestamp: getCurrentTime()
    };

  } catch (error: any) {
    logger.error('批量处理新闻失败:', error);
    return {
      success: false,
      error: error.message,
      timestamp: getCurrentTime()
    };
  }
}

/**
 * 检查新闻处理状态
 */
export async function checkNewsStatus(newsIds: string[]): Promise<any> {
  try {
    if (!Array.isArray(newsIds)) {
      return {
        success: false,
        error: 'newsIds 必须是数组',
        timestamp: getCurrentTime()
      };
    }

    const unprocessedIds = await knowledgeGraphService['entityService'].getUnprocessedNewsIds(newsIds);
    const processedIds = newsIds.filter(id => !unprocessedIds.includes(id));

    return {
      success: true,
      data: {
        total: newsIds.length,
        processed: processedIds.length,
        unprocessed: unprocessedIds.length,
        processedIds,
        unprocessedIds
      },
      timestamp: getCurrentTime()
    };

  } catch (error: any) {
    logger.error('检查新闻状态失败:', error);
    return {
      success: false,
      error: error.message,
      timestamp: getCurrentTime()
    };
  }
} 