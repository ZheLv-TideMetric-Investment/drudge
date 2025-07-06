import fs from 'fs';
import { logger } from '../utils/logger';
import config from '../config/config';
import knowledgeGraphService from './KnowledgeGraphService';
import { FileInfo, markFileAsProcessed } from './FileScanner';
import { NewsItem, ProcessResult } from '../types/index';

/**
 * 新闻处理服务
 * 负责并行处理新闻文件，进行图谱化
 */

export interface FileProcessResult {
  success: boolean;
  filePath: string;
  fileName: string;
  newsCount: number;
  processedCount: number;
  error?: string;
  processingTime: number;
}

/**
 * 并行处理新闻文件
 */
export async function processNewsFilesInParallel(fileInfos: FileInfo[]): Promise<FileProcessResult[]> {
  const batchSize = config.processing.batchSize;
  const results: FileProcessResult[] = [];
  
  logger.info(`🔄 开始并行处理 ${fileInfos.length} 个文件，批次大小: ${batchSize}`);

  // 分批并行处理
  for (let i = 0; i < fileInfos.length; i += batchSize) {
    const batch = fileInfos.slice(i, i + batchSize);
    logger.info(`📦 处理批次 ${Math.floor(i / batchSize) + 1}/${Math.ceil(fileInfos.length / batchSize)}: ${batch.length} 个文件`);
    
    // 并行处理当前批次
    const batchPromises = batch.map(fileInfo => processSingleNewsFile(fileInfo));
    const batchResults = await Promise.allSettled(batchPromises);
    
    // 处理批次结果
    batchResults.forEach((result, index) => {
      if (index >= batch.length) return;
      
      const fileInfo = batch[index];
      if (!fileInfo) return;
      
      if (result.status === 'fulfilled') {
        results.push(result.value);
      } else {
        // 处理失败的情况
        const failedResult: FileProcessResult = {
          success: false,
          filePath: fileInfo.fullPath,
          fileName: fileInfo.fileName,
          newsCount: 0,
          processedCount: 0,
          error: (result.reason as Error)?.message || '未知错误',
          processingTime: 0
        };
        results.push(failedResult);
        logger.error(`❌ 文件处理失败: ${fileInfo.fileName}`, result.reason);
      }
    });
    
    // 批次间稍作延迟，避免系统负载过高
    if (i + batchSize < fileInfos.length) {
      await new Promise(resolve => setTimeout(resolve, config.processing.retryDelay));
    }
  }

  const successful = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  
  logger.info(`✅ 并行处理完成: 成功 ${successful} 个，失败 ${failed} 个`);
  
  return results;
}

/**
 * 处理单个新闻文件
 */
async function processSingleNewsFile(fileInfo: FileInfo): Promise<FileProcessResult> {
  const startTime = Date.now();
  
  try {
    logger.debug(`📄 开始处理文件: ${fileInfo.fileName}`);
    
    // 读取文件内容
    const fileContent = fs.readFileSync(fileInfo.fullPath, 'utf8');
    const newsData = JSON.parse(fileContent);
    
    // 将文件数据转换为标准的NewsItem格式
    const newsItems = convertFileDataToNewsItems(newsData, fileInfo);
    
    if (newsItems.length === 0) {
      logger.warn(`⚠️ 文件中没有有效的新闻数据: ${fileInfo.fileName}`);
      return {
        success: true,
        filePath: fileInfo.fullPath,
        fileName: fileInfo.fileName,
        newsCount: 0,
        processedCount: 0,
        processingTime: Date.now() - startTime
      };
    }

    logger.debug(`📰 文件包含 ${newsItems.length} 条新闻: ${fileInfo.fileName}`);
    
    // 确保知识图谱服务已初始化
    if (!knowledgeGraphService['initialized']) {
      await knowledgeGraphService.initialize();
    }
    
    // 批量处理新闻进行图谱化
    const processResults = await knowledgeGraphService.batchProcessNews(newsItems);
    
    const successful = processResults.filter(r => r.success).length;
    const failed = processResults.filter(r => !r.success).length;
    
    if (failed > 0) {
      logger.warn(`⚠️ 文件处理部分失败: ${fileInfo.fileName} (成功${successful}, 失败${failed})`);
    }

    // 如果大部分成功，标记文件为已处理
    if (successful > failed) {
      await markFileAsProcessed(fileInfo.fullPath);
      logger.debug(`✅ 文件处理完成: ${fileInfo.fileName} (${successful}/${newsItems.length})`);
    }

    return {
      success: true,
      filePath: fileInfo.fullPath,
      fileName: fileInfo.fileName,
      newsCount: newsItems.length,
      processedCount: successful,
      processingTime: Date.now() - startTime
    };

  } catch (error: any) {
    logger.error(`❌ 处理文件失败: ${fileInfo.fileName}`, error);
    
    return {
      success: false,
      filePath: fileInfo.fullPath,
      fileName: fileInfo.fileName,
      newsCount: 0,
      processedCount: 0,
      error: error.message,
      processingTime: Date.now() - startTime
    };
  }
}

/**
 * 将文件数据转换为标准的NewsItem格式
 */
function convertFileDataToNewsItems(fileData: any, fileInfo: FileInfo): NewsItem[] {
  try {
    const newsItems: NewsItem[] = [];
    
    // 处理不同的文件格式
    let dataArray: any[] = [];
    
    if (Array.isArray(fileData)) {
      dataArray = fileData;
    } else if (fileData.data && Array.isArray(fileData.data)) {
      dataArray = fileData.data;
    } else if (fileData.list && Array.isArray(fileData.list)) {
      dataArray = fileData.list;
    } else if (fileData.news && Array.isArray(fileData.news)) {
      dataArray = fileData.news;
    } else {
      logger.warn(`⚠️ 无法识别的文件格式: ${fileInfo.fileName}`);
      return [];
    }

    for (const item of dataArray) {
      try {
        const newsItem = convertSingleNewsItem(item, fileInfo);
        if (newsItem) {
          newsItems.push(newsItem);
        }
      } catch (error) {
        logger.debug(`跳过无效新闻项: ${fileInfo.fileName}`, error);
      }
    }

    return newsItems;

  } catch (error) {
    logger.error(`转换新闻数据失败: ${fileInfo.fileName}`, error);
    return [];
  }
}

/**
 * 转换单个新闻项
 */
function convertSingleNewsItem(item: any, fileInfo: FileInfo): NewsItem | null {
  try {
    // 提取新闻的基本信息
    const id = item.id || item.news_id || item.newsId || generateNewsId(item, fileInfo);
    const title = item.title || item.headline || item.subject || '';
    const content = item.content || item.text || item.description || '';
    const description = item.description || item.summary || '';
    
    // 处理时间戳
    let timestamp: Date;
    if (item.timestamp) {
      timestamp = new Date(typeof item.timestamp === 'number' ? item.timestamp * 1000 : item.timestamp);
    } else if (item.time) {
      timestamp = new Date(typeof item.time === 'number' ? item.time * 1000 : item.time);
    } else if (item.publishTime || item.publish_time) {
      timestamp = new Date(item.publishTime || item.publish_time);
    } else {
      timestamp = fileInfo.modifiedTime; // 使用文件修改时间作为默认值
    }

    // 验证必要字段
    if (!title || !content) {
      return null;
    }

    const newsItem: NewsItem = {
      id: String(id),
      title,
      description,
      content,
      source: item.source || 'futu_live',
      url: item.url || item.link || '',
      timestamp,
      level: item.level || item.news_level || 5,
      processed: false
    };

    return newsItem;

  } catch (error) {
    logger.debug('转换单个新闻项失败:', error);
    return null;
  }
}

/**
 * 生成新闻ID（如果没有提供）
 */
function generateNewsId(item: any, fileInfo: FileInfo): string {
  const title = item.title || item.headline || '';
  const timestamp = item.timestamp || item.time || Date.now();
  const fileName = fileInfo.fileName.replace('.json', '');
  
  // 创建一个简单的hash作为ID
  const hash = Buffer.from(`${fileName}_${title}_${timestamp}`).toString('base64').slice(0, 16);
  return `${fileName}_${hash}`;
}

/**
 * 获取处理器状态信息
 */
export async function getProcessorStats(): Promise<any> {
  try {
    return {
      service: 'NewsProcessor',
      version: '1.0',
      config: {
        batchSize: config.processing.batchSize,
        retryAttempts: config.processing.retryAttempts,
        retryDelay: config.processing.retryDelay
      },
      features: [
        '并行文件处理',
        '批量图谱化',
        '失败重试机制',
        '处理状态跟踪',
        '多格式文件支持'
      ],
      supportedFormats: [
        'JSON数组格式',
        '包含data字段的对象',
        '包含list字段的对象',
        '包含news字段的对象'
      ],
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    logger.error('获取处理器状态失败:', error);
    throw error;
  }
} 