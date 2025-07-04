// @ts-nocheck
import { NewsProcessor } from './processors/NewsProcessor';
import { FileWatcher } from './processors/FileWatcher';
import { MessageHandler } from './handlers/MessageHandler';
import logger from '../../shared/utils/logger';
import newsProcessingServiceV2 from '../../application/services/NewsProcessingServiceV2';
import notificationService from '../../application/services/business/NotificationService';

/**
 * 新闻处理工作线程
 * 专门负责持续处理本地存储的未处理新闻，支持文件监听和消息驱动
 * 重构版：采用组合模式，委托给专门的处理器
 */
class NewsProcessorWorker {
  private initialized: boolean = false;
  private isProcessing: boolean = false;
  private newsProcessor: NewsProcessor;
  private fileWatcher: FileWatcher;
  private messageHandler: MessageHandler;

  constructor() {
    this.newsProcessor = new NewsProcessor();
    this.fileWatcher = new FileWatcher(() => this.processUnhandledNews());
    this.messageHandler = new MessageHandler(this);
  }

  async initialize(): Promise<void> {
    try {
      logger.info('新闻处理工作线程开始初始化...');
      
      await newsProcessingServiceV2.initialize();
      await notificationService.initialize();
      
      this.initialized = true;
      logger.info('新闻处理工作线程初始化完成');
    } catch (error) {
      logger.error('新闻处理工作线程初始化失败:', error);
      throw error;
    }
  }

  /**
   * 启动新闻处理
   * 可以通过文件监听或定时检查的方式
   */
  async startProcessing(options: any = {}): Promise<void> {
    if (!this.initialized) {
      throw new Error('新闻处理工作线程未初始化');
    }

    const { 
      useFileWatcher = true, 
      intervalCheck = true, 
      checkInterval = 30000 // 30秒检查一次
    } = options;

    logger.info('开始启动新闻处理服务...');

    // 1. 启动文件监听（如果启用）
    if (useFileWatcher) {
      this.fileWatcher.startFileWatcher();
    }

    // 2. 启动定时检查（如果启用）
    if (intervalCheck) {
      this.fileWatcher.startIntervalCheck(checkInterval);
    }

    // 3. 立即执行一次处理
    await this.processUnhandledNews();

    logger.info('新闻处理服务已启动');
  }

  /**
   * 处理未处理的新闻
   */
  async processUnhandledNews(): Promise<void> {
    if (this.isProcessing) {
      logger.debug('新闻处理正在进行中，跳过本次处理');
      return;
    }

    this.isProcessing = true;

    try {
      const result = await this.newsProcessor.processUnhandledNews();
      
      // 通知主线程处理结果
      this.messageHandler.notifyMainThread('NEWS_PROCESSED', result);
    } catch (error) {
      logger.error('处理未处理新闻时发生错误:', error);
      this.messageHandler.notifyMainThread('PROCESSING_ERROR', {
        error: error.message,
        timestamp: Date.now()
      });
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * 停止新闻处理
   */
  stopProcessing(): void {
    logger.info('停止新闻处理服务...');
    this.fileWatcher.stopAll();
    logger.info('新闻处理服务已停止');
  }

  /**
   * 触发立即处理（响应外部消息）
   */
  async triggerProcessing(): Promise<void> {
    logger.info('收到外部触发信号，开始处理新闻...');
    await this.processUnhandledNews();
  }

  /**
   * 获取当前状态
   */
  getStatus(): any {
    return {
      initialized: this.initialized,
      isProcessing: this.isProcessing,
      fileWatcher: this.fileWatcher.getStatus(),
      stats: this.newsProcessor.getStats(),
      timestamp: Date.now()
    };
  }
}

// 监听主线程消息
if (require.main === module) {
  const processor = new NewsProcessorWorker();
  const messageHandler = processor['messageHandler'];
  
  // 设置消息监听
  messageHandler.setupMessageListener();
  
  // 通知主线程工作线程已就绪
  messageHandler.sendReady();
}

export default NewsProcessorWorker; 