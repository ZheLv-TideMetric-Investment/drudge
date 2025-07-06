import { deepseek } from '@ai-sdk/deepseek';
import { generateText } from 'ai';
import { logger } from '../utils/logger.js';
import { NewsItem, ExtractedEntity, EntityType } from '../types/index.js';

export class EntityExtractionService {
  private apiKey: string;
  
  constructor() {
    this.apiKey = process.env.DEEPSEEK_API_KEY || '';
  }

  async initialize() {
    logger.info('🔍 初始化实体提取服务...');
    
    if (!this.apiKey) {
      logger.warn('⚠️ DEEPSEEK_API_KEY 未设置，实体提取功能将受限');
    }
    
    logger.info('✅ 实体提取服务初始化完成');
  }

  async extractEntities(newsItem: NewsItem): Promise<ExtractedEntity[]> {
    try {
      logger.info(`🔍 提取实体: ${newsItem.title}`);
      
      const prompt = this.buildExtractionPrompt(newsItem);
      
      const { text } = await generateText({
        model: deepseek('deepseek-chat'),
        prompt,
        maxTokens: 1000,
        temperature: 0.3
      });
      
      const entities = this.parseExtractionResult(text);
      
      logger.info(`✅ 实体提取完成: ${newsItem.title} -> ${entities.length} 个实体`);
      return entities;
      
    } catch (error) {
      logger.error('❌ 实体提取失败:', error);
      return [];
    }
  }

  async batchExtractEntities(newsItems: NewsItem[]): Promise<Map<string, ExtractedEntity[]>> {
    logger.info(`🔄 批量提取实体: ${newsItems.length} 条新闻`);
    
    const results = new Map<string, ExtractedEntity[]>();
    const batchSize = 5; // 较小的批次以避免API限制
    
    for (let i = 0; i < newsItems.length; i += batchSize) {
      const batch = newsItems.slice(i, i + batchSize);
      
      const promises = batch.map(async (newsItem) => {
        try {
          const entities = await this.extractEntities(newsItem);
          results.set(newsItem.id, entities);
        } catch (error) {
          logger.error(`❌ 提取新闻 ${newsItem.id} 实体失败:`, error);
          results.set(newsItem.id, []);
        }
      });
      
      await Promise.all(promises);
      logger.info(`✅ 完成批次 ${Math.floor(i / batchSize) + 1}/${Math.ceil(newsItems.length / batchSize)}`);
      
      // 添加延迟以避免API限制
      if (i + batchSize < newsItems.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    logger.info(`✅ 批量实体提取完成，共处理 ${results.size} 条新闻`);
    return results;
  }

  private buildExtractionPrompt(newsItem: NewsItem): string {
    return `
请从以下新闻中提取实体信息，并以JSON格式返回。

新闻标题: ${newsItem.title}
新闻内容: ${newsItem.description || ''}
新闻来源: ${newsItem.source}

请提取以下类型的实体：
1. PERSON - 人物（姓名、职位、国籍等）
2. COMPANY - 公司（公司名、行业、市场等）
3. LOCATION - 地点（地名、类型、坐标等）
4. EVENT - 事件（事件名、类型、级别、情感等）
5. TIME - 时间（时间值、格式等）

返回格式示例：
{
  "entities": [
    {
      "type": "PERSON",
      "name": "张三",
      "properties": {
        "position": "CEO",
        "nationality": "中国"
      }
    },
    {
      "type": "COMPANY", 
      "name": "苹果公司",
      "properties": {
        "industry": "科技",
        "market": "纳斯达克"
      }
    }
  ]
}

请只返回JSON格式，不要包含其他文字。
`;
  }

  private parseExtractionResult(text: string): ExtractedEntity[] {
    try {
      const cleaned = text.trim();
      let jsonStr = cleaned;
      
      // 提取JSON部分
      const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        jsonStr = jsonMatch[0];
      }
      
      const result = JSON.parse(jsonStr);
      
      if (result.entities && Array.isArray(result.entities)) {
        return result.entities.map((entity: any) => ({
          type: this.mapEntityType(entity.type),
          name: entity.name || '',
          properties: entity.properties || {},
          confidence: entity.confidence || 0.8
        }));
      }
      
      return [];
      
    } catch (error) {
      logger.warn(`⚠️ 无法解析实体提取结果: "${text.substring(0, 100)}..."`, error);
      return [];
    }
  }

  private mapEntityType(type: string): EntityType {
    const upperType = type.toUpperCase();
    switch (upperType) {
      case 'PERSON': return EntityType.PERSON;
      case 'COMPANY': return EntityType.COMPANY;
      case 'LOCATION': return EntityType.LOCATION;
      case 'EVENT': return EntityType.EVENT;
      case 'TIME': return EntityType.TIME;
      default: return EntityType.PERSON;
    }
  }
} 