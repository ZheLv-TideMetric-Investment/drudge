// @ts-nocheck
import { parentPort } from 'worker_threads';
import logger from '../../../shared/utils/logger';

/**
 * 消息处理器
 * 负责处理工作线程间的消息通信
 */
export class MessageHandler {
  private newsProcessor: any;

  constructor(newsProcessor: any) {
    this.newsProcessor = newsProcessor;
  }

  /**
   * 设置消息监听
   */
  setupMessageListener(): void {
    if (!parentPort) return;

    parentPort.on('message', async (message) => {
      try {
        const { type, data, taskId } = message;
        
        switch (type) {
          case 'INITIALIZE':
            await this.handleInitialize(taskId);
            break;
            
          case 'START_PROCESSING':
            await this.handleStartProcessing(data, taskId);
            break;
            
          case 'STOP_PROCESSING':
            this.handleStopProcessing(taskId);
            break;
            
          case 'TRIGGER_PROCESSING':
            await this.handleTriggerProcessing(taskId);
            break;
            
          case 'GET_STATUS':
            this.handleGetStatus(taskId);
            break;
            
          case 'PING':
            this.handlePing(taskId);
            break;
            
          default:
            this.sendResponse('ERROR', taskId, null, `未知的消息类型: ${type}`);
        }
      } catch (error) {
        this.sendResponse('ERROR', message.taskId, null, error.message);
      }
    });
  }

  /**
   * 处理初始化消息
   */
  private async handleInitialize(taskId: string): Promise<void> {
    await this.newsProcessor.initialize();
    this.sendResponse('RESULT', taskId, { success: true, message: '新闻处理器初始化完成' });
  }

  /**
   * 处理开始处理消息
   */
  private async handleStartProcessing(data: any, taskId: string): Promise<void> {
    await this.newsProcessor.startProcessing(data);
    this.sendResponse('RESULT', taskId, { success: true, message: '新闻处理服务已启动' });
  }

  /**
   * 处理停止处理消息
   */
  private handleStopProcessing(taskId: string): void {
    this.newsProcessor.stopProcessing();
    this.sendResponse('RESULT', taskId, { success: true, message: '新闻处理服务已停止' });
  }

  /**
   * 处理触发处理消息
   */
  private async handleTriggerProcessing(taskId: string): Promise<void> {
    await this.newsProcessor.triggerProcessing();
    this.sendResponse('RESULT', taskId, { success: true, message: '处理已触发' });
  }

  /**
   * 处理获取状态消息
   */
  private handleGetStatus(taskId: string): void {
    const status = this.newsProcessor.getStatus();
    this.sendResponse('RESULT', taskId, status);
  }

  /**
   * 处理Ping消息
   */
  private handlePing(taskId: string): void {
    this.sendResponse('PONG', taskId, null, null, Date.now());
  }

  /**
   * 发送响应消息
   */
  private sendResponse(type: string, taskId: string, result?: any, error?: string, timestamp?: number): void {
    if (!parentPort) return;

    const response: any = {
      type,
      taskId,
      timestamp: timestamp || Date.now()
    };

    if (result !== undefined) response.result = result;
    if (error) response.error = error;

    parentPort.postMessage(response);
  }

  /**
   * 通知主线程
   */
  notifyMainThread(type: string, data: any): void {
    if (!parentPort) return;

    parentPort.postMessage({
      type,
      data,
      timestamp: Date.now()
    });
  }

  /**
   * 发送就绪信号
   */
  sendReady(): void {
    this.notifyMainThread('READY', {});
  }
} 