'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { 
  Card,
  Input,
  Button,
  Space,
  DatePicker,
  Select,
  Row,
  Col,
  message,
  Spin,
  Alert,
  Modal
} from 'antd';
import {
  SearchOutlined,
  ReloadOutlined,
  ClearOutlined
} from '@ant-design/icons';
import { Layout } from '../../components/Layout';
import { toAntdValue, fromAntdValue, formatNewsTime, formatTime } from '../../lib/utils/timezone';
import { BEIJING_TIMEZONE } from '@drudge/common';

const { Search } = Input;
const { RangePicker } = DatePicker;
const { Option } = Select;

// 新闻数据接口 - 更新时间字段
interface NewsItem {
  id: string;
  title: string;
  content: string;
  level: string;
  timestamp: string;
  processedAt?: string | number;
  source: string;
  url: string;
  // 使用新的时间工具，这些字段由API自动提供
  timestamp_display?: string;
  processedAt_display?: string;
  processed_at_display?: string;
  // 兼容旧字段
  displayTime: string;
  processedDisplayTime?: string | number;
  highlightedTitle?: string;
  highlightedContent?: string;
  relevanceScore?: number;
}

// 分页信息接口
interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

// API 响应接口
interface NewsResponse {
  success: boolean;
  data: {
    news: NewsItem[];
    pagination: Pagination;
    filters?: any;
    searchParams?: any;
  };
  error?: string;
}

const parseLevelNumber = (level?: string) => {
  if (!level) return null;
  const match = level.match(/\d+/);
  return match ? Number(match[0]) : null;
};

const getProcessedDisplayTime = (news: NewsItem) => {
  if (news.processedAt_display) return news.processedAt_display;
  if (news.processed_at_display) return news.processed_at_display;
  if (news.processedDisplayTime) return formatTime(news.processedDisplayTime as any);
  return news.processedAt ? formatTime(news.processedAt as any) : '';
};

// 新闻卡片组件
interface NewsCardProps {
  news: NewsItem;
  expandedRows: Set<string>;
  onToggleExpand: (newsId: string) => void;
  onShowDetail: (news: NewsItem) => void;
  getLevelColor: (level: string) => string;
  getLevelText: (level: string) => string;
}

function NewsCard({ 
  news, 
  expandedRows, 
  onToggleExpand, 
  onShowDetail, 
  getLevelColor, 
  getLevelText 
}: NewsCardProps) {
  const isExpanded = expandedRows.has(news.id);
  const hasContent = news.content && news.content.length > 0;
  const needsExpansion = hasContent && news.content.length > 300;
  
  const getDisplayContent = () => {
    if (!hasContent) return '暂无内容';
    
    // 如果有高亮内容（搜索结果）
    if (news.highlightedContent) {
      return news.highlightedContent;
    }
    
    // 普通显示逻辑
    if (!needsExpansion || isExpanded) {
      return news.content;
    } else {
      return news.content.substring(0, 300) + '...';
    }
  };

  const levelNumber = parseLevelNumber(news.level);
  const isLevel1 = levelNumber === 1;

    return (
    <Card
      size="small"
      hoverable
      className={isLevel1 ? 'newspaper-card-important' : 'newspaper-card'}
      styles={{
        body: {
          padding: '16px'
        }
      }}
    >
        {/* 标题和级别 */}
        <div style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
            <div className="newspaper-tag" style={{ 
              padding: '2px 8px', 
              fontSize: '11px', 
              fontWeight: 'bold',
                      color: 'var(--newspaper-bg)',
        backgroundColor: getLevelColor(news.level) === 'red' ? 'var(--newspaper-red)' : 'var(--newspaper-gray)'
            }}>
              {getLevelText(news.level)}
            </div>
            <div className="newspaper-body" style={{ fontSize: 'var(--font-size-sm)', color: 'var(--newspaper-gray)' }}>
              📰 {news.source}
            </div>
          </div>
        
        <div 
          className="newspaper-title"
          style={{ 
            margin: 0, 
            lineHeight: '1.4',
            fontSize: isLevel1 ? 'var(--font-size-xl)' : 'var(--font-size-lg)',
            fontWeight: 'bold',
            color: 'var(--newspaper-red)'
          }}
          dangerouslySetInnerHTML={{ 
            __html: news.highlightedTitle || news.title 
          }}
        />
      </div>

      {/* 内容 */}
      <div style={{ marginBottom: 16 }}>
        <div 
          className="newspaper-body"
          style={{ 
            lineHeight: '1.8',
            fontSize: 'var(--font-size-md)',
            color: 'var(--newspaper-text-primary)',
            wordBreak: 'break-word',
            textIndent: '2em'
          }}
          dangerouslySetInnerHTML={{ 
            __html: getDisplayContent()
          }}
        />
      </div>

      {/* 底部操作区 */}
      <div>
        <div className="newspaper-divider" style={{ height: '1px', backgroundColor: 'var(--newspaper-light-gray)', margin: 'var(--space-sm) 0' }}></div>
        
        <Space size="small" style={{ marginBottom: 8 }}>
          {hasContent && needsExpansion && (
            <button 
              onClick={() => onToggleExpand(news.id)}
              className="newspaper-link"
              style={{ 
                background: 'none', 
                border: 'none', 
                padding: 0, 
                fontSize: '12px',
                cursor: 'pointer'
              }}
            >
              📖 {isExpanded ? '收起' : '展开'}
            </button>
          )}
          <button 
            onClick={() => onShowDetail(news)}
            className="newspaper-link"
            style={{ 
              background: 'none', 
              border: 'none', 
              padding: 0, 
              fontSize: '12px',
              cursor: 'pointer'
            }}
          >
            👁️ 详情
          </button>
          {news.url && (
            <a 
              href={news.url}
              target="_blank"
              rel="noopener noreferrer"
              className="newspaper-link"
              style={{ fontSize: 'var(--font-size-base)' }}
            >
              🔗 原文
            </a>
          )}
        </Space>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div className="newspaper-body" style={{ fontSize: 'var(--font-size-xs)', color: 'var(--newspaper-gray)' }}>
            📅 {news.timestamp_display || news.displayTime || formatNewsTime(news.timestamp)}
            {getProcessedDisplayTime(news) && (
              <span style={{ marginLeft: 'var(--space-sm)' }}>
                ⚙️ 处理: {getProcessedDisplayTime(news)}
              </span>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}

export default function NewsPage() {
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [news, setNews] = useState<NewsItem[]>([]);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
    hasNext: false,
    hasPrev: false
  });
  const [beijingNow, setBeijingNow] = useState<Date | null>(null);

  // 新闻详情模态框状态
  const [selectedNews, setSelectedNews] = useState<NewsItem | null>(null);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  
  // 内容展开状态
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  // 搜索状态
  const [searchKeyword, setSearchKeyword] = useState('');
  const [isSearchMode, setIsSearchMode] = useState(false);
  const [filters, setFilters] = useState({
    level: undefined as string | undefined,
    dateRange: undefined as [string, string] | undefined,
    sortBy: 'timestamp' as string,
    sortOrder: 'desc' as string
  });

  // 滚动监听相关
  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const searchKeywordRef = useRef(searchKeyword);
  const searchModeRef = useRef(isSearchMode);

  useEffect(() => {
    searchKeywordRef.current = searchKeyword;
  }, [searchKeyword]);

  useEffect(() => {
    searchModeRef.current = isSearchMode;
  }, [isSearchMode]);

  useEffect(() => {
    const updateTime = () => setBeijingNow(new Date());
    updateTime();
    const interval = setInterval(updateTime, 60000);
    return () => clearInterval(interval);
  }, []);

  // 获取新闻列表
  const fetchNews = useCallback(async (
    page: number = 1,
    searchParams?: Record<string, string>,
    isLoadMore: boolean = false
  ) => {
    if (isLoadMore) {
      setLoadingMore(true);
    } else {
      setLoading(true);
    }
    
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: pagination.limit.toString(),
        sortBy: filters.sortBy,
        sortOrder: filters.sortOrder,
        ...searchParams
      });

      // 添加筛选条件
      if (filters.level) {
        params.append('level', filters.level);
      }

      if (filters.dateRange) {
        params.append('startTime', filters.dateRange[0]);
        params.append('endTime', filters.dateRange[1]);
      }

      const keyword = searchKeywordRef.current;
      const searchMode = searchModeRef.current;
      const url = searchMode && keyword 
        ? `/api/news/search?q=${encodeURIComponent(keyword)}&${params.toString()}`
        : `/api/news?${params.toString()}`;

      const response = await fetch(url);
      const result: NewsResponse = await response.json();

      if (result.success) {
        if (isLoadMore) {
          // 追加数据
          setNews(prevNews => [...prevNews, ...result.data.news]);
        } else {
          // 替换数据（首次加载或刷新）
          setNews(result.data.news);
        }
        setPagination(result.data.pagination);
      } else {
        message.error(result.error || '获取新闻失败');
      }
    } catch (error) {
      console.error('获取新闻失败:', error);
      message.error('网络请求失败');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [
    filters.dateRange,
    filters.level,
    filters.sortBy,
    filters.sortOrder,
    pagination.limit
  ]);

  // 加载更多数据
  const loadMoreNews = useCallback(() => {
    if (loadingMore || !pagination.hasNext) return;
    fetchNews(pagination.page + 1, undefined, true);
  }, [loadingMore, pagination.hasNext, pagination.page, fetchNews]);

  // 搜索新闻
  const handleSearch = (keyword: string) => {
    setSearchKeyword(keyword);
    setIsSearchMode(!!keyword);
    fetchNews(1);
  };

  // 清除搜索
  const clearSearch = () => {
    setSearchKeyword('');
    setIsSearchMode(false);
    fetchNews(1);
  };

  // 清除所有筛选
  const clearAllFilters = () => {
    setFilters({
      level: undefined,
      dateRange: undefined,
      sortBy: 'timestamp',
      sortOrder: 'desc'
    });
    setSearchKeyword('');
    setIsSearchMode(false);
  };

  // 设置滚动监听
  useEffect(() => {
    if (observerRef.current) observerRef.current.disconnect();

    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && pagination.hasNext && !loadingMore) {
          loadMoreNews();
        }
      },
      {
        threshold: 0.1,
        rootMargin: '100px'
      }
    );

    if (loadMoreRef.current && observerRef.current) {
      observerRef.current.observe(loadMoreRef.current);
    }

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [loadMoreNews, pagination.hasNext, loadingMore]);

  // 页面加载时获取数据
  useEffect(() => {
    fetchNews(1);
  }, [fetchNews]);

  // 切换内容展开状态
  const toggleExpanded = (newsId: string) => {
    const newExpandedRows = new Set(expandedRows);
    if (newExpandedRows.has(newsId)) {
      newExpandedRows.delete(newsId);
    } else {
      newExpandedRows.add(newsId);
    }
    setExpandedRows(newExpandedRows);
  };

  // 打开新闻详情模态框
  const showNewsDetail = (newsItem: NewsItem) => {
    setSelectedNews(newsItem);
    setDetailModalVisible(true);
  };

  // 关闭新闻详情模态框
  const closeNewsDetail = () => {
    setSelectedNews(null);
    setDetailModalVisible(false);
  };

  // 级别标签颜色
  const getLevelColor = (level: string) => {
    const levelNumber = parseLevelNumber(level);
    switch (levelNumber) {
      case 1: return 'red';
      case 2: return 'orange';
      case 3: return 'blue';
      default: return 'default';
    }
  };

  // 级别标签文本
  const getLevelText = (level: string) => {
    const levelNumber = parseLevelNumber(level);
    switch (levelNumber) {
      case 1: return '头条新闻';
      case 2: return '重要新闻';
      case 3: return '一般新闻';
      case 4: return '普通新闻';
      case 5: return '信息快讯';
      default: return level ? `${level}级新闻` : '未知级别';
    }
  };

  return (
    <Layout>
      <div className="newspaper-page" style={{ padding: 'var(--space-2xl) var(--space-lg)', maxWidth: '100%', overflow: 'hidden' }}>
        {/* 传统报纸头部 */}
        <div className="newspaper-header-frame" style={{ marginBottom: 'var(--space-2xl)' }}>
          <div style={{ textAlign: 'center' }}>
            <div className="newspaper-title newspaper-title-large">
              📰 长婷报社 • 新闻浏览
            </div>
            <div className="newspaper-subtitle" style={{ fontSize: 'var(--font-size-xl)', marginBottom: 'var(--space-md)' }}>
              传统报纸式新闻阅读体验 • 智能检索与筛选
            </div>
            <div className="newspaper-time">
              {beijingNow
                ? beijingNow.toLocaleString('zh-CN', { timeZone: BEIJING_TIMEZONE })
                : '加载中'}{' '}
              • 实时更新
            </div>
          </div>
        </div>
        
        {/* 搜索和筛选区域 */}
        <div style={{ marginBottom: '24px' }}>
          <div className="newspaper-section-header" style={{ marginBottom: '16px' }}>
            📋 新闻检索台 • 智能搜索
          </div>
          
          <Card className="newspaper-card" style={{ marginBottom: 16 }}>
            <Row gutter={[20, 16]}>
              <Col xs={24} lg={8}>
                <div className="newspaper-body newspaper-body-no-indent" style={{ fontSize: '13px', marginBottom: '8px' }}>
                  <strong>关键词搜索：</strong>
                </div>
                <Search
                  className="newspaper-search"
                  placeholder="搜索新闻标题或内容..."
                  value={searchKeyword}
                  onChange={(e) => setSearchKeyword(e.target.value)}
                  onSearch={handleSearch}
                  id="news-search"
                  aria-label="新闻关键词搜索"
                  enterButton={
                    <Button className="newspaper-button" icon={<SearchOutlined className="newspaper-icon" />}>
                      搜索
                    </Button>
                  }
                  allowClear
                />
              </Col>
              
              <Col xs={12} sm={8} lg={4}>
                <div className="newspaper-body newspaper-body-no-indent" style={{ fontSize: '13px', marginBottom: '8px' }}>
                  <strong>新闻级别：</strong>
                </div>
                <Select
                  className="newspaper-search"
                  id="news-level"
                  aria-label="新闻级别筛选"
                  placeholder="选择级别"
                  value={filters.level}
                  onChange={(value) => setFilters(prev => ({ ...prev, level: value }))}
                  allowClear
                  style={{ width: '100%' }}
                >
                  <Option value="Level 1">头条新闻</Option>
                  <Option value="Level 2">重要新闻</Option>
                  <Option value="Level 3">一般新闻</Option>
                  <Option value="Level 4">普通新闻</Option>
                  <Option value="Level 5">信息快讯</Option>
                </Select>
              </Col>
            
              <Col xs={12} sm={16} lg={8}>
                <div className="newspaper-body newspaper-body-no-indent" style={{ fontSize: '13px', marginBottom: '8px' }}>
                  <strong>时间范围：</strong>
                </div>
                <RangePicker
                  className="newspaper-search"
                  id="news-date-range"
                  aria-label="新闻时间范围筛选"
                  value={
                    filters.dateRange
                      ? ([
                          toAntdValue(filters.dateRange[0]),
                          toAntdValue(filters.dateRange[1])
                        ] as any)
                      : null
                  }
                  onChange={(dates) => {
                    if (dates && dates[0] && dates[1]) {
                      const startTime = fromAntdValue(dates[0] as any);
                      const endTime = fromAntdValue(dates[1] as any);

                      if (!startTime || !endTime) {
                        setFilters(prev => ({ ...prev, dateRange: undefined }));
                        return;
                      }

                      setFilters(prev => ({ 
                        ...prev, 
                        dateRange: [
                          startTime,
                          endTime
                        ] as [string, string]
                      }));
                    } else {
                      setFilters(prev => ({ ...prev, dateRange: undefined }));
                    }
                  }}
                  placeholder={['开始时间', '结束时间']}
                  style={{ width: '100%' }}
                  showTime
                />
              </Col>
              
              <Col xs={24} lg={4}>
                <div className="newspaper-body newspaper-body-no-indent" style={{ fontSize: '13px', marginBottom: '8px' }}>
                  <strong>操作：</strong>
                </div>
                <Space style={{ width: '100%', justifyContent: 'flex-start' }}>
                  <Button 
                    className="newspaper-button"
                    icon={<ReloadOutlined className="newspaper-icon" />} 
                    onClick={() => fetchNews(1)}
                    loading={loading}
                  >
                    刷新
                  </Button>
                  <Button 
                    className="newspaper-button-secondary"
                    icon={<ClearOutlined className="newspaper-icon" />} 
                  onClick={clearAllFilters}
                >
                  清除
                </Button>
              </Space>
            </Col>
          </Row>
          
          {/* 搜索状态提示 */}
          {isSearchMode && (
            <Alert
              style={{ 
                marginTop: 16, 
                backgroundColor: 'var(--newspaper-beige)',
                border: '1px solid var(--newspaper-light-gray)',
                borderRadius: 0
              }}
              message={
                <span className="newspaper-subtitle">
                  🔍 搜索关键词: "{searchKeyword}"
                </span>
              }
              type="info"
              showIcon
              closable
              onClose={clearSearch}
            />
          )}
        </Card>
        </div>

        {/* 结果统计 */}
        {!loading && (
          <div className="newspaper-stats" style={{ marginBottom: 16, padding: '12px 20px', textAlign: 'center' }}>
            <div className="newspaper-subtitle" style={{ fontSize: '15px' }}>
              📊 新闻统计：共检索到 <span style={{ color: 'var(--newspaper-red)', fontWeight: 'bold' }}>{pagination.total}</span> 条新闻
              {(() => {
                const level1Count = news.filter(item => parseLevelNumber(item.level) === 1).length;
                return level1Count > 0 && (
                  <span>，其中头条新闻 <span style={{ color: 'var(--newspaper-red)', fontWeight: 'bold' }}>{level1Count}</span> 条</span>
                );
              })()}
            </div>
            {(isSearchMode || filters.level || filters.dateRange) && (
              <div className="newspaper-body" style={{ fontSize: '13px', marginTop: '8px' }}>
                {isSearchMode && <span>🔍 搜索关键词："{searchKeyword}" </span>}
                {filters.level && <span>📑 级别筛选：{getLevelText(filters.level)} </span>}
                {filters.dateRange && (
                  <span>
                    📅 时间范围：
                    {formatTime(filters.dateRange[0], 'MM-DD HH:mm')} ~{' '}
                    {formatTime(filters.dateRange[1], 'MM-DD HH:mm')}
                  </span>
                )}
              </div>
            )}
          </div>
        )}

        {/* 新闻卡片列表 - 瀑布流布局 */}
        <div style={{ marginBottom: 24 }}>
          <div className="newspaper-subtitle" style={{ fontSize: '18px', textAlign: 'center', marginBottom: '16px' }}>
            📰 新闻版面
          </div>
          <div className="newspaper-divider" style={{ height: '1px', backgroundColor: 'var(--newspaper-light-gray)', margin: '12px 0' }}></div>
          
          <Spin spinning={loading}>
            <div className="masonry-container">
              {news.map((item) => (
                <div 
                  key={item.id}
                  className="masonry-item"
                >
                  <NewsCard 
                    news={item}
                    expandedRows={expandedRows}
                    onToggleExpand={toggleExpanded}
                    onShowDetail={showNewsDetail}
                    getLevelColor={getLevelColor}
                    getLevelText={getLevelText}
                  />
                </div>
              ))}
            </div>
            
            {/* 无数据提示 */}
            {!loading && news.length === 0 && (
              <div style={{ textAlign: 'center', padding: '40px 0', backgroundColor: 'var(--newspaper-paper)', border: '1px solid var(--newspaper-light-gray)' }}>
                <div className="newspaper-subtitle" style={{ fontSize: '16px' }}>
                  📄 暂无新闻数据
                </div>
                <div className="newspaper-body" style={{ fontSize: '14px', marginTop: '8px' }}>
                  请调整搜索条件或稍后再试
                </div>
              </div>
            )}
          </Spin>
        </div>

        {/* 加载更多区域 */}
        {news.length > 0 && (
          <div ref={loadMoreRef} style={{ textAlign: 'center', padding: '20px 0' }}>
            {pagination.hasNext ? (
              <div>
                {loadingMore ? (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
                    <Spin />
                    <div className="newspaper-body" style={{ fontSize: '14px', color: 'var(--newspaper-gray)' }}>
                      📥 正在加载更多新闻...
                    </div>
                  </div>
                ) : (
                  <div>
                    <Button 
                      className="newspaper-button"
                      onClick={loadMoreNews}
                      size="large"
                      style={{ marginBottom: '12px' }}
                    >
                      📖 加载更多新闻
                    </Button>
                    <div className="newspaper-body" style={{ fontSize: '13px', color: 'var(--newspaper-gray)' }}>
                      已显示 {news.length} 条，共 {pagination.total} 条新闻
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div style={{ 
                padding: '20px', 
                backgroundColor: 'var(--newspaper-beige)', 
                border: '1px solid var(--newspaper-light-gray)',
                borderRadius: '4px'
              }}>
                <div className="newspaper-subtitle" style={{ fontSize: '16px', marginBottom: '8px' }}>
                  📰 所有新闻已加载完毕
                </div>
                <div className="newspaper-body" style={{ fontSize: '14px' }}>
                  共 {news.length} 条新闻，感谢您的阅读！
                </div>
              </div>
            )}
          </div>
        )}

        {/* 新闻详情模态框 */}
        <Modal
          title={
            <div className="newspaper-title" style={{ fontSize: '18px', textAlign: 'center' }}>
              📰 新闻详情
            </div>
          }
          open={detailModalVisible}
          onCancel={closeNewsDetail}
          footer={[
            <Button key="close" className="newspaper-button" onClick={closeNewsDetail}>
              关闭
            </Button>,
            selectedNews?.url && (
              <Button 
                key="original" 
                className="newspaper-button"
                href={selectedNews.url}
                target="_blank"
              >
                🔗 查看原文
              </Button>
            )
          ]}
          width={800}
          style={{ 
            top: 20,
            backgroundColor: 'var(--newspaper-bg)'
          }}
          styles={{
            body: {
              backgroundColor: 'var(--newspaper-paper)',
              padding: '24px'
            },
            header: {
              backgroundColor: 'var(--newspaper-beige)',
              borderBottom: '2px solid var(--newspaper-red)'
            }
          }}
        >
          {selectedNews && (
            <div>
              <div style={{ 
                marginBottom: 20, 
                padding: '16px', 
                backgroundColor: 'var(--newspaper-beige)',
                border: '1px solid var(--newspaper-light-gray)'
              }}>
                <div className="newspaper-subtitle" style={{ fontSize: '14px', marginBottom: '12px', textAlign: 'center' }}>
                  📋 新闻信息
                </div>
                <div className="newspaper-body" style={{ fontSize: '13px', lineHeight: '2' }}>
                  <div><strong>新闻编号：</strong>{selectedNews.id}</div>
                  <div><strong>新闻级别：</strong>
                    <span className="newspaper-tag" style={{
                      backgroundColor: getLevelColor(selectedNews.level) === 'red' ? 'var(--newspaper-red)' : 'var(--newspaper-gray)',
                      color: 'var(--newspaper-bg)',
                      padding: '2px 6px',
                      marginLeft: '8px',
                      fontSize: '11px'
                    }}>
                      {getLevelText(selectedNews.level)}
                    </span>
                  </div>
                  <div><strong>新闻来源：</strong>📰 {selectedNews.source}</div>
                  <div><strong>发布时间：</strong>📅 {selectedNews.timestamp_display || selectedNews.displayTime || formatTime(selectedNews.timestamp)}</div>
                  <div><strong>处理时间：</strong>⚙️ {getProcessedDisplayTime(selectedNews) || '未知'}</div>
                </div>
              </div>

              <div style={{ marginBottom: 20 }}>
                <div className="newspaper-subtitle" style={{ fontSize: '16px', marginBottom: '12px', textAlign: 'center' }}>
                  📖 新闻标题
                </div>
                <div 
                  className="newspaper-title"
                  style={{ 
                    padding: '16px',
                    backgroundColor: 'var(--newspaper-paper)',
                    border: '2px solid var(--newspaper-red)',
                    fontSize: '18px',
                    fontWeight: 'bold',
                    color: 'var(--newspaper-red)',
                    textAlign: 'center',
                    lineHeight: '1.4'
                  }}
                  dangerouslySetInnerHTML={{ 
                    __html: selectedNews.highlightedTitle || selectedNews.title 
                  }}
                />
              </div>

              <div>
                <div className="newspaper-subtitle" style={{ fontSize: '16px', marginBottom: '12px', textAlign: 'center' }}>
                  📄 新闻内容
                </div>
                <div 
                  className="newspaper-body"
                  style={{ 
                    padding: '20px',
                    backgroundColor: 'var(--newspaper-paper)',
                    border: '1px solid var(--newspaper-light-gray)',
                    lineHeight: '2',
                    fontSize: '14px',
                    maxHeight: '400px',
                    overflowY: 'auto',
                    wordBreak: 'break-word',
                    textIndent: '2em',
                    color: 'var(--newspaper-text-primary)'
                  }}
                  dangerouslySetInnerHTML={{ 
                    __html: selectedNews.content || '暂无内容' 
                  }}
                />
              </div>
            </div>
          )}
        </Modal>
      </div>
    </Layout>
  );
} 
