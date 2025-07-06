import { logger } from '../../utils/logger';
import { formatReadable } from '../../utils/time';
import futuLiveService from '../../services/FutuLiveService';
import axios from 'axios';

/**
 * 获取最新新闻
 */
export async function fetchLatestNews(): Promise<any> {
  try {
    logger.info('🔄 开始获取最新新闻...');
    
    const newsItems = await futuLiveService.fetchNews();
    
    if (newsItems.length === 0) {
      return {
        success: true,
        count: 0,
        message: '没有获取到新的新闻',
        timestamp: formatReadable()
      };
    }

    // 如果有新新闻，通知webhook
    await notifyWebhook(newsItems.length, `成功获取 ${newsItems.length} 条新闻`);

    return {
      success: true,
      count: newsItems.length,
      message: `成功获取 ${newsItems.length} 条新闻`,
      timestamp: formatReadable(),
      news: newsItems.slice(0, 5) // 返回前5条作为预览
    };
  } catch (error: any) {
    logger.error('获取新闻失败:', error);
    return {
      success: false,
      count: 0,
      error: error.message,
      timestamp: formatReadable()
    };
  }
}

/**
 * 通知webhook（如果配置了）
 */
async function notifyWebhook(count: number, message: string): Promise<void> {
  const webhookUrl = process.env.GRAPH_WORKER_URL;
  if (!webhookUrl) return;

  try {
    const payload = {
      type: 'NEW_NEWS',
      source: 'futu_live',
      count,
      message,
      timestamp: new Date().toISOString()
    };

    await axios.post(`${webhookUrl}/trigger/process-news`, payload, {
      timeout: 5000,
      headers: { 'Content-Type': 'application/json' }
    });

    logger.info('✅ 成功通知graph-worker');
  } catch (error: any) {
    logger.warn('❌ 通知graph-worker失败:', error.message);
  }
} 