'use client';

import { useState, useEffect } from 'react';
import { 
  Card,
  Input,
  Button,
  Space,
  Tag,
  DatePicker,
  Select,
  Row,
  Col,
  Typography,
  message,
  Tooltip,
  Spin,
  Alert,
  Modal,
  Descriptions
} from 'antd';
import {
  SearchOutlined,
  ReloadOutlined,
  ClearOutlined,
  EyeOutlined,
  LinkOutlined,
  CalendarOutlined
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
      className="news-card-enter"
      style={{ 
        marginBottom: '16px',
        border: isLevel1 ? '2px solid #ff4d4f' : '1px solid #d9d9d9',
        boxShadow: isLevel1 ? '0 6px 16px rgba(255, 77, 79, 0.2)' : '0 2px 8px rgba(0, 0, 0, 0.06)',
        background: isLevel1 ? 'linear-gradient(135deg, #fff2f0 0%, #ffffff 100%)' : '#ffffff',
        position: 'relative',
        transition: 'all 0.3s ease',
        animation: isLevel1 ? 'pulse-border 2s infinite' : undefined,
        transform: isLevel1 ? 'scale(1.02)' : 'scale(1)'
      }}
      styles={{
        body: {
          padding: '16px'
        }
      }}
          >
        {/* Level 1 特殊标识 */}
        {isLevel1 && (
          <>
            {/* 左侧红色条带 */}
            <div style={{
              position: 'absolute',
              left: '-2px',
              top: '-2px',
              bottom: '-2px',
              width: '4px',
              background: 'linear-gradient(180deg, #ff4d4f 0%, #cf1322 100%)',
              borderRadius: '2px 0 0 2px',
              zIndex: 1
            }} />
            
            {/* 右上角标识 */}
            <div style={{
              position: 'absolute',
              top: '-1px',
              right: '-1px',
              background: '#ff4d4f',
              color: 'white',
              padding: '2px 8px',
              fontSize: '10px',
              fontWeight: 'bold',
              borderRadius: '0 6px 0 6px',
              zIndex: 1
            }}>
              ⚡ 重要
            </div>
          </>
        )}

        {/* 标题和级别 */}
        <div style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
            <Tag color={getLevelColor(news.level)} style={{ margin: 0 }}>
              {getLevelText(news.level)}
            </Tag>
            <Text type="secondary" style={{ fontSize: '12px' }}>
              {news.source}
            </Text>
          </div>
        
        <div 
          style={{ 
            margin: 0, 
            lineHeight: '1.4',
            fontSize: isLevel1 ? '15px' : '14px',
            fontWeight: isLevel1 ? 600 : 500,
            color: isLevel1 ? '#d4380d' : '#262626'
          }}
          dangerouslySetInnerHTML={{ 
            __html: news.highlightedTitle || news.title 
          }}
        />
      </div>

      {/* 内容 */}
      <div style={{ marginBottom: 16 }}>
        <div 
          style={{ 
            lineHeight: '1.5',
            fontSize: '13px',
            color: '#666',
            wordBreak: 'break-word'
          }}
          dangerouslySetInnerHTML={{ 
            __html: getDisplayContent()
          }}
        />
      </div>

      {/* 底部操作区 */}
      <div>
        <Space size="small" style={{ marginBottom: 8 }}>
          {hasContent && needsExpansion && (
            <Button 
              type="link" 
              size="small"
              onClick={() => onToggleExpand(news.id)}
              style={{ padding: 0, height: 'auto', fontSize: '12px' }}
            >
              {isExpanded ? '收起' : '展开'}
            </Button>
          )}
          <Button 
            type="link" 
            size="small"
            icon={<EyeOutlined />}
            onClick={() => onShowDetail(news)}
            style={{ padding: 0, height: 'auto', fontSize: '12px' }}
          >
            详情
          </Button>
          {news.url && (
            <Button 
              type="link" 
              size="small" 
              icon={<LinkOutlined />}
              href={news.url}
              target="_blank"
              style={{ padding: 0, height: 'auto', fontSize: '12px' }}
            >
              原文
            </Button>
          )}
        </Space>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Tooltip title={`处理时间: ${news.processedDisplayTime || '未知'}`}>
            <Text type="secondary" style={{ fontSize: '11px' }}>
              <CalendarOutlined style={{ marginRight: 4 }} />
              {news.displayTime}
            </Text>
          </Tooltip>
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
      case '1': return 'Level 1';
      case '2': return 'Level 2';
      case '3': return 'Level 3';
      default: return `Level ${level}`;
    }
  };

  return (
    <Layout>
      <style dangerouslySetInnerHTML={{
        __html: `
          @keyframes pulse-border {
            0% { 
              box-shadow: 0 6px 16px rgba(255, 77, 79, 0.2), 0 0 0 0 rgba(255, 77, 79, 0.3);
            }
            50% { 
              box-shadow: 0 6px 16px rgba(255, 77, 79, 0.2), 0 0 0 4px rgba(255, 77, 79, 0.1);
            }
            100% { 
              box-shadow: 0 6px 16px rgba(255, 77, 79, 0.2), 0 0 0 0 rgba(255, 77, 79, 0.3);
            }
          }
          
          @keyframes slide-in {
            0% {
              opacity: 0;
              transform: translateY(20px) scale(0.95);
            }
            100% {
              opacity: 1;
              transform: translateY(0) scale(1);
            }
          }
          
          .news-card-enter {
            animation: slide-in 0.3s ease-out;
          }
          
          .masonry-container {
            column-count: auto;
            column-width: 300px;
            column-gap: 16px;
            column-fill: balance;
          }
          
          @media (max-width: 768px) {
            .masonry-container {
              column-width: 100%;
              column-count: 1;
            }
          }
          
          @media (min-width: 769px) and (max-width: 1024px) {
            .masonry-container {
              column-width: 280px;
            }
          }
          
          @media (min-width: 1025px) and (max-width: 1440px) {
            .masonry-container {
              column-width: 300px;
            }
          }
          
          @media (min-width: 1441px) {
            .masonry-container {
              column-width: 320px;
            }
          }
        `
      }} />
      <div style={{ padding: '16px 24px', maxWidth: '100%', overflow: 'hidden' }}>
        <Title level={2}>新闻浏览</Title>
        
        {/* 搜索和筛选区域 */}
        <Card style={{ marginBottom: 16 }}>
          <Row gutter={[16, 16]}>
            <Col xs={24} lg={8}>
              <Search
                placeholder="搜索新闻标题或内容..."
                value={searchKeyword}
                onChange={(e) => setSearchKeyword(e.target.value)}
                onSearch={handleSearch}
                enterButton={<SearchOutlined />}
                allowClear
              />
            </Col>
            
            <Col xs={12} sm={8} lg={4}>
              <Select
                placeholder="选择新闻级别"
                value={filters.level}
                onChange={(value) => setFilters(prev => ({ ...prev, level: value }))}
                allowClear
                style={{ width: '100%' }}
              >
                <Option value="1">Level 1</Option>
                <Option value="2">Level 2</Option>
                <Option value="3">Level 3</Option>
              </Select>
            </Col>
            
            <Col xs={12} sm={16} lg={8}>
              <RangePicker
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
              <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
                <Button 
                  icon={<ReloadOutlined />} 
                  onClick={() => fetchNews(pagination.page)}
                  loading={loading}
                >
                  刷新
                </Button>
                <Button 
                  icon={<ClearOutlined />} 
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
              style={{ marginTop: 16 }}
              message={`搜索关键词: "${searchKeyword}"`}
              type="info"
              showIcon
              closable
              onClose={clearSearch}
            />
          )}
        </Card>

        {/* 结果统计 */}
        {!loading && (
          <div style={{ marginBottom: 16, padding: '8px 16px', backgroundColor: '#f5f5f5', borderRadius: '6px' }}>
            <Text type="secondary">
              共找到 <Text strong>{pagination.total}</Text> 条新闻
              {(() => {
                const level1Count = news.filter(item => item.level === '1').length;
                return level1Count > 0 && (
                  <Text>，其中 <Text strong style={{ color: '#ff4d4f' }}>{level1Count}</Text> 条重要新闻</Text>
                );
              })()}
              {isSearchMode && <Text>，搜索关键词："<Text code>{searchKeyword}</Text>"</Text>}
              {filters.level && <Text>，级别：<Tag color={getLevelColor(filters.level)}>{getLevelText(filters.level)}</Tag></Text>}
              {filters.dateRange && <Text>，时间范围：{filters.dateRange[0].format('MM-DD HH:mm')} ~ {filters.dateRange[1].format('MM-DD HH:mm')}</Text>}
            </Text>
          </div>
        )}

        {/* 新闻卡片列表 - 瀑布流布局 */}
        <div style={{ marginBottom: 24 }}>
          <Spin spinning={loading}>
            <div className="masonry-container">
              {news.map((item) => (
                <div 
                  key={item.id}
                  style={{
                    breakInside: 'avoid',
                    pageBreakInside: 'avoid',
                    display: 'inline-block',
                    width: '100%'
                  }}
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
              <div style={{ textAlign: 'center', padding: '40px 0' }}>
                <Typography.Text type="secondary">暂无新闻数据</Typography.Text>
              </div>
            )}
          </Spin>
        </div>

        {/* 分页 */}
        {news.length > 0 && (
          <Card>
            <Row justify="center">
              <Col>
                <Space direction="vertical" align="center" size="small">
                  <Text type="secondary">
                    第 {((pagination.page - 1) * pagination.limit) + 1}-{Math.min(pagination.page * pagination.limit, pagination.total)} 条，共 {pagination.total} 条新闻
                  </Text>
                  <Space>
                    <Button 
                      disabled={!pagination.hasPrev}
                      onClick={() => fetchNews(pagination.page - 1)}
                    >
                      上一页
                    </Button>
                    <Text>{pagination.page} / {pagination.totalPages}</Text>
                    <Button 
                      disabled={!pagination.hasNext}
                      onClick={() => fetchNews(pagination.page + 1)}
                    >
                      下一页
                    </Button>
                  </Space>
                  <Space>
                    <Text>每页显示：</Text>
                    <Select
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
            <Space>
              <EyeOutlined />
              新闻详情
            </Space>
          }
          open={detailModalVisible}
          onCancel={closeNewsDetail}
          footer={[
            <Button key="close" onClick={closeNewsDetail}>
              关闭
            </Button>,
            selectedNews?.url && (
              <Button 
                key="original" 
                type="primary"
                icon={<LinkOutlined />}
                href={selectedNews.url}
                target="_blank"
              >
                查看原文
              </Button>
            )
          ]}
          width={800}
          style={{ top: 20 }}
        >
          {selectedNews && (
            <div>
              <Descriptions 
                bordered 
                column={1} 
                size="small"
                style={{ marginBottom: 16 }}
              >
                <Descriptions.Item label="新闻ID">
                  {selectedNews.id}
                </Descriptions.Item>
                <Descriptions.Item label="级别">
                  <Tag color={getLevelColor(selectedNews.level)}>
                    {getLevelText(selectedNews.level)}
                  </Tag>
                </Descriptions.Item>
                <Descriptions.Item label="来源">
                  {selectedNews.source}
                </Descriptions.Item>
                <Descriptions.Item label="发布时间">
                  {selectedNews.displayTime}
                </Descriptions.Item>
                <Descriptions.Item label="处理时间">
                  {selectedNews.processedDisplayTime || '未知'}
                </Descriptions.Item>
              </Descriptions>

              <div style={{ marginBottom: 16 }}>
                <Typography.Title level={4}>标题</Typography.Title>
                <div 
                  style={{ 
                    padding: '12px',
                    backgroundColor: '#f5f5f5',
                    borderRadius: '6px',
                    fontSize: '16px',
                    fontWeight: 500
                  }}
                  dangerouslySetInnerHTML={{ 
                    __html: selectedNews.highlightedTitle || selectedNews.title 
                  }}
                />
              </div>

              <div>
                <Typography.Title level={4}>内容</Typography.Title>
                <div 
                  style={{ 
                    padding: '16px',
                    backgroundColor: '#fafafa',
                    borderRadius: '6px',
                    lineHeight: '1.6',
                    maxHeight: '400px',
                    overflowY: 'auto',
                    wordBreak: 'break-word'
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