const ohnService = require('../src/services/ohnService');
const moment = require('moment-timezone');

moment.tz.setDefault('Asia/Shanghai');

describe('OHNService', () => {
  describe('dedupAndCompress', () => {
    test('应该正确去重新闻数据', async () => {
      const mockNews = [
        { id: '1', title: '测试新闻1', content: '内容1', time: 1640995200, level: 1 },
        { id: '2', title: '测试新闻2', content: '内容2', time: 1640995300, level: 2 },
        { id: '1', title: '测试新闻1', content: '内容1', time: 1640995200, level: 1 } // 重复
      ];

      const result = await ohnService.dedupAndCompress(mockNews);
      
      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('1');
      expect(result[1].id).toBe('2');
    });

    test('应该正确压缩冗词', async () => {
      const mockNews = [
        { 
          id: '1', 
          title: '据悉，央行将会降息', 
          content: '据了解，中央银行准备降低利率', 
          time: 1640995200, 
          level: 1 
        }
      ];

      const result = await ohnService.dedupAndCompress(mockNews);
      
      expect(result[0].title).toBe('央行将会降息');
      expect(result[0].content).toBe('中央银行准备降低利率');
    });
  });

  describe('compressText', () => {
    test('应该移除冗词但保留关键信息', () => {
      const text = '据悉，今天股市上涨了5%，据了解情况良好';
      const result = ohnService.compressText(text);
      
      expect(result).toBe('今天股市上涨了5%情况良好');
    });

    test('应该处理空文本', () => {
      expect(ohnService.compressText('')).toBe('');
      expect(ohnService.compressText(null)).toBe(null);
      expect(ohnService.compressText(undefined)).toBe(undefined);
    });
  });

  describe('getOHNPath', () => {
    test('应该生成正确的存储路径', () => {
      const testTime = moment('2024-01-01 15:30:00');
      const result = ohnService.getOHNPath(testTime);
      
      expect(result).toContain('20240101');
    });
  });
}); 