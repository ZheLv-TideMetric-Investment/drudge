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
      [NodeType.NEWS]: <FileTextOutlined style={{ color: '#1890ff' }} />,
      [NodeType.EVENT]: <FlagOutlined style={{ color: '#f5222d' }} />,
      [NodeType.COMPANY]: <BankOutlined style={{ color: '#52c41a' }} />,
      [NodeType.PERSON]: <TeamOutlined style={{ color: '#722ed1' }} />,
      [NodeType.ORGANIZATION]: <NodeIndexOutlined style={{ color: '#fa8c16' }} />,
      [NodeType.LOCATION]: <EnvironmentOutlined style={{ color: '#13c2c2' }} />,
    };
    return iconMap[nodeType] || <DatabaseOutlined />;
  };

  const getNodeColor = (nodeType: NodeType) => {
    const colorMap: Record<NodeType, string> = {
      [NodeType.NEWS]: '#1890ff',
      [NodeType.EVENT]: '#f5222d',
      [NodeType.COMPANY]: '#52c41a',
      [NodeType.PERSON]: '#722ed1',
      [NodeType.ORGANIZATION]: '#fa8c16',
      [NodeType.LOCATION]: '#13c2c2',
    };
    return colorMap[nodeType] || '#666';
  };

  // 节点表格列定义
  const nodeColumns = [
    {
      title: '节点类型',
      dataIndex: 'nodeType',
      key: 'nodeType',
      render: (type: NodeType, record: NodeStatsRecord) => (
        <Space>
          {getNodeIcon(record.nodeType)}
          <Text strong>{record.name}</Text>
        </Space>
      ),
    },
    {
      title: '数量',
      dataIndex: 'count',
      key: 'count',
      render: (count: number) => <Text strong>{count.toLocaleString()}</Text>,
    },
    {
      title: '占比',
      dataIndex: 'percentage',
      key: 'percentage',
      render: (percentage: string, record: NodeStatsRecord) => (
        <Space direction="vertical" size={2} style={{ width: '100%' }}>
          <Text>{percentage}%</Text>
          <Progress 
            percent={parseFloat(percentage)} 
            size="small" 
            strokeColor={getNodeColor(record.nodeType)}
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
      render: (type: string) => <Tag color="blue">{type}</Tag>,
    },
    {
      title: '数量',
      dataIndex: 'count',
      key: 'count',
      render: (count: number) => <Text strong>{count.toLocaleString()}</Text>,
    },
    {
      title: '占比',
      dataIndex: 'percentage',
      key: 'percentage',
      render: (percentage: string) => (
        <Space direction="vertical" size={2} style={{ width: '100%' }}>
          <Text>{percentage}%</Text>
          <Progress 
            percent={parseFloat(percentage)} 
            size="small" 
            strokeColor="#52c41a"
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
      render: (time: string) => <Text strong>{time}</Text>,
    },
    {
      title: '新闻数量',
      dataIndex: 'newsCount',
      key: 'newsCount',
      render: (count: number) => <Text>{count}</Text>,
    },
    {
      title: '高级别新闻',
      dataIndex: 'highLevelCount',
      key: 'highLevelCount',
      render: (count: number) => count > 0 ? <Tag color="red">{count}</Tag> : <Text>0</Text>,
    },
  ];

  // 每日统计表格列定义
  const dailyColumns = [
    {
      title: '日期',
      dataIndex: 'dateDisplay',
      key: 'dateDisplay',
      render: (dateDisplay: string) => <Text strong>{dateDisplay}</Text>,
    },
    {
      title: '新闻数量',
      dataIndex: 'newsCount',
      key: 'newsCount',
      render: (count: number) => <Text>{count}</Text>,
    },
    {
      title: '高级别新闻',
      dataIndex: 'highLevelCount',
      key: 'highLevelCount',
      render: (count: number) => count > 0 ? <Tag color="red">{count}</Tag> : <Text>0</Text>,
    },
  ];

  if (loading) {
    return (
      <Layout>
        <div style={{ 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center', 
          minHeight: '60vh' 
        }}>
          <Spin size="large" />
        </div>
      </Layout>
    );
  }

  if (error) {
    return (
      <Layout>
        <Alert
          message="数据加载失败"
          description={error}
          type="error"
          showIcon
          action={
            <Button size="small" onClick={fetchStats}>
              重试
            </Button>
          }
        />
      </Layout>
    );
  }

  if (!data) {
    return (
      <Layout>
        <Alert
          message="暂无数据"
          description="无法获取统计信息"
          type="warning"
          showIcon
        />
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
      <div style={{ padding: '24px' }}>
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          {/* 页面标题 */}
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center' 
          }}>
            <Title level={2}>
              <DatabaseOutlined /> 数据库节点统计
            </Title>
            <Button 
              icon={<ReloadOutlined />} 
              onClick={fetchStats}
              loading={loading}
            >
              刷新数据
            </Button>
          </div>

          {/* 总体统计卡片 */}
          <Row gutter={[16, 16]}>
            <Col xs={24} sm={12} md={8} lg={6}>
              <Card>
                <Statistic
                  title="总节点数"
                  value={data.overview.totalNodes}
                  prefix={<DatabaseOutlined />}
                  valueStyle={{ color: '#1890ff' }}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} md={8} lg={6}>
              <Card>
                <Statistic
                  title="总关系数"
                  value={data.overview.relationships}
                  prefix={<NodeIndexOutlined />}
                  valueStyle={{ color: '#52c41a' }}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} md={8} lg={6}>
              <Card>
                <Statistic
                  title="新闻数量"
                  value={data.overview.news}
                  prefix={<FileTextOutlined />}
                  valueStyle={{ color: '#f5222d' }}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} md={8} lg={6}>
              <Card>
                <Statistic
                  title="事件数量"
                  value={data.overview.events}
                  prefix={<FlagOutlined />}
                  valueStyle={{ color: '#fa8c16' }}
                />
              </Card>
            </Col>
          </Row>

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
                title={
                  <Space>
                    <BarChartOutlined />
                    <Text strong>最近7天统计</Text>
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
          <Row gutter={[16, 16]}>
            <Col xs={24} lg={12}>
              <Card 
                title={
                  <Space>
                    <DatabaseOutlined />
                    <Text strong>节点类型分布</Text>
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
                title={
                  <Space>
                    <NodeIndexOutlined />
                    <Text strong>关系类型分布</Text>
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

          {/* 快速统计卡片 */}
          <Row gutter={[16, 16]}>
            <Col xs={24} sm={12} md={8}>
              <Card>
                <Statistic
                  title="公司数量"
                  value={data.overview.companies}
                  prefix={<BankOutlined />}
                  valueStyle={{ color: '#52c41a' }}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} md={8}>
              <Card>
                <Statistic
                  title="人物数量"
                  value={data.overview.persons}
                  prefix={<TeamOutlined />}
                  valueStyle={{ color: '#722ed1' }}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} md={8}>
              <Card>
                <Statistic
                  title="机构数量"
                  value={data.overview.organizations}
                  prefix={<NodeIndexOutlined />}
                  valueStyle={{ color: '#fa8c16' }}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} md={8}>
              <Card>
                <Statistic
                  title="地点数量"
                  value={data.overview.locations}
                  prefix={<EnvironmentOutlined />}
                  valueStyle={{ color: '#13c2c2' }}
                />
              </Card>
            </Col>
          </Row>
        </Space>
      </div>
    </Layout>
  );
} 