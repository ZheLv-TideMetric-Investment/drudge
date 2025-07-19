'use client';

import { useState, useEffect } from 'react';
import moment from 'moment-timezone';
import {
  Button,
  Card,
  Spin,
  Badge,
  message,
  Row,
  Col,
  Divider,
  Space,
  Typography,
  Alert,
  Descriptions,
  Tag,
  Progress,
  notification,
} from 'antd';
import {
  PlayCircleOutlined,
  ScanOutlined,
  FileTextOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  ReloadOutlined,
  RobotOutlined,
  DatabaseOutlined,
  ScheduleOutlined,
} from '@ant-design/icons';
import { Layout } from '../components/Layout';

const { Title, Paragraph, Text } = Typography;

interface SystemStatus {
  scheduler: {
    available_triggers: string[];
    server_time: string;
    status: string;
  };
  scanner: {
    lastScanTime: string | null;
    processedNewsCount: number;
    isRunning: boolean;
    timestamp: string;
  };
}

export default function Home() {
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [triggerLoading, setTriggerLoading] = useState<Record<string, boolean>>({});
  const [messageApi, contextHolder] = message.useMessage();
  const [notificationApi, notificationContextHolder] = notification.useNotification();

  useEffect(() => {
    fetchSystemStatus();
    const interval = setInterval(fetchSystemStatus, 30000); // 每30秒更新一次
    return () => clearInterval(interval);
  }, []);

  const fetchSystemStatus = async () => {
    try {
      const [schedulerRes, scanRes] = await Promise.all([
        fetch('/api/scheduler'),
        fetch('/api/scan'),
      ]);

      const [schedulerData, scanData] = await Promise.all([schedulerRes.json(), scanRes.json()]);

      setSystemStatus({
        scheduler: schedulerData,
        scanner: scanData.scanner_status,
      });
      setError(null);
    } catch (err) {
      setError('获取系统状态失败');
      messageApi.error('获取系统状态失败');
    } finally {
      setLoading(false);
    }
  };

  const triggerSummary = async (type: 'hourly' | 'daily' | 'custom') => {
    const key = `summary-${type}`;
    setTriggerLoading(prev => ({ ...prev, [key]: true }));

    try {
      // 使用北京时区
      const beijingTz = 'Asia/Shanghai';
      const endTime = moment.tz(beijingTz);
      let startTime: moment.Moment;

      if (type === 'hourly') {
        // 当前小时的开始时间到现在
        startTime = endTime.clone().startOf('hour');
      } else if (type === 'daily') {
        // 当天的开始时间到现在
        startTime = endTime.clone().startOf('day');
      } else {
        // custom: 最近1小时的总结
        startTime = endTime.clone().subtract(1, 'hour');
      }

      // 构建查询参数
      const params = new URLSearchParams({
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
        sendNotification: 'true',
      });

      const response = await fetch(`/api/summary?${params.toString()}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });

      const data = await response.json();

      if (data.success) {
        const typeName = type === 'hourly' ? '小时' : type === 'daily' ? '每日' : '自定义';
        notificationApi.success({
          message: '总结生成成功',
          description: `${typeName}总结已生成完成 - ${data.period}`,
          icon: <CheckCircleOutlined style={{ color: '#52c41a' }} />,
        });
      } else {
        messageApi.error(`总结生成失败: ${data.message || data.error}`);
      }
    } catch (err) {
      messageApi.error('网络请求失败');
    } finally {
      setTriggerLoading(prev => ({ ...prev, [key]: false }));
    }
  };

  const triggerScan = async (type: 'auto' | 'manual') => {
    const key = `scan-${type}`;
    setTriggerLoading(prev => ({ ...prev, [key]: true }));

    try {
      let body: any = {};

      if (type === 'auto') {
        // 自动扫描使用默认参数（使用上次扫描时间到现在）
        body = {
          sendNotifications: true,
          skipProcessed: true,
          source: 'api',
        };
      } else {
        // 手动扫描最近30分钟，不跳过已处理的内容
        const endTime = moment().toISOString();
        const startTime = moment().subtract(30, 'minutes').toISOString();
        body = {
          startTime,
          endTime,
          sendNotifications: true,
          skipProcessed: false,
          source: 'api',
        };
      }

      const response = await fetch('/api/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (data.success) {
        const typeName = type === 'auto' ? '自动' : '手动';
        notificationApi.success({
          message: '扫描完成',
          description: `${typeName}扫描已完成 - ${data.period}，发现 ${data.found} 条 Level 1 新闻，${data.found > 0 ? '已聚合发送通知' : '无需发送通知'}`,
          icon: <CheckCircleOutlined style={{ color: '#52c41a' }} />,
        });
        fetchSystemStatus(); // 刷新状态
      } else {
        messageApi.error(`扫描失败: ${data.message || data.error}`);
      }
    } catch (err) {
      messageApi.error('网络请求失败');
    } finally {
      setTriggerLoading(prev => ({ ...prev, [key]: false }));
    }
  };

  const triggerScheduler = async (trigger: string) => {
    const key = `scheduler-${trigger}`;
    setTriggerLoading(prev => ({ ...prev, [key]: true }));

    try {
      const response = await fetch('/api/scheduler', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          trigger,
          timestamp: moment.tz('Asia/Shanghai').toISOString(),
          metadata: {
            source: 'manual_trigger',
            user_initiated: true,
          },
        }),
      });

      const data = await response.json();

      if (data.success) {
        notificationApi.success({
          message: '调度器触发成功',
          description: `${data.message} (${data.trigger})`,
          icon: <CheckCircleOutlined style={{ color: '#52c41a' }} />,
        });
      } else {
        messageApi.error(`调度器触发失败: ${data.message || data.error}`);
      }
    } catch (err) {
      messageApi.error('网络请求失败');
    } finally {
      setTriggerLoading(prev => ({ ...prev, [key]: false }));
    }
  };

  const getTriggerDescription = (trigger: string) => {
    const descriptions = {
      every_minute: '每分钟执行任务，用于轻量级监控',
      every_5_minutes: '每5分钟执行任务，高频扫描高级别新闻',
      every_30_minutes: '每30分钟执行任务，中频处理',
      every_hour: '每小时执行任务，全天24小时运行',
      every_hour_05: '每小时05分执行任务，全天24小时延迟处理',
      daytime: '白天执行任务（11-22点）',
      daytime_05: '白天05分执行任务，生成小时总结（11-22点）',
      overnight: '隔夜执行任务（10点）',
      overnight_05: '隔夜执行任务，生成每日总结（10点05分）',
      weekly_friday_1605: '每周五16:05分执行任务，周报处理',
    };
    return descriptions[trigger as keyof typeof descriptions] || '未知任务';
  };

  const getTriggerColor = (trigger: string) => {
    const colors = {
      every_minute: 'green',
      every_5_minutes: 'blue',
      every_30_minutes: 'orange',
      every_hour: 'purple',
      every_hour_05: 'cyan',
      daytime: 'geekblue',
      daytime_05: 'volcano',
      overnight: 'red',
      overnight_05: 'magenta',
      weekly_friday_1605: 'gold',
    };
    return colors[trigger as keyof typeof colors] || 'default';
  };

  if (loading) {
    return (
      <Layout>
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            height: '50vh',
          }}
        >
          <Spin size="large" tip="加载系统状态中..." />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      {contextHolder}
      {notificationContextHolder}
      <div style={{ padding: '24px' }}>
        {/* 页面标题和描述 */}
        <div style={{ marginBottom: '24px' }}>
          <Title level={1}>
            <RobotOutlined style={{ marginRight: '8px', color: '#1890ff' }} />
            新闻知识图谱系统
          </Title>
          <Paragraph style={{ fontSize: '16px', color: '#666' }}>
            基于AI的新闻知识图谱分析和可视化平台，集成定时任务调度、新闻扫描和AI总结功能
          </Paragraph>

          {error && (
            <Alert
              message="系统错误"
              description={error}
              type="error"
              showIcon
              closable
              style={{ marginBottom: '16px' }}
            />
          )}
        </div>

        {/* 系统状态概览 */}
        <Title level={2}>
          <DatabaseOutlined style={{ marginRight: '8px' }} />
          系统状态概览
        </Title>
        <Row gutter={[16, 16]} style={{ marginBottom: '32px' }}>
          <Col xs={24} sm={12}>
            <Card
              title={
                <Space>
                  <ScheduleOutlined />
                  调度器状态
                </Space>
              }
              size="small"
            >
              <Descriptions column={1} size="small">
                <Descriptions.Item label="运行状态">
                  <Badge
                    status={systemStatus?.scheduler?.status === 'active' ? 'processing' : 'error'}
                    text={systemStatus?.scheduler?.status === 'active' ? '运行中' : '已停止'}
                  />
                </Descriptions.Item>
                <Descriptions.Item label="可用触发器">
                  <Text strong>{systemStatus?.scheduler?.available_triggers?.length || 0} 个</Text>
                </Descriptions.Item>
                <Descriptions.Item label="最后更新">
                  <Text type="secondary">
                    {systemStatus?.scheduler?.server_time
                      ? moment(systemStatus.scheduler.server_time)
                          .tz('Asia/Shanghai')
                          .format('YYYY-MM-DD HH:mm:ss')
                      : '未知'}
                  </Text>
                </Descriptions.Item>
              </Descriptions>
            </Card>
          </Col>

          <Col xs={24} sm={12}>
            <Card
              title={
                <Space>
                  <ScanOutlined />
                  扫描器状态
                </Space>
              }
              size="small"
            >
              <Descriptions column={1} size="small">
                <Descriptions.Item label="运行状态">
                  <Badge
                    status={systemStatus?.scanner?.isRunning ? 'processing' : 'default'}
                    text={systemStatus?.scanner?.isRunning ? '扫描中' : '空闲'}
                  />
                </Descriptions.Item>
                <Descriptions.Item label="已处理新闻">
                  <Text strong>{systemStatus?.scanner?.processedNewsCount || 0} 条</Text>
                </Descriptions.Item>
                <Descriptions.Item label="上次扫描">
                  <Text type="secondary">{systemStatus?.scanner?.lastScanTime || '从未扫描'}</Text>
                </Descriptions.Item>
              </Descriptions>
            </Card>
          </Col>
        </Row>

        <Divider />

        {/* 调度器触发器 */}
        <Title level={2}>
          <ScheduleOutlined style={{ marginRight: '8px' }} />
          调度器触发器
        </Title>
        <Row gutter={[16, 16]} style={{ marginBottom: '32px' }}>
          {systemStatus?.scheduler?.available_triggers?.map(trigger => (
            <Col xs={24} sm={12} lg={8} key={trigger}>
              <Card
                size="small"
                title={
                  <Space>
                    <Tag color={getTriggerColor(trigger)}>
                      {trigger.replace(/_/g, ' ').toUpperCase()}
                    </Tag>
                  </Space>
                }
                actions={[
                  <Button
                    key="trigger"
                    type="primary"
                    icon={<PlayCircleOutlined />}
                    loading={triggerLoading[`scheduler-${trigger}`]}
                    onClick={() => triggerScheduler(trigger)}
                    block
                  >
                    {triggerLoading[`scheduler-${trigger}`] ? '触发中...' : '立即触发'}
                  </Button>,
                ]}
              >
                <Paragraph style={{ minHeight: '60px', margin: 0 }}>
                  {getTriggerDescription(trigger)}
                </Paragraph>
              </Card>
            </Col>
          ))}
        </Row>

        <Divider />

        {/* 新闻扫描 */}
        <Title level={2}>
          <ScanOutlined style={{ marginRight: '8px' }} />
          新闻扫描
        </Title>
        <Row gutter={[16, 16]} style={{ marginBottom: '32px' }}>
          <Col xs={24} sm={12}>
            <Card
              title="自动扫描"
              size="small"
              actions={[
                <Button
                  key="auto-scan"
                  type="primary"
                  icon={<ScanOutlined />}
                  loading={triggerLoading['scan-auto']}
                  onClick={() => triggerScan('auto')}
                  block
                >
                  {triggerLoading['scan-auto'] ? '扫描中...' : '开始自动扫描'}
                </Button>,
              ]}
            >
              <Paragraph>使用上次扫描时间到现在的时间范围自动扫描新闻，智能处理增量数据</Paragraph>
            </Card>
          </Col>

          <Col xs={24} sm={12}>
            <Card
              title="手动扫描"
              size="small"
              actions={[
                <Button
                  key="manual-scan"
                  type="primary"
                  icon={<ReloadOutlined />}
                  loading={triggerLoading['scan-manual']}
                  onClick={() => triggerScan('manual')}
                  block
                >
                  {triggerLoading['scan-manual'] ? '扫描中...' : '开始手动扫描'}
                </Button>,
              ]}
            >
              <Paragraph>手动扫描最近30分钟的新闻，发送通知且不跳过已处理的内容</Paragraph>
            </Card>
          </Col>
        </Row>

        <Divider />

        {/* AI总结生成 */}
        <Title level={2}>
          <FileTextOutlined style={{ marginRight: '8px' }} />
          AI总结生成
        </Title>
        <Row gutter={[16, 16]}>
          <Col xs={24} sm={8}>
            <Card
              title={
                <Space>
                  <ClockCircleOutlined />
                  小时总结
                </Space>
              }
              size="small"
              actions={[
                <Button
                  key="hourly-summary"
                  type="primary"
                  icon={<FileTextOutlined />}
                  loading={triggerLoading['summary-hourly']}
                  onClick={() => triggerSummary('hourly')}
                  block
                >
                  {triggerLoading['summary-hourly'] ? '生成中...' : '生成小时总结'}
                </Button>,
              ]}
            >
              <Paragraph>生成当前小时的新闻总结报告，快速了解最新动态</Paragraph>
            </Card>
          </Col>

          <Col xs={24} sm={8}>
            <Card
              title={
                <Space>
                  <DatabaseOutlined />
                  每日总结
                </Space>
              }
              size="small"
              actions={[
                <Button
                  key="daily-summary"
                  type="primary"
                  icon={<FileTextOutlined />}
                  loading={triggerLoading['summary-daily']}
                  onClick={() => triggerSummary('daily')}
                  block
                >
                  {triggerLoading['summary-daily'] ? '生成中...' : '生成每日总结'}
                </Button>,
              ]}
            >
              <Paragraph>生成当日的新闻总结报告，全面回顾一天的重要新闻</Paragraph>
            </Card>
          </Col>

          <Col xs={24} sm={8}>
            <Card
              title={
                <Space>
                  <RobotOutlined />
                  自定义总结
                </Space>
              }
              size="small"
              actions={[
                <Button
                  key="custom-summary"
                  type="primary"
                  icon={<FileTextOutlined />}
                  loading={triggerLoading['summary-custom']}
                  onClick={() => triggerSummary('custom')}
                  block
                >
                  {triggerLoading['summary-custom'] ? '生成中...' : '生成自定义总结'}
                </Button>,
              ]}
            >
              <Paragraph>生成最近1小时的自定义新闻总结，灵活控制时间范围</Paragraph>
            </Card>
          </Col>
        </Row>
      </div>
    </Layout>
  );
}
