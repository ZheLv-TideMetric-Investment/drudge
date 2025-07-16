'use client';

import { useState, useEffect } from 'react';
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
  CalendarOutlined,
  FlagOutlined,
  NodeIndexOutlined,
  ReloadOutlined
} from '@ant-design/icons';
import { Layout } from '../../components/Layout';

const { Title, Text } = Typography;

interface NodeStatsRecord {
  key: string;
  nodeType: string;
  count: number;
  name: string;
  percentage: string;
}

interface RelationshipStatsRecord {
  key: string;
  relationType: string;
  count: number;
  percentage: string;
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
    times: number;
  };
  relationshipDistribution: Record<string, number>;
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

  const getNodeIcon = (nodeType: string) => {
    const iconMap: Record<string, React.ReactNode> = {
      News: <FileTextOutlined style={{ color: '#1890ff' }} />,
      Event: <FlagOutlined style={{ color: '#f5222d' }} />,
      Company: <BankOutlined style={{ color: '#52c41a' }} />,
      Person: <TeamOutlined style={{ color: '#722ed1' }} />,
      Organization: <NodeIndexOutlined style={{ color: '#fa8c16' }} />,
      Location: <EnvironmentOutlined style={{ color: '#13c2c2' }} />,
      Time: <CalendarOutlined style={{ color: '#eb2f96' }} />
    };
    return iconMap[nodeType] || <DatabaseOutlined />;
  };

  const getNodeColor = (nodeType: string) => {
    const colorMap: Record<string, string> = {
      News: '#1890ff',
      Event: '#f5222d',
      Company: '#52c41a',
      Person: '#722ed1',
      Organization: '#fa8c16',
      Location: '#13c2c2',
      Time: '#eb2f96'
    };
    return colorMap[nodeType] || '#666';
  };

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
    { key: 'News', nodeType: 'News', count: data.overview.news, name: '新闻' },
    { key: 'Event', nodeType: 'Event', count: data.overview.events, name: '事件' },
    { key: 'Company', nodeType: 'Company', count: data.overview.companies, name: '公司' },
    { key: 'Person', nodeType: 'Person', count: data.overview.persons, name: '人物' },
    { key: 'Organization', nodeType: 'Organization', count: data.overview.organizations, name: '机构' },
    { key: 'Location', nodeType: 'Location', count: data.overview.locations, name: '地点' },
    { key: 'Time', nodeType: 'Time', count: data.overview.times, name: '时间' },
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

  const nodeColumns = [
    {
      title: '节点类型',
      dataIndex: 'nodeType',
      key: 'nodeType',
      render: (type: string, record: NodeStatsRecord) => (
        <Space>
          {getNodeIcon(type)}
          <Text strong>{record.name}</Text>
        </Space>
      ),
    },
    {
      title: '数量',
      dataIndex: 'count',
      key: 'count',
      render: (count: number) => (
        <Text style={{ fontWeight: 'bold', fontSize: '16px' }}>
          {count.toLocaleString()}
        </Text>
      ),
      sorter: (a: NodeStatsRecord, b: NodeStatsRecord) => a.count - b.count,
      defaultSortOrder: 'descend' as const,
    },
    {
      title: '占比',
      dataIndex: 'percentage',
      key: 'percentage',
      render: (percentage: string, record: NodeStatsRecord) => (
        <Space direction="vertical" size={4} style={{ width: '100%' }}>
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

  const relationshipColumns = [
    {
      title: '关系类型',
      dataIndex: 'relationType',
      key: 'relationType',
      render: (type: string) => (
        <Tag color="blue">{type}</Tag>
      ),
    },
    {
      title: '数量',
      dataIndex: 'count',
      key: 'count',
      render: (count: number) => (
        <Text style={{ fontWeight: 'bold' }}>
          {count.toLocaleString()}
        </Text>
      ),
      sorter: (a: RelationshipStatsRecord, b: RelationshipStatsRecord) => a.count - b.count,
      defaultSortOrder: 'descend' as const,
    },
    {
      title: '占比',
      dataIndex: 'percentage',
      key: 'percentage',
      render: (percentage: string) => `${percentage}%`,
    },
  ];

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
            <Col xs={24} sm={12} md={8}>
              <Card>
                <Statistic
                  title="时间节点"
                  value={data.overview.times}
                  prefix={<CalendarOutlined />}
                  valueStyle={{ color: '#eb2f96' }}
                />
              </Card>
            </Col>
          </Row>
        </Space>
      </div>
    </Layout>
  );
} 