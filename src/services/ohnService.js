import { promises as fs } from 'fs';
import path from 'path';
import logger from '../utils/logger.js';
import moment from 'moment-timezone';
import storageService from './storageService.js';
import { callLLMWithJsonResponse } from '../utils/llm.js';

// 设置默认时区为北京时间
moment.tz.setDefault('Asia/Shanghai');

class OHNService {
  constructor() {
    this.basePath = path.join(process.cwd(), 'data', 'ohn');
    this.ensureStorageDirectory();
  }

  async ensureStorageDirectory() {
    try {
      await fs.mkdir(this.basePath, { recursive: true });
    } catch (error) {
      logger.error('创建OHN存储目录失败:', error);
    }
  }

  // 获取OHN存储路径
  getOHNPath(timestamp) {
    const date = moment(timestamp);
    const dateFolder = date.format('YYYYMMDD');
    return path.join(this.basePath, dateFolder);
  }

  // 确保目录存在
  async ensureDirectoryExists(dirPath) {
    try {
      await fs.mkdir(dirPath, { recursive: true });
    } catch (error) {
      logger.error(`创建目录失败: ${dirPath}`, error);
    }
  }

  // 使用AI进行智能处理和分类
  async processWithAI(rawNews) {
    try {
      if (!rawNews || rawNews.length === 0) {
        return { categorizedNews: {}, totalProcessed: 0 };
      }

      logger.info(`开始AI处理原始新闻数据，数量: ${rawNews.length}`);

      // 调用AI服务进行智能压缩、去重和分类
      const result = await this.processOHNData(rawNews);

      logger.info(`AI处理完成，压缩后数据量: ${result.totalProcessed}`);
      return result;
    } catch (error) {
      logger.error('AI处理新闻数据失败:', error);
      throw error;
    }
  }

  // 新增：OHN数据处理方法
  async processOHNData(rawNews) {
    try {
      if (!rawNews || rawNews.length === 0) {
        return { categorizedNews: {}, totalProcessed: 0 };
      }

      logger.info(`开始AI处理OHN数据，原始数据量: ${rawNews.length}`);

      const processedData = await this.callOHNProcessingService(rawNews);

      return processedData;
    } catch (error) {
      logger.error('OHN AI处理失败:', error);
      throw error;
    }
  }

  async callOHNProcessingService(rawNews) {
    try {
      // 预处理：统计相似新闻的出现次数
      const newsWithFrequency = await this.preprocessNewsFrequency(rawNews);

      // 构建新闻内容，包含频次信息
      const newsContent = newsWithFrequency
        .map((item, index) => {
          const frequencyInfo = item.frequency > 1 ? ` | 相似报道:${item.frequency}次` : '';
          return `[${
            index + 1
          }] ID:${item.id} | 时间:${moment(item.time * 1000).format('YYYY-MM-DD HH:mm:ss')} | 等级:${
            item.level || '未知'
          }${frequencyInfo}\n标题：${item.title}\n内容：${item.content}\n`;
        })
        .join('\n');

      const messages = [
        {
          role: 'system',
          content: `
  You are a financial news processing engine that compresses and categorizes hourly news data for OHN (Original-Hour News) system.
  
  ############################################################
  ◆ 核心任务
  1. **智能去重**: 识别并合并重复或高度相似的新闻，保留最完整的信息
  2. **信息压缩**: 在大幅减少字符数的同时，保持所有关键信息完整，特别是数字、比例、时间等
  3. **准确分类**: 将新闻分类到5个预定义类别中
  4. **频次考虑**: 优先处理相似报道次数多的重要新闻
  
  ############################################################
  ◆ 分类标准
  **宏观政策/系统风险**: 央行决策、财政政策、监管政策、主权评级、系统性金融风险、宏观经济指标(GDP、CPI、PMI等)
  **跨市场价格冲击**: 股票、债券、汇率、大宗商品、期货等市场价格异动(涨跌>1%或成交量异常)
  **行业/主题驱动**: 行业政策、供需变化、技术突破、主题投资、板块轮动
  **大型主体事件**: 市值>100亿的公司、知名金融机构、国际组织的重大事件
  **一般公司/区域性新闻**: 中小企业动态、地方经济、一般商业新闻
  
  ############################################################
  ◆ 处理规则
  1. **数字保真**: 所有数字、百分比、金额必须完全准确，不得四舍五入或估算
  2. **时间保留**: 保持原始时间信息
  3. **频次权重**: 相似报道次数多的新闻优先级更高，应优先保留
  4. **去重逻辑**: 
     - 相同事件的多个报道合并为一条
     - 保留信息最丰富的版本
     - 时间以最新为准
     - 记录合并的报道总数
  5. **压缩要求**: 单条新闻压缩后≤100字，保留所有关键要素
  
  ############################################################
  ◆ 输出格式 (JSON)
  \`\`\`json
  {
    "宏观政策/系统风险": [
      {
        "title": "压缩后标题≤20字",
        "content": "压缩后内容≤80字，保留所有数字和关键信息",
        "time": "最新时间戳",
        "level": "新闻等级",
        "frequency": "相似报道次数",
        "mergedIds": ["合并的新闻ID列表"]
      }
    ],
    "跨市场价格冲击": [...],
    "行业/主题驱动": [...],
    "大型主体事件": [...],
    "一般公司/区域性新闻": [...]
  }
  \`\`\`
  
  ############################################################
  ◆ 压缩示例
  原文: "据央行今日发布的最新数据显示，11月份货币供应量M2同比增长8.1%，比上月回落0.3个百分点，符合市场预期"
  压缩: "央行数据：11月M2同比增8.1%，环比降0.3个百分点"
  
  原文: "某知名证券公司分析师表示，预计本轮A股调整幅度有限，建议投资者关注低估值蓝筹股投资机会"
  压缩: "券商：A股调整有限，建议关注低估值蓝筹"
  
  ############################################################
  ◆ 注意事项
  - 保持客观中性，不添加主观判断
  - 优先保留量化信息而非定性描述
  - 合并时以信息完整度为准，不以等级高低
  - 相似报道次数多的事件重要性更高
  - 分类有疑问时选择影响范围最大的类别
  - 必须在输出中保留 frequency 和 mergedIds 字段
  `.trim(),
        },
        {
          role: 'user',
          content: `请处理以下新闻数据：\n\n${newsContent}`,
        },
      ];

      const processedData = await callLLMWithJsonResponse(messages);

      // 统计处理后的数据量
      let totalProcessed = 0;
      Object.values(processedData).forEach(category => {
        if (Array.isArray(category)) {
          totalProcessed += category.length;
        }
      });

      logger.info(`AI处理完成，压缩后数据量: ${totalProcessed}`);

      return {
        categorizedNews: processedData,
        totalProcessed: totalProcessed,
      };
    } catch (error) {
      logger.error('调用OHN AI服务失败:', error);
      throw error;
    }
  }

  // 新增：预处理新闻频次统计
  async preprocessNewsFrequency(rawNews) {
    try {
      const newsWithFrequency = [];
      const processed = new Set();

      for (const news of rawNews) {
        if (processed.has(news.id)) continue;

        let frequency = 1;
        const similarNews = [news.id];

        // 查找相似新闻
        for (const otherNews of rawNews) {
          if (otherNews.id === news.id || processed.has(otherNews.id)) continue;

          const similarity = this.calculateNewsSimilarity(news, otherNews);
          if (similarity > 0.7) {
            // 相似度阈值
            frequency++;
            similarNews.push(otherNews.id);
            processed.add(otherNews.id);
          }
        }

        newsWithFrequency.push({
          ...news,
          frequency: frequency,
          similarIds: similarNews,
        });

        processed.add(news.id);
      }

      // 按频次和等级排序
      newsWithFrequency.sort((a, b) => {
        // 首先按频次排序
        if (b.frequency !== a.frequency) {
          return b.frequency - a.frequency;
        }
        // 频次相同时按等级排序
        const levelA = parseInt(a.level) || 5;
        const levelB = parseInt(b.level) || 5;
        return levelA - levelB;
      });

      logger.info(
        `新闻频次预处理完成: 原始${rawNews.length}条 -> 聚合${newsWithFrequency.length}条`
      );
      // 记录高频新闻
      const highFrequencyNews = newsWithFrequency.filter(news => news.frequency > 1);
      if (highFrequencyNews.length > 0) {
        logger.info(`发现${highFrequencyNews.length}条高频新闻:`);
        highFrequencyNews.slice(0, 3).forEach(news => {
          logger.info(`  "${news.title}" (${news.frequency}次报道)`);
        });
      }

      return newsWithFrequency;
    } catch (error) {
      logger.error('新闻频次预处理失败:', error);
      // 如果预处理失败，返回原始数据
      return rawNews.map(news => ({ ...news, frequency: 1, similarIds: [news.id] }));
    }
  }

  // 新增：计算新闻相似度
  calculateNewsSimilarity(news1, news2) {
    try {
      // 检查输入参数有效性
      if (!news1 || !news2) return 0;

      // 检查标题和内容是否为空
      const title1 = news1.title?.trim() || '';
      const title2 = news2.title?.trim() || '';
      const content1 = news1.content?.trim() || '';
      const content2 = news2.content?.trim() || '';

      // 如果两个新闻的标题和内容都为空，认为不相似
      if (!title1 && !content1 && !title2 && !content2) return 0;

      // 如果其中一个新闻完全没有内容，相似度为0
      if ((!title1 && !content1) || (!title2 && !content2)) return 0;

      let titleSimilarity = 0;
      let contentSimilarity = 0;
      let weightTitle = 0;
      let weightContent = 0;

      // 计算标题相似度（仅当两个标题都不为空时）
      if (title1 && title2) {
        const title1Words = this.extractKeywords(title1);
        const title2Words = this.extractKeywords(title2);
        titleSimilarity = this.calculateWordSimilarity(title1Words, title2Words);
        weightTitle = 0.6; // 标题权重
      }

      // 计算内容相似度（仅当两个内容都不为空时）
      if (content1 && content2) {
        const content1Words = this.extractKeywords(content1);
        const content2Words = this.extractKeywords(content2);
        contentSimilarity = this.calculateWordSimilarity(content1Words, content2Words);
        weightContent = 0.4; // 内容权重
      }

      // 动态调整权重：如果只有标题或只有内容，则该部分权重为1
      const totalWeight = weightTitle + weightContent;
      if (totalWeight === 0) return 0;

      if (weightTitle > 0 && weightContent === 0) {
        // 只有标题相似度
        return titleSimilarity;
      } else if (weightTitle === 0 && weightContent > 0) {
        // 只有内容相似度
        return contentSimilarity;
      } else {
        // 标题和内容都有，按权重计算
        return (titleSimilarity * weightTitle + contentSimilarity * weightContent) / totalWeight;
      }
    } catch (error) {
      logger.error('计算新闻相似度失败:', error);
      return 0;
    }
  }

  // 新增：提取关键词
  extractKeywords(text) {
    if (!text || typeof text !== 'string') return [];

    const trimmedText = text.trim();
    if (!trimmedText) return [];

    // 提取中文词汇，过滤停用词
    const stopWords = new Set([
      '据悉',
      '据了解',
      '据报道',
      '消息称',
      '有消息称',
      '表示',
      '显示',
      '认为',
      '指出',
      '此外',
      '另外',
      '同时',
      '此前',
      '目前',
      '今日',
      '昨日',
      '近日',
    ]);

    const words = trimmedText.match(/[\u4e00-\u9fa5]{2,}/g) || [];

    return words.filter(word => word.length >= 2 && !stopWords.has(word)).slice(0, 10); // 取前10个关键词
  }

  // 新增：计算词汇相似度
  calculateWordSimilarity(words1, words2) {
    // 处理空数组的情况
    if (!Array.isArray(words1) || !Array.isArray(words2)) return 0;
    if (words1.length === 0 && words2.length === 0) return 1;
    if (words1.length === 0 || words2.length === 0) return 0;

    const set1 = new Set(words1);
    const set2 = new Set(words2);
    const intersection = new Set([...set1].filter(x => set2.has(x)));
    const union = new Set([...set1, ...set2]);

    return intersection.size / union.size;
  }

  // 执行OHN处理
  async runOriginalHour(timestamp = null) {
    try {
      const now = timestamp ? moment(timestamp) : moment();
      const lastHourStart = now.clone().subtract(1, 'hour').startOf('hour');
      const lastHourEnd = now.clone().startOf('hour');

      logger.info(
        `开始处理OHN: ${lastHourStart.format('YYYY-MM-DD HH:mm:ss')} 到 ${lastHourEnd.format('YYYY-MM-DD HH:mm:ss')}`
      );

      // 获取过去1小时的原始新闻
      const rawNews = await storageService.getByTimeRange(lastHourStart, lastHourEnd);

      if (rawNews.length === 0) {
        logger.info('过去1小时没有新闻数据');
        return null;
      }

      // 使用AI进行智能处理
      const processedData = await this.processWithAI(rawNews);

      if (processedData.totalProcessed === 0) {
        logger.info('AI处理后没有有效数据');
        return null;
      }

      // 保存分类后的OHN数据
      await this.saveOHNByCategory(lastHourStart, processedData.categorizedNews);

      // 清理原始数据（可选，保留ID和URL引用）
      await this.cleanupRawData(rawNews);

      logger.info(`OHN处理完成，AI压缩后数据量: ${processedData.totalProcessed}`);
      return processedData;
    } catch (error) {
      logger.error('OHN处理失败:', error);
      throw error;
    }
  }

  // 按分类保存OHN数据
  async saveOHNByCategory(timestamp, categorizedNews) {
    try {
      const dirPath = this.getOHNPath(timestamp);
      await this.ensureDirectoryExists(dirPath);

      const hour = timestamp.format('HH');
      const fileName = `${hour}.json`;
      const filePath = path.join(dirPath, fileName);

      // 计算总数
      const totalCount = Object.values(categorizedNews).reduce(
        (sum, arr) => sum + (arr?.length || 0),
        0
      );

      // 构建单个文件的数据结构
      const ohnData = {
        hour: hour,
        timestamp: timestamp.toISOString(),
        totalCount: totalCount,
        categories: categorizedNews,
      };

      await fs.writeFile(filePath, JSON.stringify(ohnData, null, 2));

      // 输出分类统计
      Object.entries(categorizedNews).forEach(([category, newsArray]) => {
        if (newsArray && newsArray.length > 0) {
          logger.info(`${category}: ${newsArray.length}条新闻`);
        }
      });

      logger.info(`保存OHN数据成功: ${fileName}, 总计: ${totalCount}条`);
    } catch (error) {
      logger.error('保存OHN数据失败:', error);
      throw error;
    }
  }

  // 清理原始数据（保留引用信息）
  async cleanupRawData(rawNews) {
    try {
      // 这里可以实现清理策略，比如只保留ID和URL，删除正文内容
      // 为了保持系统稳定，暂时不实际删除原始数据
      logger.info(`可清理的原始数据数量: ${rawNews.length}`);
    } catch (error) {
      logger.error('清理原始数据失败:', error);
    }
  }

  // 获取指定时间范围的OHN数据
  async getOHNByTimeRange(startTime, endTime) {
    try {
      const start = moment(startTime);
      const end = moment(endTime);

      // 获取时间范围内的所有日期
      const dates = [];
      let current = start.clone().startOf('day');
      while (current.isSameOrBefore(end, 'day')) {
        dates.push(current.clone());
        current.add(1, 'day');
      }

      let allData = [];

      // 遍历每个日期
      for (const date of dates) {
        const dirPath = this.getOHNPath(date);
        try {
          const files = await fs.readdir(dirPath);
          // 读取小时文件（格式：HH.json）
          const hourFiles = files.filter(file => /^\d{2}\.json$/.test(file));

          // 读取相关文件
          for (const file of hourFiles) {
            const hour = parseInt(file.replace('.json', ''));
            const fileTime = date.clone().hour(hour);

            // 检查是否在时间范围内
            if (fileTime.isSameOrAfter(start) && fileTime.isSameOrBefore(end)) {
              const filePath = path.join(dirPath, file);
              const content = await fs.readFile(filePath, 'utf-8');
              const ohnData = JSON.parse(content);

              // 将所有分类的新闻数据展平
              if (ohnData.categories) {
                Object.values(ohnData.categories).forEach(categoryNews => {
                  if (Array.isArray(categoryNews)) {
                    allData = [...allData, ...categoryNews];
                  }
                });
              }
            }
          }
        } catch (error) {
          // 如果目录不存在，继续下一个日期
          if (error.code === 'ENOENT') continue;
          throw error;
        }
      }

      // 按时间排序
      allData.sort((a, b) => b.time - a.time);
      logger.info(
        `查询OHN时间范围数据: ${start.format('YYYY-MM-DD HH:mm:ss')} 到 ${end.format('YYYY-MM-DD HH:mm:ss')}, 数量: ${allData.length}`
      );
      return allData;
    } catch (error) {
      logger.error('获取OHN时间范围数据失败:', error);
      return [];
    }
  }

  // 获取最近N天的所有OHN数据
  async getRecentOHN(days = 7) {
    const endTime = moment();
    const startTime = endTime.clone().subtract(days, 'days');
    return await this.getOHNByTimeRange(startTime, endTime);
  }

  // 获取指定时间范围的OHN数据按分类
  async getOHNByCategoryRange(startTime, endTime) {
    try {
      const start = moment(startTime);
      const end = moment(endTime);

      const dates = [];
      let current = start.clone().startOf('day');
      while (current.isSameOrBefore(end, 'day')) {
        dates.push(current.clone());
        current.add(1, 'day');
      }

      const categorizedData = {};

      for (const date of dates) {
        const dirPath = this.getOHNPath(date);
        try {
          const files = await fs.readdir(dirPath);
          const hourFiles = files.filter(file => /^\d{2}\.json$/.test(file));

          for (const file of hourFiles) {
            const hour = parseInt(file.replace('.json', ''));
            const fileTime = date.clone().hour(hour);

            if (fileTime.isSameOrAfter(start) && fileTime.isSameOrBefore(end)) {
              const filePath = path.join(dirPath, file);
              const content = await fs.readFile(filePath, 'utf-8');
              const ohnData = JSON.parse(content);

              // 合并分类数据
              if (ohnData.categories) {
                Object.entries(ohnData.categories).forEach(([category, newsArray]) => {
                  if (!categorizedData[category]) {
                    categorizedData[category] = [];
                  }

                  if (Array.isArray(newsArray)) {
                    categorizedData[category] = [...categorizedData[category], ...newsArray];
                  }
                });
              }
            }
          }
        } catch (error) {
          if (error.code === 'ENOENT') continue;
          throw error;
        }
      }

      // 按时间排序每个分类的数据
      Object.keys(categorizedData).forEach(category => {
        categorizedData[category].sort((a, b) => b.time - a.time);
      });

      return categorizedData;
    } catch (error) {
      logger.error('获取分类OHN数据失败:', error);
      return {};
    }
  }
}

export default new OHNService();
