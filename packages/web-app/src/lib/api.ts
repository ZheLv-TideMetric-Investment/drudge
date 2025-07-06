import axios, { AxiosInstance, AxiosResponse } from 'axios';
import { config } from './config';
import type {
  NewsItem,
  GraphData,
  HourlySummary,
  DailySummary,
  NewsStats,
  GraphStats,
  MonitorAlert,
  SearchParams,
  PaginatedResponse,
  ApiResponse
} from '@/types';

class ApiClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000',
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json'
      }
    });

    // 请求拦截器
    this.client.interceptors.request.use(
      (config) => {
        console.log(`API Request: ${config.method?.toUpperCase()} ${config.url}`);
        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );

    // 响应拦截器
    this.client.interceptors.response.use(
      (response: AxiosResponse) => {
        return response.data;
      },
      (error) => {
        console.error('API Error:', error);
        const message = error.response?.data?.error || error.message || '网络错误';
        return Promise.reject(new Error(message));
      }
    );
  }

  // 新闻相关API
  async getNews(params?: SearchParams): Promise<PaginatedResponse<NewsItem>> {
    return this.client.get('/api/news', { params });
  }

  async getNewsById(id: string): Promise<ApiResponse<NewsItem>> {
    return this.client.get(`/api/news/${id}`);
  }

  async searchNews(query: string, limit = 20): Promise<ApiResponse<NewsItem[]>> {
    return this.client.get('/api/news/search', { 
      params: { query, limit } 
    });
  }

  async getNewsByLevel(level: string, limit = 20): Promise<ApiResponse<NewsItem[]>> {
    return this.client.get('/api/news/by-level', { 
      params: { level, limit } 
    });
  }

  async getNewsStats(days = 7): Promise<ApiResponse<NewsStats>> {
    return this.client.get('/api/news/stats', { 
      params: { days } 
    });
  }

  // 知识图谱相关API
  async getGraphData(query?: string, limit = 100): Promise<ApiResponse<GraphData>> {
    return this.client.get('/api/graph/data', { 
      params: { query, limit } 
    });
  }

  async getGraphStats(): Promise<ApiResponse<GraphStats>> {
    return this.client.get('/api/graph/stats');
  }

  async searchEntities(
    searchTerm: string, 
    nodeType?: string, 
    limit = 20
  ): Promise<ApiResponse<unknown[]>> {
    return this.client.get('/api/graph/entities/search', {
      params: { searchTerm, nodeType, limit }
    });
  }

  async getCompanyEvents(companyName: string, limit = 50): Promise<ApiResponse<unknown[]>> {
    return this.client.get('/api/graph/company-events', {
      params: { companyName, limit }
    });
  }

  async getRelatedNews(query: string, limit = 10): Promise<ApiResponse<NewsItem[]>> {
    return this.client.get('/api/graph/related-news', {
      params: { query, limit }
    });
  }

  // 总结相关API
  async getHourlySummaries(hours = 24): Promise<ApiResponse<HourlySummary[]>> {
    return this.client.get('/api/summary/hourly', { 
      params: { hours } 
    });
  }

  async generateHourlySummary(hour?: number): Promise<ApiResponse<HourlySummary>> {
    return this.client.post('/api/summary/hourly/generate', { hour });
  }

  async getDailySummaries(days = 7): Promise<ApiResponse<DailySummary[]>> {
    return this.client.get('/api/summary/daily', { 
      params: { days } 
    });
  }

  async generateDailySummary(): Promise<ApiResponse<DailySummary>> {
    return this.client.post('/api/summary/daily/generate');
  }

  async getHourlySummaryStats(): Promise<ApiResponse<unknown>> {
    return this.client.get('/api/summary/hourly/stats');
  }

  // 监控相关API
  async getMonitorAlerts(limit = 50): Promise<ApiResponse<MonitorAlert[]>> {
    return this.client.get('/api/monitor/alerts', { 
      params: { limit } 
    });
  }

  async scanHighLevelNews(minutes = 30): Promise<ApiResponse<unknown>> {
    return this.client.post('/api/monitor/scan', { minutes });
  }

  async getHighLevelNewsStats(): Promise<ApiResponse<unknown>> {
    return this.client.get('/api/monitor/high-level/stats');
  }

  async getBreakingNews(hours = 24): Promise<ApiResponse<NewsItem[]>> {
    return this.client.get('/api/monitor/breaking-news', {
      params: { hours }
    });
  }

  // 系统状态API
  async getSystemHealth(): Promise<ApiResponse<unknown>> {
    return this.client.get('/api/system/health');
  }

  async getSystemStats(): Promise<ApiResponse<unknown>> {
    return this.client.get('/api/system/stats');
  }

  // 处理API
  async processNews(newsIds: string[]): Promise<ApiResponse<unknown>> {
    return this.client.post('/api/process/news', { newsIds });
  }

  async processRecentNews(hours = 24): Promise<ApiResponse<unknown>> {
    return this.client.post('/api/process/recent', { hours });
  }

  async rebuildGraph(): Promise<ApiResponse<unknown>> {
    return this.client.post('/api/process/rebuild-graph');
  }
}

// 创建单例实例
export const apiClient = new ApiClient();

// 导出便捷方法
export const {
  getNews,
  getNewsById,
  searchNews,
  getNewsByLevel,
  getNewsStats,
  getGraphData,
  getGraphStats,
  searchEntities,
  getCompanyEvents,
  getRelatedNews,
  getHourlySummaries,
  generateHourlySummary,
  getDailySummaries,
  generateDailySummary,
  getHourlySummaryStats,
  getMonitorAlerts,
  scanHighLevelNews,
  getHighLevelNewsStats,
  getBreakingNews,
  getSystemHealth,
  getSystemStats,
  processNews,
  processRecentNews,
  rebuildGraph
} = apiClient; 