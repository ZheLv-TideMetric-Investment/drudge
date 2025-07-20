'use client';

import { useState, useEffect } from 'react';
import { 
  Card,
  Input,
  Button,
  Space,
  DatePicker,
  Select,
  Row,
  Col,
  Typography,
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
import moment, { Moment } from 'moment-timezone';

const { Search } = Input;
const { RangePicker } = DatePicker;
const { Option } = Select;
const { Title, Text } = Typography;

// 新闻数据接口
interface NewsItem {
  id: string;
  title: string;
  content: string;
  level: string;
  timestamp: string;
  processedAt: string;
  source: string;
  url: string;
  displayTime: string;
  processedDisplayTime: string;
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

  const isLevel1 = news.level === '1';

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
            <div className="newspaper-body" style={{ fontSize: '11px', color: 'var(--newspaper-gray)' }}>
              📰 {news.source}
            </div>
          </div>
        
        <div 
          className="newspaper-title"
          style={{ 
            margin: 0, 
            lineHeight: '1.4',
            fontSize: isLevel1 ? '16px' : '15px',
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
            fontSize: '13px',
            color: '#000000',
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
        <div className="newspaper-divider" style={{ height: '1px', backgroundColor: 'var(--newspaper-light-gray)', margin: '8px 0' }}></div>
        
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
              style={{ fontSize: '12px' }}
            >
              🔗 原文
            </a>
          )}
        </Space>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div className="newspaper-body" style={{ fontSize: '10px', color: 'var(--newspaper-gray)' }}>
            📅 {news.displayTime}
            {news.processedDisplayTime && (
              <span style={{ marginLeft: '8px' }}>
                ⚙️ 处理: {news.processedDisplayTime}
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
  const [news, setNews] = useState<NewsItem[]>([]);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
    hasNext: false,
    hasPrev: false
  });

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
    dateRange: undefined as [Moment, Moment] | undefined,
    sortBy: 'timestamp' as string,
    sortOrder: 'desc' as string
  });

  // 获取新闻列表
  const fetchNews = async (page: number = 1, searchParams?: any) => {
    setLoading(true);
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
        params.append('startTime', filters.dateRange[0].toISOString());
        params.append('endTime', filters.dateRange[1].toISOString());
      }

      const url = isSearchMode && searchKeyword 
        ? `/api/news/search?q=${encodeURIComponent(searchKeyword)}&${params.toString()}`
        : `/api/news?${params.toString()}`;

      const response = await fetch(url);
      const result: NewsResponse = await response.json();

      if (result.success) {
        setNews(result.data.news);
        setPagination(result.data.pagination);
      } else {
        message.error(result.error || '获取新闻失败');
      }
    } catch (error) {
      console.error('获取新闻失败:', error);
      message.error('网络请求失败');
    } finally {
      setLoading(false);
    }
  };

  // 搜索新闻
  const handleSearch = (keyword: string) => {
    setSearchKeyword(keyword);
    setIsSearchMode(!!keyword);
    if (keyword) {
      fetchNews(1);
    } else {
      fetchNews(1);
    }
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

  // 页面加载时获取数据
  useEffect(() => {
    fetchNews(1);
  }, [filters]);

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
    switch (level) {
      case '1': return 'red';
      case '2': return 'orange';
      case '3': return 'blue';
      default: return 'default';
    }
  };

  // 级别标签文本
  const getLevelText = (level: string) => {
    switch (level) {
      case '1': return '头条新闻';
      case '2': return '重要新闻';
      case '3': return '一般新闻';
      default: return `${level}级新闻`;
    }
  };

  return (
    <Layout>

      <div className="newspaper-page" style={{ padding: '24px 16px', maxWidth: '100%', overflow: 'hidden' }}>
        {/* 传统报纸头部 */}
        <div className="newspaper-header-frame" style={{ marginBottom: '24px' }}>
          <div style={{ textAlign: 'center' }}>
            <div className="newspaper-title newspaper-title-large">
              📰 长婷 • 新闻浏览
            </div>
            <div className="newspaper-subtitle" style={{ fontSize: '16px', marginBottom: '12px' }}>
              传统报纸式新闻阅读体验 • 智能检索与筛选
            </div>
            <div className="newspaper-time">
              {new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })} • 实时更新
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
                  placeholder="选择级别"
                  value={filters.level}
                  onChange={(value) => setFilters(prev => ({ ...prev, level: value }))}
                  allowClear
                  style={{ width: '100%' }}
                >
                  <Option value="1">头条新闻</Option>
                  <Option value="2">重要新闻</Option>
                  <Option value="3">一般新闻</Option>
                </Select>
              </Col>
            
              <Col xs={12} sm={16} lg={8}>
                <div className="newspaper-body newspaper-body-no-indent" style={{ fontSize: '13px', marginBottom: '8px' }}>
                  <strong>时间范围：</strong>
                </div>
                <RangePicker
                  className="newspaper-search"
                  value={filters.dateRange ? [
                    moment(filters.dateRange[0].toISOString()) as any, 
                    moment(filters.dateRange[1].toISOString()) as any
                  ] : null}
                  onChange={(dates) => {
                    if (dates && dates[0] && dates[1]) {
                      setFilters(prev => ({ 
                        ...prev, 
                        dateRange: [
                          moment(dates[0]!.toISOString()), 
                          moment(dates[1]!.toISOString())
                        ] as [Moment, Moment] 
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
                    onClick={() => fetchNews(pagination.page)}
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
                const level1Count = news.filter(item => item.level === '1').length;
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
                  <span>📅 时间范围：{filters.dateRange[0].format('MM-DD HH:mm')} ~ {filters.dateRange[1].format('MM-DD HH:mm')}</span>
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

        {/* 分页 */}
        {news.length > 0 && (
          <Card style={{ backgroundColor: 'var(--newspaper-paper)', border: '2px solid var(--newspaper-red)' }}>
            <Row justify="center">
              <Col>
                <Space direction="vertical" align="center" size="small">
                  <div className="newspaper-subtitle" style={{ fontSize: '14px', textAlign: 'center' }}>
                    📃 第 {((pagination.page - 1) * pagination.limit) + 1}-{Math.min(pagination.page * pagination.limit, pagination.total)} 条，共 {pagination.total} 条新闻
                  </div>
                  <Space>
                    <Button 
                      className="newspaper-button"
                      disabled={!pagination.hasPrev}
                      onClick={() => fetchNews(pagination.page - 1)}
                    >
                      ◀ 上一页
                    </Button>
                    <div className="newspaper-body" style={{ fontSize: '14px', fontWeight: 'bold', color: 'var(--newspaper-red)' }}>
                      {pagination.page} / {pagination.totalPages}
                    </div>
                    <Button 
                      className="newspaper-button"
                      disabled={!pagination.hasNext}
                      onClick={() => fetchNews(pagination.page + 1)}
                    >
                      下一页 ▶
                    </Button>
                  </Space>
                  <Space>
                    <div className="newspaper-body" style={{ fontSize: '13px' }}>每页显示：</div>
                    <Select
                      className="newspaper-search"
                      value={pagination.limit}
                      onChange={(value) => {
                        setPagination(prev => ({ ...prev, limit: value }));
                        fetchNews(1);
                      }}
                      style={{ width: 80 }}
                    >
                      <Option value={10}>10</Option>
                      <Option value={20}>20</Option>
                      <Option value={50}>50</Option>
                      <Option value={100}>100</Option>
                    </Select>
                  </Space>
                </Space>
              </Col>
            </Row>
          </Card>
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
                  <div><strong>发布时间：</strong>📅 {selectedNews.displayTime}</div>
                  <div><strong>处理时间：</strong>⚙️ {selectedNews.processedDisplayTime || '未知'}</div>
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
                    color: '#000000'
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