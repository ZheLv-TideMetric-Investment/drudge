'use client';

import { useState, useEffect } from 'react';
import { NodeType, NODE_TYPE_DESCRIPTIONS } from '../../../constants/enums';
import { 
  Card, 
  Row, 
  Col, 
  Spin, 
  Alert, 
  Statistic, 
  Typography, 
  Space,
  Table,
  Tag,
  Progress,
  Button
} from 'antd';
import {
  DatabaseOutlined,
  FileTextOutlined,
  TeamOutlined,
  BankOutlined,
  EnvironmentOutlined,
  FlagOutlined,
  NodeIndexOutlined,
  ReloadOutlined,
  ClockCircleOutlined,
  BarChartOutlined
} from '@ant-design/icons';
import { Layout } from '../../components/Layout';

const { Title, Text } = Typography;

interface NodeStatsRecord {
  key: string;
  nodeType: NodeType;
  count: number;
  name: string;
  percentage: string;
}

interface RelationshipRecord {
  key: string;
  relationType: string;
  count: number;
  percentage: string;
}

interface TimeStatsData {
  todayHourly: Array<{
    hour: number;
    newsCount: number;
    highLevelCount: number;
    time: string;
  }>;
  daily: Array<{
    date: string;
    dateDisplay: string;
    newsCount: number;
    highLevelCount: number;
  }>;
  metadata: {
    todayStart: string;
    yesterdayStart: string;
    sevenDaysAgo: string;
  };
}

interface GraphStatsData {
  overview: {
    totalNodes: number;
    relationships: number;
    news: number;
    companies: number;
    persons: number;
    organizations: number;
    locations: number;
    events: number;
  };
  relationshipDistribution: Record<string, number>;
  timeStats: TimeStatsData;
}

export default function StatsPage() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<GraphStatsData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // 直接使用原生fetch
      const response = await fetch('/api/graph/stats');
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const result = await response.json();
      
      if (result.success && result.data) {
        setData(result.data);
      } else {
        setError(result.error || '获取统计数据失败');
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '网络请求失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const getNodeIcon = (nodeType: NodeType) => {
    const iconMap: Record<NodeType, React.ReactNode> = {
        [NodeType.NEWS]: <FileTextOutlined className="newspaper-icon" />,
  [NodeType.EVENT]: <FlagOutlined className="newspaper-icon" />,
  [NodeType.COMPANY]: <BankOutlined className="newspaper-icon" />,
  [NodeType.PERSON]: <TeamOutlined className="newspaper-icon" />,
  [NodeType.ORGANIZATION]: <NodeIndexOutlined className="newspaper-icon" />,
  [NodeType.LOCATION]: <EnvironmentOutlined className="newspaper-icon" />,
    };
    return iconMap[nodeType] || <DatabaseOutlined />;
  };

  const getNodeColor = (nodeType: NodeType) => {
    const colorMap: Record<NodeType, string> = {
      [NodeType.NEWS]: 'var(--newspaper-blue)',
      [NodeType.EVENT]: 'var(--newspaper-red)',
      [NodeType.COMPANY]: 'var(--newspaper-green)',
      [NodeType.PERSON]: 'var(--newspaper-accent)',
      [NodeType.ORGANIZATION]: 'var(--newspaper-muted)',
      [NodeType.LOCATION]: 'var(--newspaper-gray)',
    };
    return colorMap[nodeType] || 'var(--newspaper-gray)';
  };

  // 节点表格列定义
  const nodeColumns = [
    {
      title: '节点类型',
      dataIndex: 'nodeType',
      key: 'nodeType',
      render: (type: NodeType, record: NodeStatsRecord) => (
        <Space>
          <div className="newspaper-tag" style={{
            backgroundColor: getNodeColor(record.nodeType),
            color: 'var(--newspaper-bg)',
            padding: '2px 6px',
            fontSize: '11px'
          }}>
            {getNodeIcon(record.nodeType)}
          </div>
          <span className="newspaper-body" style={{ fontWeight: 'bold' }}>{record.name}</span>
        </Space>
      ),
    },
    {
      title: '数量',
      dataIndex: 'count',
      key: 'count',
      render: (count: number) => (
        <div className="newspaper-title" style={{ fontSize: '16px' }}>
          {count.toLocaleString()}
        </div>
      ),
    },
    {
      title: '占比',
      dataIndex: 'percentage',
      key: 'percentage',
      render: (percentage: string, record: NodeStatsRecord) => (
        <Space direction="vertical" size={2} style={{ width: '100%' }}>
          <div className="newspaper-body">{percentage}%</div>
          <Progress 
            percent={parseFloat(percentage)} 
            size="small" 
            strokeColor="var(--newspaper-red)"
            showInfo={false}
          />
        </Space>
      ),
    },
  ];

  // 关系表格列定义
  const relationshipColumns = [
    {
      title: '关系类型',
      dataIndex: 'relationType',
      key: 'relationType',
      render: (type: string) => (
        <div className="newspaper-body" style={{ 
          backgroundColor: 'var(--newspaper-beige)',
          padding: '4px 8px',
                      border: '1px solid var(--newspaper-light-gray)',
          fontFamily: 'SimSun, serif'
        }}>
          {type}
        </div>
      ),
    },
    {
      title: '数量',
      dataIndex: 'count',
      key: 'count',
      render: (count: number) => (
        <div className="newspaper-title" style={{ fontSize: '16px' }}>
          {count.toLocaleString()}
        </div>
      ),
    },
    {
      title: '占比',
      dataIndex: 'percentage',
      key: 'percentage',
      render: (percentage: string) => (
        <Space direction="vertical" size={2} style={{ width: '100%' }}>
          <div className="newspaper-body">{percentage}%</div>
          <Progress 
            percent={parseFloat(percentage)} 
            size="small" 
            strokeColor="var(--newspaper-green)"
            showInfo={false}
          />
        </Space>
      ),
    },
  ];

  // 今天小时统计表格列定义
  const hourlyColumns = [
    {
      title: '时间',
      dataIndex: 'time',
      key: 'time',
      render: (time: string) => (
        <div className="newspaper-body" style={{ fontWeight: 'bold' }}>{time}</div>
      ),
    },
    {
      title: '新闻数量',
      dataIndex: 'newsCount',
      key: 'newsCount',
      render: (count: number) => (
        <div className="newspaper-body">{count}</div>
      ),
    },
    {
      title: '高级别新闻',
      dataIndex: 'highLevelCount',
      key: 'highLevelCount',
      render: (count: number) => count > 0 ? (
        <div className="newspaper-tag" style={{
          backgroundColor: 'var(--newspaper-red)',
          color: 'var(--newspaper-bg)',
          padding: '2px 6px',
          fontSize: '11px'
        }}>
          {count}
        </div>
      ) : (
        <div className="newspaper-body">0</div>
      ),
    },
  ];

  // 每日统计表格列定义
  const dailyColumns = [
    {
      title: '日期',
      dataIndex: 'dateDisplay',
      key: 'dateDisplay',
      render: (dateDisplay: string) => (
        <div className="newspaper-body" style={{ fontWeight: 'bold' }}>{dateDisplay}</div>
      ),
    },
    {
      title: '新闻数量',
      dataIndex: 'newsCount',
      key: 'newsCount',
      render: (count: number) => (
        <div className="newspaper-body">{count}</div>
      ),
    },
    {
      title: '高级别新闻',
      dataIndex: 'highLevelCount',
      key: 'highLevelCount',
      render: (count: number) => count > 0 ? (
        <div className="newspaper-tag" style={{
          backgroundColor: 'var(--newspaper-red)',
          color: 'var(--newspaper-bg)',
          padding: '2px 6px',
          fontSize: '11px'
        }}>
          {count}
        </div>
      ) : (
        <div className="newspaper-body">0</div>
      ),
    },
  ];

  if (loading) {
    return (
      <Layout>
        <div className="newspaper-page" style={{ 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center', 
          minHeight: '60vh' 
        }}>
          <Spin size="large" tip={
            <div className="newspaper-body" style={{ marginTop: 'var(--space-lg)' }}>
              正在加载统计数据...
            </div>
          } />
        </div>
      </Layout>
    );
  }

  if (error) {
    return (
      <Layout>
        <div className="newspaper-page" style={{ padding: '24px' }}>
          <Alert
            message={<div className="newspaper-title">数据加载失败</div>}
            description={<div className="newspaper-body">{error}</div>}
            type="error"
            showIcon
            action={
              <Button className="newspaper-button" size="small" onClick={fetchStats}>
                重试
              </Button>
            }
            style={{
              backgroundColor: 'var(--newspaper-paper)',
              border: '2px solid var(--newspaper-red)'
            }}
          />
        </div>
      </Layout>
    );
  }

  if (!data) {
    return (
      <Layout>
        <div className="newspaper-page" style={{ padding: '24px' }}>
          <Alert
            message={<div className="newspaper-title">暂无数据</div>}
            description={<div className="newspaper-body">无法获取统计信息</div>}
            type="warning"
            showIcon
            style={{
              backgroundColor: 'var(--newspaper-paper)',
              border: '2px solid var(--newspaper-red)'
            }}
          />
        </div>
      </Layout>
    );
  }

  // 节点数据
  const nodeStatsData = [
    { key: NodeType.NEWS, nodeType: NodeType.NEWS, count: data.overview.news, name: NODE_TYPE_DESCRIPTIONS[NodeType.NEWS] },
    { key: NodeType.EVENT, nodeType: NodeType.EVENT, count: data.overview.events, name: NODE_TYPE_DESCRIPTIONS[NodeType.EVENT] },
    { key: NodeType.COMPANY, nodeType: NodeType.COMPANY, count: data.overview.companies, name: NODE_TYPE_DESCRIPTIONS[NodeType.COMPANY] },
    { key: NodeType.PERSON, nodeType: NodeType.PERSON, count: data.overview.persons, name: NODE_TYPE_DESCRIPTIONS[NodeType.PERSON] },
    { key: NodeType.ORGANIZATION, nodeType: NodeType.ORGANIZATION, count: data.overview.organizations, name: NODE_TYPE_DESCRIPTIONS[NodeType.ORGANIZATION] },
    { key: NodeType.LOCATION, nodeType: NodeType.LOCATION, count: data.overview.locations, name: NODE_TYPE_DESCRIPTIONS[NodeType.LOCATION] },
  ].map(item => ({
    ...item,
    percentage: data.overview.totalNodes > 0 ? ((item.count / data.overview.totalNodes) * 100).toFixed(1) : '0'
  }));

  const relationshipData = Object.entries(data.relationshipDistribution || {}).map(([type, count]) => ({
    key: type,
    relationType: type,
    count: Number(count),
    percentage: data.overview.relationships > 0 ? ((Number(count) / data.overview.relationships) * 100).toFixed(1) : '0'
  }));

  return (
    <Layout>
      <div className="newspaper-page" style={{ padding: '24px' }}>
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          {/* 传统报纸标题 */}
          <div style={{ 
            textAlign: 'center', 
            marginBottom: '32px',
            borderBottom: '3px double var(--newspaper-red)',
            paddingBottom: '16px'
          }}>
            <div className="newspaper-title" style={{ 
              fontSize: '32px', 
              marginBottom: '8px'
            }}>
              📊 长婷报社 • 数据统计
            </div>
            <div className="newspaper-divider" style={{ 
              height: '2px', 
              backgroundColor: 'var(--newspaper-red)', 
              margin: '16px auto',
              width: '300px'
            }}></div>
            
            <div style={{ 
              display: 'flex', 
              justifyContent: 'center', 
              alignItems: 'center',
              marginTop: '20px'
            }}>
              <Button 
                className="newspaper-button"
                icon={<ReloadOutlined />} 
                onClick={fetchStats}
                loading={loading}
              >
                📈 刷新数据
              </Button>
            </div>
          </div>

          {/* 总体统计卡片 */}
          <div style={{ marginBottom: 'var(--space-3xl)' }}>
            <div className="newspaper-subtitle" style={{ 
              fontSize: '20px', 
              textAlign: 'center', 
              marginBottom: '20px' 
            }}>
              📈 数据概览
            </div>
            <div className="newspaper-divider" style={{ 
              height: '1px', 
              backgroundColor: 'var(--newspaper-light-gray)', 
              margin: '16px auto',
              width: '200px'
            }}></div>
            
            <Row gutter={[16, 16]} style={{ marginTop: 'var(--space-2xl)' }}>
              <Col xs={24} sm={12} md={6}>
                <Card className="newspaper-card">
                  <div style={{ textAlign: 'center' }}>
                    <div className="newspaper-body" style={{ 
                      fontSize: '14px', 
                      marginBottom: '8px',
                      color: 'var(--newspaper-gray)'
                    }}>
                      💾 总节点数
                    </div>
                    <div className="newspaper-title" style={{ 
                      fontSize: '24px', 
                      color: 'var(--newspaper-red)'
                    }}>
                      {data.overview.totalNodes.toLocaleString()}
                    </div>
                  </div>
                </Card>
              </Col>
              <Col xs={24} sm={12} md={6}>
                <Card className="newspaper-card">
                  <div style={{ textAlign: 'center' }}>
                    <div className="newspaper-body" style={{ 
                      fontSize: '14px', 
                      marginBottom: '8px',
                      color: 'var(--newspaper-gray)'
                    }}>
                      🔗 总关系数
                    </div>
                    <div className="newspaper-title" style={{ 
                      fontSize: '24px', 
                      color: 'var(--newspaper-green)'
                    }}>
                      {data.overview.relationships.toLocaleString()}
                    </div>
                  </div>
                </Card>
              </Col>
              <Col xs={24} sm={12} md={6}>
                <Card className="newspaper-card">
                  <div style={{ textAlign: 'center' }}>
                    <div className="newspaper-body" style={{ 
                      fontSize: '14px', 
                      marginBottom: '8px',
                      color: 'var(--newspaper-gray)'
                    }}>
                      📰 新闻数量
                    </div>
                    <div className="newspaper-title" style={{ 
                      fontSize: '24px', 
                      color: 'var(--newspaper-red)'
                    }}>
                      {data.overview.news.toLocaleString()}
                    </div>
                  </div>
                </Card>
              </Col>
              <Col xs={24} sm={12} md={6}>
                <Card className="newspaper-card">
                  <div style={{ textAlign: 'center' }}>
                    <div className="newspaper-body" style={{ 
                      fontSize: '14px', 
                      marginBottom: '8px',
                      color: 'var(--newspaper-gray)'
                    }}>
                      🚩 事件数量
                    </div>
                    <div className="newspaper-title" style={{ 
                      fontSize: '24px', 
                      color: 'var(--newspaper-red)'
                    }}>
                      {data.overview.events.toLocaleString()}
                    </div>
                  </div>
                </Card>
              </Col>
            </Row>
          </div>

          {/* 时间统计模块 */}
          <Row gutter={[16, 16]}>
            <Col xs={24} lg={12}>
              <Card 
                title={
                  <Space>
                    <ClockCircleOutlined />
                    <Text strong>今日小时统计</Text>
                  </Space>
                }
              >
                <Table
                  dataSource={data.timeStats?.todayHourly || []}
                  columns={hourlyColumns}
                  pagination={false}
                  size="small"
                  scroll={{ y: 300 }}
                />
              </Card>
            </Col>

            <Col xs={24} lg={12}>
                              <Card 
                  className="newspaper-card"
                  title={
                    <Space>
                      <BarChartOutlined className="newspaper-icon" />
                      <span className="newspaper-title newspaper-title-small">最近7天统计</span>
                    </Space>
                  }
                >
                <Table
                  dataSource={data.timeStats?.daily || []}
                  columns={dailyColumns}
                  pagination={false}
                  size="small"
                  scroll={{ y: 300 }}
                />
              </Card>
            </Col>
          </Row>

          {/* 详细统计表格 */}
          <div style={{ marginBottom: '40px' }}>
            <div className="newspaper-section-header">
              📊 详细统计 • 数据分布
            </div>
            
            <Row gutter={[32, 24]}>
              <Col xs={24} lg={12} className="newspaper-column">
                <Card 
                  className="newspaper-card"
                  title={
                    <Space>
                      <DatabaseOutlined className="newspaper-icon" />
                      <span className="newspaper-title newspaper-title-small">节点类型分布</span>
                    </Space>
                  }
                >
                <Table
                  dataSource={nodeStatsData}
                  columns={nodeColumns}
                  pagination={false}
                  size="middle"
                />
              </Card>
            </Col>

              <Col xs={24} lg={12}>
                <Card 
                  className="newspaper-card"
                  title={
                    <Space>
                      <NodeIndexOutlined className="newspaper-icon" />
                      <span className="newspaper-title newspaper-title-small">关系类型分布</span>
                    </Space>
                  }
                >
                <Table
                  dataSource={relationshipData}
                  columns={relationshipColumns}
                  pagination={{
                    pageSize: 10,
                    showSizeChanger: false,
                    showQuickJumper: true,
                  }}
                  size="middle"
                />
                </Card>
              </Col>
            </Row>
          </div>

          {/* 快速统计卡片 */}
          <div style={{ marginBottom: '40px' }}>
            <div className="newspaper-section-header">
              🏢 实体统计 • 分类汇总
            </div>
            
            <Row gutter={[20, 20]}>
              <Col xs={12} sm={12} md={6}>
                <Card className="newspaper-card">
                  <div style={{ textAlign: 'center', padding: '16px' }}>
                    <div className="newspaper-title newspaper-title-small" style={{ color: 'var(--newspaper-green)', marginBottom: 'var(--space-sm)' }}>
                      {data.overview.companies.toLocaleString()}
                    </div>
                    <div className="newspaper-body newspaper-body-no-indent" style={{ fontSize: '13px' }}>
                      <BankOutlined className="newspaper-icon" style={{ marginRight: 'var(--space-xs)' }} />
                      公司数量
                    </div>
                  </div>
                </Card>
              </Col>
              <Col xs={12} sm={12} md={6}>
                <Card className="newspaper-card">
                  <div style={{ textAlign: 'center', padding: '16px' }}>
                    <div className="newspaper-title newspaper-title-small" style={{ color: 'var(--newspaper-accent)', marginBottom: 'var(--space-sm)' }}>
                      {data.overview.persons.toLocaleString()}
                    </div>
                    <div className="newspaper-body newspaper-body-no-indent" style={{ fontSize: '13px' }}>
                      <TeamOutlined className="newspaper-icon" style={{ marginRight: 'var(--space-xs)' }} />
                      人物数量
                    </div>
                  </div>
                </Card>
              </Col>
              <Col xs={12} sm={12} md={6}>
                <Card className="newspaper-card">
                  <div style={{ textAlign: 'center', padding: '16px' }}>
                    <div className="newspaper-title newspaper-title-small" style={{ color: 'var(--newspaper-red)', marginBottom: 'var(--space-sm)' }}>
                      {data.overview.organizations.toLocaleString()}
                    </div>
                    <div className="newspaper-body newspaper-body-no-indent" style={{ fontSize: '13px' }}>
                      <NodeIndexOutlined className="newspaper-icon" style={{ marginRight: 'var(--space-xs)' }} />
                      机构数量
                    </div>
                  </div>
                </Card>
              </Col>
              <Col xs={12} sm={12} md={6}>
                <Card className="newspaper-card">
                  <div style={{ textAlign: 'center', padding: '16px' }}>
                    <div className="newspaper-title newspaper-title-small" style={{ color: 'var(--newspaper-gray)', marginBottom: 'var(--space-sm)' }}>
                      {data.overview.locations.toLocaleString()}
                    </div>
                    <div className="newspaper-body newspaper-body-no-indent" style={{ fontSize: '13px' }}>
                      <EnvironmentOutlined className="newspaper-icon" style={{ marginRight: 'var(--space-xs)' }} />
                      地点数量
                    </div>
                  </div>
                </Card>
              </Col>
            </Row>
          </div>

          {/* 传统报纸底部装饰 */}
          <div className="newspaper-divider-thick"></div>
          <div style={{ 
            textAlign: 'center', 
            marginTop: '32px',
            padding: '20px',
            backgroundColor: 'var(--newspaper-paper)',
            border: '1px solid var(--newspaper-fine-border)'
          }}>
            <div className="newspaper-subtitle-secondary" style={{ fontSize: 'var(--font-size-base)' }}>
              长婷数据统计中心 © 2024 • 数据驱动，洞察未来 • 专业统计分析
            </div>
          </div>
        </Space>
      </div>
    </Layout>
  );
} 