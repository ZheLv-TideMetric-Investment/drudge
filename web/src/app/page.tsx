'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Loading } from '@/components/ui/Loading';
import { 
  NewspaperIcon, 
  ShareIcon, 
  ChartBarIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline';
import { formatNumber, formatDate, getNewsLevelColor } from '@/lib/utils';
import type { NewsStats, GraphStats, NewsItem } from '@/types';

export default function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [newsStats, setNewsStats] = useState<NewsStats | null>(null);
  const [graphStats, setGraphStats] = useState<GraphStats | null>(null);
  const [recentNews, setRecentNews] = useState<NewsItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);

      // 模拟API调用 - 实际使用时替换为真实API
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // 模拟数据
      setNewsStats({
        total: 1248,
        highLevel: 89,
        breakNews: 12,
        levelDistribution: {
          'Level 1': 12,
          'Level 2': 77,
          'Level 3': 234,
          'Level 4': 567,
          'Level 5': 358
        },
        timeDistribution: {}
      });

      setGraphStats({
        nodes: 5432,
        relationships: 8765,
        news: 1248,
        companies: 345,
        persons: 567,
        events: 890,
        locations: 234,
        times: 1148
      });

      setRecentNews([
        {
          newsId: '1',
          title: '科技公司发布重大产品更新',
          content: '某知名科技公司今日发布了其旗舰产品的重大更新...',
          timestamp: new Date().toISOString(),
          source: '科技日报',
          news_level: 'Level 2',
          processed: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        },
        {
          newsId: '2',
          title: '经济指标显示积极趋势',
          content: '最新发布的经济数据显示...',
          timestamp: new Date(Date.now() - 1800000).toISOString(),
          source: '财经周刊',
          news_level: 'Level 3',
          processed: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
      ]);

    } catch (err) {
      setError('加载数据失败');
      console.error('Dashboard loading error:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loading size="lg" text="加载数据中..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <ExclamationTriangleIcon className="mx-auto h-12 w-12 text-red-400" />
        <h3 className="mt-2 text-sm font-medium text-gray-900">加载失败</h3>
        <p className="mt-1 text-sm text-gray-500">{error}</p>
        <div className="mt-6">
          <button
            type="button"
            onClick={loadDashboardData}
            className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            重新加载
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">数据概览</h1>
        <p className="mt-1 text-sm text-gray-500">
          实时监控新闻处理和知识图谱构建状态
        </p>
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {/* 新闻总数 */}
        <Card>
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <NewspaperIcon className="h-8 w-8 text-gray-400" />
            </div>
            <div className="ml-5 w-0 flex-1">
              <dl>
                <dt className="text-sm font-medium text-gray-500 truncate">
                  新闻总数
                </dt>
                <dd className="text-2xl font-semibold text-gray-900">
                  {formatNumber(newsStats?.total || 0)}
                </dd>
              </dl>
            </div>
          </div>
        </Card>

        {/* 高级别新闻 */}
        <Card>
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <ExclamationTriangleIcon className="h-8 w-8 text-orange-400" />
            </div>
            <div className="ml-5 w-0 flex-1">
              <dl>
                <dt className="text-sm font-medium text-gray-500 truncate">
                  高级别新闻
                </dt>
                <dd className="text-2xl font-semibold text-gray-900">
                  {formatNumber(newsStats?.highLevel || 0)}
                </dd>
              </dl>
            </div>
          </div>
        </Card>

        {/* 图谱节点 */}
        <Card>
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <ShareIcon className="h-8 w-8 text-blue-400" />
            </div>
            <div className="ml-5 w-0 flex-1">
              <dl>
                <dt className="text-sm font-medium text-gray-500 truncate">
                  图谱节点
                </dt>
                <dd className="text-2xl font-semibold text-gray-900">
                  {formatNumber(graphStats?.nodes || 0)}
                </dd>
              </dl>
            </div>
          </div>
        </Card>

        {/* 图谱关系 */}
        <Card>
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <ChartBarIcon className="h-8 w-8 text-green-400" />
            </div>
            <div className="ml-5 w-0 flex-1">
              <dl>
                <dt className="text-sm font-medium text-gray-500 truncate">
                  图谱关系
                </dt>
                <dd className="text-2xl font-semibold text-gray-900">
                  {formatNumber(graphStats?.relationships || 0)}
                </dd>
              </dl>
            </div>
          </div>
        </Card>
      </div>

      {/* 内容区域 */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* 新闻级别分布 */}
        <Card title="新闻级别分布" subtitle="过去7天的新闻级别统计">
          {newsStats?.levelDistribution && (
            <div className="space-y-3">
              {Object.entries(newsStats.levelDistribution).map(([level, count]) => (
                <div key={level} className="flex items-center justify-between">
                  <div className="flex items-center">
                    <div 
                      className="w-3 h-3 rounded-full mr-2"
                      style={{ backgroundColor: getNewsLevelColor(level) }}
                    />
                    <span className="text-sm font-medium text-gray-900">{level}</span>
                  </div>
                  <span className="text-sm text-gray-500">{count}</span>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* 最新新闻 */}
        <Card title="最新新闻" subtitle="最近处理的新闻">
          <div className="space-y-3">
            {recentNews.map((news) => (
              <div key={news.newsId} className="border-l-4 pl-3" style={{
                borderLeftColor: getNewsLevelColor(news.news_level)
              }}>
                <h4 className="text-sm font-medium text-gray-900 truncate">
                  {news.title}
                </h4>
                <div className="mt-1 flex items-center text-xs text-gray-500">
                  <span>{news.source}</span>
                  <span className="mx-2">•</span>
                  <span>{formatDate(news.timestamp, 'HH:mm')}</span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
