// @ts-nocheck

/**
 * 新闻级别值对象
 * 封装新闻级别的业务逻辑和验证
 */
export class NewsLevel {
  public static readonly LEVEL_1 = 'Level 1';
  public static readonly LEVEL_2 = 'Level 2';
  public static readonly LEVEL_3 = 'Level 3';
  public static readonly LEVEL_4 = 'Level 4';
  public static readonly LEVEL_5 = 'Level 5';

  private readonly level: string;

  constructor(level: string) {
    this.level = this.validate(level);
  }

  /**
   * 验证级别有效性
   */
  private validate(level: string): string {
    const validLevels = [
      NewsLevel.LEVEL_1,
      NewsLevel.LEVEL_2,
      NewsLevel.LEVEL_3,
      NewsLevel.LEVEL_4,
      NewsLevel.LEVEL_5
    ];

    if (!validLevels.includes(level)) {
      throw new Error(`Invalid news level: ${level}`);
    }

    return level;
  }

  /**
   * 获取级别值
   */
  getValue(): string {
    return this.level;
  }

  /**
   * 获取级别数值（用于比较）
   */
  getNumericValue(): number {
    const levelMap = {
      [NewsLevel.LEVEL_1]: 1,
      [NewsLevel.LEVEL_2]: 2,
      [NewsLevel.LEVEL_3]: 3,
      [NewsLevel.LEVEL_4]: 4,
      [NewsLevel.LEVEL_5]: 5,
    };
    return levelMap[this.level] || 5;
  }

  /**
   * 是否为高级别新闻
   */
  isHighLevel(): boolean {
    return this.level === NewsLevel.LEVEL_1 || this.level === NewsLevel.LEVEL_2;
  }

  /**
   * 是否为突发新闻
   */
  isBreakingNews(): boolean {
    return this.level === NewsLevel.LEVEL_1;
  }

  /**
   * 获取级别描述
   */
  getDescription(): string {
    const descriptions = {
      [NewsLevel.LEVEL_1]: '紧急新闻 - 全球性极大冲击的突发事件',
      [NewsLevel.LEVEL_2]: '高优先级新闻 - 重要的金融、政策类事件',
      [NewsLevel.LEVEL_3]: '中等优先级新闻 - 对特定行业或公司有较大影响',
      [NewsLevel.LEVEL_4]: '低优先级新闻 - 影响较小的局部性事件',
      [NewsLevel.LEVEL_5]: '信息性新闻 - 纯信息性内容，无直接市场影响'
    };
    return descriptions[this.level] || '未知级别';
  }

  /**
   * 比较级别高低
   */
  isHigherThan(other: NewsLevel): boolean {
    return this.getNumericValue() < other.getNumericValue();
  }

  /**
   * 比较级别是否相等
   */
  equals(other: NewsLevel): boolean {
    return this.level === other.level;
  }

  /**
   * 转换为字符串
   */
  toString(): string {
    return this.level;
  }

  /**
   * 创建Level 1新闻级别
   */
  static createLevel1(): NewsLevel {
    return new NewsLevel(NewsLevel.LEVEL_1);
  }

  /**
   * 创建Level 2新闻级别
   */
  static createLevel2(): NewsLevel {
    return new NewsLevel(NewsLevel.LEVEL_2);
  }

  /**
   * 创建Level 3新闻级别
   */
  static createLevel3(): NewsLevel {
    return new NewsLevel(NewsLevel.LEVEL_3);
  }

  /**
   * 创建Level 4新闻级别
   */
  static createLevel4(): NewsLevel {
    return new NewsLevel(NewsLevel.LEVEL_4);
  }

  /**
   * 创建Level 5新闻级别
   */
  static createLevel5(): NewsLevel {
    return new NewsLevel(NewsLevel.LEVEL_5);
  }

  /**
   * 从字符串创建新闻级别
   */
  static fromString(level: string): NewsLevel {
    return new NewsLevel(level);
  }
} 