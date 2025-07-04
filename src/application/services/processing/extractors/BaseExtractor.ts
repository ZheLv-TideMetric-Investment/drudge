// @ts-nocheck
import { 
  NewsLevel, 
  SignificanceLevel,
  EventTypes,
  RelationshipTypes
} from '../../../../shared/types/enums';

/**
 * 基础提取器类
 * 提供通用的提取方法和验证功能
 */
export class BaseExtractor {
  protected maxRetries: number;
  protected retryDelay: number;

  constructor() {
    this.maxRetries = 3;
    this.retryDelay = 1000;
  }

  /**
   * 延迟函数
   */
  protected async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 解析日期
   */
  protected parseDate(timestamp: number): string {
    return new Date(timestamp * 1000).toISOString().split('T')[0];
  }

  /**
   * 验证事件类型
   */
  protected validateEventType(type: string): string {
    const validTypes = Object.values(EventTypes);
    return validTypes.includes(type) ? type : EventTypes.OTHER;
  }

  /**
   * 验证重要性级别
   */
  protected validateSignificance(significance: any): number {
    const num = parseInt(significance);
    if (isNaN(num) || num < 1 || num > 4) return SignificanceLevel.MEDIUM;
    return num;
  }

  /**
   * 验证情感倾向
   */
  protected validateSentiment(sentiment: string): string {
    const validSentiments = ['positive', 'negative', 'neutral'];
    return validSentiments.includes(sentiment) ? sentiment : 'neutral';
  }

  /**
   * 验证影响程度
   */
  protected validateMagnitude(magnitude: any): number {
    const num = parseFloat(magnitude);
    if (isNaN(num)) return 0;
    return Math.max(-1, Math.min(1, num));
  }

  /**
   * 验证关系类型
   */
  protected validateRelationshipType(type: string): string {
    const validTypes = Object.values(RelationshipTypes);
    return validTypes.includes(type) ? type : RelationshipTypes.MENTIONED_IN;
  }

  /**
   * 验证新闻级别
   */
  protected validateNewsLevel(level: string): string {
    const validLevels = Object.values(NewsLevel);
    return validLevels.includes(level) ? level : NewsLevel.LEVEL_5;
  }

  /**
   * 获取级别数值（用于比较，数值越小级别越高）
   */
  protected getLevelValue(level: string): number {
    const levelMap = {
      [NewsLevel.LEVEL_1]: 1,
      [NewsLevel.LEVEL_2]: 2,
      [NewsLevel.LEVEL_3]: 3,
      [NewsLevel.LEVEL_4]: 4,
      [NewsLevel.LEVEL_5]: 5,
    };
    return levelMap[level] || 5;
  }
} 