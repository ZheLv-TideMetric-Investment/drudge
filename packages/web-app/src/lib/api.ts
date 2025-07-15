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
  ApiResponse,
  EntitySearchResult
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
  async getNews(params?: SearchParams): Promise<ApiResponse<PaginatedResponse<NewsItem>>> {
    return this.client.get('/api/news', { params });
  }

  async getNewsById(id: string): Promise<ApiResponse<NewsItem>> {
    return this.client.get(`/api/news/${id}`);
  }

  async searchNews(query: string, filters?: SearchParams): Promise<ApiResponse<NewsItem[]>> {
    return this.client.get('/api/news/search', {
      params: { query, ...filters }
    });
  }

  async getNewsByLevel(level: string): Promise<ApiResponse<NewsItem[]>> {
    return this.client.get(`/api/news/level/${level}`);
  }

  async getNewsStats(): Promise<ApiResponse<NewsStats>> {
    return this.client.get('/api/news/stats');
  }

  // 知识图谱相关API
  async getGraphData(query?: string, limit = 100, nodeType?: string): Promise<ApiResponse<GraphData>> {
    return this.client.get('/api/graph/data', { 
      params: { query, limit, nodeType } 
    });
  }

  async getGraphStats(): Promise<ApiResponse<GraphStats & { relationshipDistribution: Record<string, number> }>> {
    return this.client.get('/api/graph/stats');
  }

  async searchEntities(
    searchTerm: string, 
    nodeType?: string, 
    limit = 20
  ): Promise<ApiResponse<EntitySearchResult[]>> {
    return this.client.get('/api/graph/entities/search', {
      params: { searchTerm, nodeType, limit }
    });
  }

  async getEntityNeighborhood(
    entityId: string,
    depth = 1,
    limit = 50
  ): Promise<ApiResponse<GraphData>> {
    return this.client.get(`/api/graph/entities/${entityId}/neighborhood`, {
      params: { depth, limit }
    });
  }

  async getCompanyEvents(companyName: string): Promise<ApiResponse<unknown[]>> {
    return this.client.get('/api/graph/companies/events', {
      params: { companyName }
    });
  }

  async getRelatedNews(newsId: string, limit = 10): Promise<ApiResponse<NewsItem[]>> {
    return this.client.get('/api/news/related', {
      params: { newsId, limit }
    });
  }

  // 总结相关API
  async getHourlySummaries(date?: string): Promise<ApiResponse<HourlySummary[]>> {
    return this.client.get('/api/summary/hourly', {
      params: { date }
    });
  }

  async generateHourlySummary(hour?: number): Promise<ApiResponse<unknown>> {
    return this.client.post('/api/summary/hourly', { hour });
  }

  async getDailySummaries(startDate?: string, endDate?: string): Promise<ApiResponse<DailySummary[]>> {
    return this.client.get('/api/summary/daily', {
      params: { startDate, endDate }
    });
  }

  async generateDailySummary(): Promise<ApiResponse<unknown>> {
    return this.client.post('/api/summary/daily');
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

  async scanHighLevelNews(minutes?: number): Promise<ApiResponse<unknown>> {
    return this.client.post('/api/scan/high-level', { minutes });
  }

  async getHighLevelNewsStats(): Promise<ApiResponse<unknown>> {
    return this.client.get('/api/scan/high-level/stats');
  }

  async getBreakingNews(): Promise<ApiResponse<NewsItem[]>> {
    return this.client.get('/api/news/breaking');
  }

  // 系统相关API
  async getSystemHealth(): Promise<ApiResponse<unknown>> {
    return this.client.get('/api/system/health');
  }

  async getSystemStats(): Promise<ApiResponse<unknown>> {
    return this.client.get('/api/system/stats');
  }

  async processNews(newsIds?: string[]): Promise<ApiResponse<unknown>> {
    return this.client.post('/api/process/news', { newsIds });
  }

  async processRecentNews(hours = 1): Promise<ApiResponse<unknown>> {
    return this.client.post('/api/process/recent', { hours });
  }

  async rebuildGraph(): Promise<ApiResponse<unknown>> {
    return this.client.post('/api/graph/rebuild');
  }

  // 调度器相关API
  async getSchedulerStatus(): Promise<ApiResponse<unknown>> {
    return this.client.get('/api/scheduler/status');
  }

  async triggerJob(jobName: string): Promise<ApiResponse<unknown>> {
    return this.client.post(`/api/scheduler/trigger/${jobName}`);
  }
}

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
  getEntityNeighborhood,
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
  rebuildGraph,
  getSchedulerStatus,
  triggerJob
} = apiClient; 