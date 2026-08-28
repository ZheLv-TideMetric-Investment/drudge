import { logger } from './logger';

const DEFAULT_CONSECUTIVE_TIMEOUT_THRESHOLD = 5;
const DEFAULT_SUCCESS_WINDOW_MS = 5 * 60 * 1000;

export class ApiFailureAlertTracker {
  private consecutiveTimeouts = 0;
  private lastSuccessAt = Date.now();
  private lastTimeoutAlertAt = 0;

  constructor(
    private readonly moduleName: string,
    private readonly consecutiveTimeoutThreshold = DEFAULT_CONSECUTIVE_TIMEOUT_THRESHOLD,
    private readonly successWindowMs = DEFAULT_SUCCESS_WINDOW_MS
  ) {}

  recordSuccess(): void {
    if (this.consecutiveTimeouts > 0) {
      logger.info(`${this.moduleName} API恢复成功，清除连续超时计数: ${this.consecutiveTimeouts}`);
    }

    this.consecutiveTimeouts = 0;
    this.lastSuccessAt = Date.now();
  }

  isTimeoutError(error: any): boolean {
    return (
      error?.code === 'ECONNABORTED' &&
      typeof error?.message === 'string' &&
      error.message.includes('timeout')
    );
  }

  shouldNotifyTimeout(errorMessage: string): boolean {
    const now = Date.now();
    this.consecutiveTimeouts += 1;

    const hasConsecutiveFailures = this.consecutiveTimeouts >= this.consecutiveTimeoutThreshold;
    const hasNoRecentSuccess = now - this.lastSuccessAt >= this.successWindowMs;
    const shouldNotify = hasConsecutiveFailures || hasNoRecentSuccess;

    if (!shouldNotify) {
      logger.warn(
        `${this.moduleName} API偶发超时，暂不发送告警: ${errorMessage} ` +
          `(连续${this.consecutiveTimeouts}/${this.consecutiveTimeoutThreshold}次)`
      );
      return false;
    }

    if (now - this.lastTimeoutAlertAt < this.successWindowMs) {
      logger.warn(
        `${this.moduleName} API持续超时，告警已在5分钟内发送过，暂不重复发送: ${errorMessage}`
      );
      return false;
    }

    this.lastTimeoutAlertAt = now;
    return true;
  }
}
