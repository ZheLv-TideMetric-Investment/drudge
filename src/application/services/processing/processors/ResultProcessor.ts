// @ts-nocheck
import { BaseExtractor } from '../extractors/BaseExtractor';
import {
  Event,
  Company,
  Person,
  Organization,
  Location,
  Time,
  NewsExtractionResult,
} from '../../../../domain/entities/index';
import { NewsLevel } from '../../../../shared/types/enums';
import logger from '../../../../shared/utils/logger';

/**
 * 结果处理器
 * 负责解析AI返回的结果并转换为实体对象
 */
export class ResultProcessor extends BaseExtractor {
  /**
   * 解析提取结果
   * @param {Object} extractionData - AI提取的原始数据
   * @param {Object} newsItem - 原始新闻
   * @returns {NewsExtractionResult} - 格式化的提取结果
   */
  parseExtractionResult(extractionData: any, newsItem: any): NewsExtractionResult {
    const result = new NewsExtractionResult({
      newsId: newsItem.id,
      title: newsItem.title,
      content: newsItem.content,
      timestamp: new Date(newsItem.time * 1000).toISOString(),
      source: newsItem.source,
      url: newsItem.url,
      level: newsItem.level,
    });

    // 解析事件
    if (extractionData.events && Array.isArray(extractionData.events)) {
      for (const eventData of extractionData.events) {
        try {
          const event = new Event({
            event_name: eventData.event_name || '',
            event_description: eventData.event_description || '',
            event_date: this.parseDate(newsItem.time),
            event_type: this.validateEventType(eventData.event_type),
            significance: this.validateSignificance(eventData.significance),
            sentiment: this.validateSentiment(eventData.sentiment),
            magnitude: this.validateMagnitude(eventData.magnitude),
            event_level: this.validateNewsLevel(eventData.event_level),
          });
          result.addEvent(event);
        } catch (error) {
          logger.warn('解析事件失败:', eventData, error.message);
        }
      }
    }

    // 解析公司
    if (extractionData.companies && Array.isArray(extractionData.companies)) {
      for (const companyData of extractionData.companies) {
        try {
          const company = new Company({
            company_name: companyData.company_name || '',
            ticker: companyData.ticker || null,
            industry: companyData.industry || null,
            market: companyData.market || null,
            country: companyData.country || null,
          });
          result.addCompany(company);
        } catch (error) {
          logger.warn('解析公司失败:', companyData, error.message);
        }
      }
    }

    // 解析人物
    if (extractionData.persons && Array.isArray(extractionData.persons)) {
      for (const personData of extractionData.persons) {
        try {
          const person = new Person({
            person_name: personData.person_name || '',
            title: personData.title || null,
            company: personData.company || null,
            nationality: personData.nationality || null,
          });
          result.addPerson(person);
        } catch (error) {
          logger.warn('解析人物失败:', personData, error.message);
        }
      }
    }

    // 解析机构
    if (extractionData.organizations && Array.isArray(extractionData.organizations)) {
      for (const orgData of extractionData.organizations) {
        try {
          const organization = new Organization({
            organization_name: orgData.organization_name || '',
            type: orgData.type || null,
            country: orgData.country || null,
          });
          result.addOrganization(organization);
        } catch (error) {
          logger.warn('解析机构失败:', orgData, error.message);
        }
      }
    }

    // 解析地点
    if (extractionData.locations && Array.isArray(extractionData.locations)) {
      for (const locationData of extractionData.locations) {
        try {
          const location = new Location({
            location_name: locationData.location_name || '',
            type: locationData.type || null,
            country: locationData.country || null,
            region: locationData.region || null,
            coordinates: locationData.coordinates || null,
          });
          result.addLocation(location);
        } catch (error) {
          logger.warn('解析地点失败:', locationData, error.message);
        }
      }
    }

    // 解析时间
    if (extractionData.times && Array.isArray(extractionData.times)) {
      for (const timeData of extractionData.times) {
        try {
          const time = new Time({
            time_value: timeData.time_value || timeData.timestamp || new Date(newsItem.time * 1000).toISOString(),
            type: timeData.type || 'DATETIME',
            precision: timeData.precision || 'SECOND',
            timezone: timeData.timezone,
          });
          result.addTime(time);
        } catch (error) {
          logger.warn('解析时间失败:', timeData, error.message);
        }
      }
    }

    // 解析关系
    if (extractionData.relationships && Array.isArray(extractionData.relationships)) {
      for (const relData of extractionData.relationships) {
        try {
          const relationship = {
            type: this.validateRelationshipType(relData.type),
            from: relData.from || '',
            to: relData.to || '',
            description: relData.description || '',
            confidence: 0.8,
            source: newsItem.id,
          };
          result.addRelationship(relationship);
        } catch (error) {
          logger.warn('解析关系失败:', relData, error.message);
        }
      }
    }

    // 计算整体置信度
    const totalItems = result.events.length + result.companies.length +
                      result.persons.length + result.organizations.length +
                      result.locations.length + result.times.length;
    result.confidence = totalItems > 0 ? 0.8 : 0;

    return result;
  }

  /**
   * 判断新闻级别（完全基于AI判断结果）
   * @param {Object} newsItem - 新闻对象
   * @param {NewsExtractionResult} result - 提取结果
   * @returns {string} - 新闻级别
   */
  determineNewsLevel(newsItem: any, result: NewsExtractionResult): string {
    // 直接使用AI判断的事件级别
    if (result.events.length > 0) {
      // 获取最高级别的事件作为整体新闻级别
      const highestEventLevel = result.events.reduce((highest, event) => {
        const currentLevel = event.event_level || NewsLevel.LEVEL_5;
        const highestLevel = highest || NewsLevel.LEVEL_5;
        
        // 数值越小级别越高（Level 1 > Level 2 > ... > Level 5）
        const currentValue = this.getLevelValue(currentLevel);
        const highestValue = this.getLevelValue(highestLevel);
        
        return currentValue < highestValue ? currentLevel : highestLevel;
      }, NewsLevel.LEVEL_5);
      
      logger.debug(`新闻 ${newsItem.id} AI判断级别: ${highestEventLevel}，事件级别: ${result.events.map(e => e.event_level).join(', ')}`);
      return highestEventLevel;
    }

    // 默认级别 - 信息性新闻
    logger.debug(`新闻 ${newsItem.id} 无事件，使用默认级别: ${NewsLevel.LEVEL_5}`);
    return NewsLevel.LEVEL_5;
  }
} 