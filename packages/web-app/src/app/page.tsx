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
  ShareAltOutlined,
  BarChartOutlined,
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
          icon: <CheckCircleOutlined style={{ color: 'var(--newspaper-green)' }} />,
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
          icon: <CheckCircleOutlined style={{ color: 'var(--newspaper-green)' }} />,
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
          icon: <CheckCircleOutlined style={{ color: 'var(--newspaper-green)' }} />,
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
      <div className="newspaper-page" style={{ padding: '32px' }}>
        
        {/* 传统报纸头版设计 - 优化版 */}
        <div className="newspaper-header-frame">
          {/* 报纸标题头部 */}
          <div style={{ 
            textAlign: 'center'
          }}>
            <div className="newspaper-title newspaper-title-large">
              📰 大公报纸
            </div>
            <div className="newspaper-subtitle" style={{ 
              fontSize: '16px', 
              marginBottom: '12px'
            }}>
              知识图谱系统 • 基于人工智能的新闻分析平台
            </div>
            <div className="newspaper-time">
              {moment().tz('Asia/Shanghai').format('YYYY年MM月DD日 dddd HH:mm')} • 北京时间
            </div>
          </div>

          {/* 头条新闻概述 */}
          <div className="newspaper-section-header">
            📋 系统概览 • 今日要闻
          </div>
          
          <div className="newspaper-body newspaper-content-left" style={{ 
            fontSize: '16px', 
            textAlign: 'center',
            backgroundColor: 'var(--newspaper-paper)',
            padding: '20px',
            border: '1px solid var(--newspaper-fine-border)',
            marginBottom: '0'
          }}>
            集成定时任务调度、新闻扫描和AI总结功能，采用传统中文报纸版面设计。为用户提供专业的新闻知识图谱分析服务。系统运行状态良好，各项功能正常运转。
          </div>
        </div>

        {/* 快速导航 - 三栏布局优化 */}
        <div style={{ marginBottom: '40px' }}>
          <div className="newspaper-section-header">
            🚀 快速导航 • 核心功能
          </div>
          
          <Row gutter={[24, 24]}>
            <Col xs={24} sm={24} md={8}>
              <Card className="newspaper-card" size="small" hoverable style={{ height: '220px' }}>
                <div style={{ textAlign: 'center', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                  <div>
                    <div className="newspaper-icon" style={{ fontSize: '36px', marginBottom: '16px' }}>📋</div>
                    <div className="newspaper-title newspaper-title-small">
                      新闻浏览
                    </div>
                    <div className="newspaper-body newspaper-body-no-indent" style={{ 
                      fontSize: '13px', 
                      color: 'var(--newspaper-gray)', 
                      lineHeight: '1.7',
                      marginBottom: '16px'
                    }}>
                      查看和搜索原始新闻数据，享受传统报纸式的阅读体验。支持关键词检索和时间筛选功能，助您快速获取所需信息。
                    </div>
                  </div>
                  <Button 
                    className="newspaper-button"
                    icon={<FileTextOutlined className="newspaper-icon" />} 
                    href="/news"
                    style={{ width: '100%' }}
                  >
                    进入新闻浏览
                  </Button>
                </div>
              </Card>
            </Col>
            
            <Col xs={24} sm={24} md={8}>
              <Card className="newspaper-card" size="small" hoverable style={{ height: '220px' }}>
                <div style={{ textAlign: 'center', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                  <div>
                    <div className="newspaper-icon" style={{ fontSize: '36px', marginBottom: '16px' }}>🕸️</div>
                    <div className="newspaper-title newspaper-title-small">
                      知识图谱
                    </div>
                    <div className="newspaper-body newspaper-body-no-indent" style={{ 
                      fontSize: '13px', 
                      color: 'var(--newspaper-gray)', 
                      lineHeight: '1.7',
                      marginBottom: '16px'
                    }}>
                      探索实体关系网络，可视化新闻知识结构。深度分析新闻事件间的内在联系，发现数据背后的故事。
                    </div>
                  </div>
                  <Button 
                    className="newspaper-button"
                    icon={<ShareAltOutlined className="newspaper-icon" />} 
                    href="/graph"
                    style={{ width: '100%' }}
                  >
                    探索知识图谱
                  </Button>
                </div>
              </Card>
            </Col>
            
            <Col xs={24} sm={24} md={8}>
              <Card className="newspaper-card" size="small" hoverable style={{ height: '220px' }}>
                <div style={{ textAlign: 'center', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                  <div>
                    <div className="newspaper-icon" style={{ fontSize: '36px', marginBottom: '16px' }}>📊</div>
                    <div className="newspaper-title newspaper-title-small">
                      数据统计
                    </div>
                    <div className="newspaper-body newspaper-body-no-indent" style={{ 
                      fontSize: '13px', 
                      color: 'var(--newspaper-gray)', 
                      lineHeight: '1.7',
                      marginBottom: '16px'
                    }}>
                      查看系统统计信息，掌握数据分析概况。了解新闻处理进度和系统运行状态，监控整体表现。
                    </div>
                  </div>
                  <Button 
                    className="newspaper-button"
                    icon={<BarChartOutlined className="newspaper-icon" />} 
                    href="/stats"
                    style={{ width: '100%' }}
                  >
                    查看数据统计
                  </Button>
                </div>
              </Card>
            </Col>
          </Row>
        </div>

        {error && (
          <Alert
            message="系统错误"
            description={error}
            type="error"
            showIcon
            closable
            style={{ marginBottom: '32px' }}
          />
        )}
      
        {/* 传统报纸风格分割线 */}
        <div className="newspaper-divider-decorative"></div>

        {/* 系统状态 - 双栏布局优化 */}
        <div style={{ marginBottom: '40px' }}>
          <div className="newspaper-section-header">
            🖥️ 系统状态 • 运行监控
          </div>
          
          <Row gutter={[32, 24]}>
            <Col xs={24} md={12} className="newspaper-column">
              <Card
                title={
                  <Space>
                    <ScheduleOutlined className="newspaper-icon" />
                    <span className="newspaper-title newspaper-title-small">调度器状态</span>
                  </Space>
                }
                className="newspaper-card"
                size="small"
              >
                <div className="newspaper-stats">
                  <div className="newspaper-paragraph">
                    <div className="newspaper-body newspaper-body-no-indent" style={{ marginBottom: '8px' }}>
                      <strong>运行状态：</strong>
                      <Badge
                        status={systemStatus?.scheduler?.status === 'active' ? 'processing' : 'error'}
                        text={systemStatus?.scheduler?.status === 'active' ? '运行中' : '已停止'}
                        style={{ marginLeft: '8px' }}
                      />
                    </div>
                    <div className="newspaper-body newspaper-body-no-indent" style={{ marginBottom: '8px' }}>
                      <strong>可用触发器：</strong>
                      <span className="newspaper-title" style={{ fontSize: '16px', marginLeft: '8px' }}>
                        {systemStatus?.scheduler?.available_triggers?.length || 0} 个
                      </span>
                    </div>
                    <div className="newspaper-body newspaper-body-no-indent">
                      <strong>最后更新：</strong>
                      <span className="newspaper-time" style={{ marginLeft: '8px' }}>
                        {systemStatus?.scheduler?.server_time
                          ? moment(systemStatus.scheduler.server_time)
                              .tz('Asia/Shanghai')
                              .format('MM-DD HH:mm:ss')
                          : '未知'}
                      </span>
                    </div>
                  </div>
                </div>
              </Card>
            </Col>

            <Col xs={24} md={12}>
              <Card
                title={
                  <Space>
                    <ScanOutlined className="newspaper-icon" />
                    <span className="newspaper-title newspaper-title-small">扫描器状态</span>
                  </Space>
                }
                className="newspaper-card"
                size="small"
              >
                <div className="newspaper-stats">
                  <div className="newspaper-paragraph">
                    <div className="newspaper-body newspaper-body-no-indent" style={{ marginBottom: '8px' }}>
                      <strong>运行状态：</strong>
                      <Badge
                        status={systemStatus?.scanner?.isRunning ? 'processing' : 'default'}
                        text={systemStatus?.scanner?.isRunning ? '扫描中' : '空闲'}
                        style={{ marginLeft: '8px' }}
                      />
                    </div>
                    <div className="newspaper-body newspaper-body-no-indent" style={{ marginBottom: '8px' }}>
                      <strong>已处理新闻：</strong>
                      <span className="newspaper-title" style={{ fontSize: '16px', marginLeft: '8px' }}>
                        {systemStatus?.scanner?.processedNewsCount || 0} 条
                      </span>
                    </div>
                    <div className="newspaper-body newspaper-body-no-indent">
                      <strong>上次扫描：</strong>
                      <span className="newspaper-time" style={{ marginLeft: '8px' }}>
                        {systemStatus?.scanner?.lastScanTime || '从未扫描'}
                      </span>
                    </div>
                  </div>
                </div>
              </Card>
            </Col>
          </Row>
        </div>

        <div className="newspaper-divider-thick"></div>

        {/* 调度器触发器优化 */}
        <div style={{ marginBottom: '40px' }}>
          <div className="newspaper-section-header">
            ⚙️ 调度器触发器 • 任务管理
          </div>
          
          <Row gutter={[20, 20]}>
            {systemStatus?.scheduler?.available_triggers?.map(trigger => (
              <Col xs={24} sm={12} lg={8} key={trigger}>
                <Card
                  className="newspaper-card"
                  size="small"
                  title={
                    <div className="newspaper-content-left">
                      <Tag 
                        className="newspaper-tag"
                        color={getTriggerColor(trigger)}
                      >
                        {trigger.replace(/_/g, ' ').toUpperCase()}
                      </Tag>
                    </div>
                  }
                  actions={[
                    <Button
                      key="trigger"
                      className="newspaper-button"
                      icon={<PlayCircleOutlined />}
                      loading={triggerLoading[`scheduler-${trigger}`]}
                      onClick={() => triggerScheduler(trigger)}
                      block
                    >
                      {triggerLoading[`scheduler-${trigger}`] ? '触发中...' : '立即触发'}
                    </Button>,
                  ]}
                >
                  <div className="newspaper-body newspaper-content-left newspaper-body-no-indent" style={{ 
                    minHeight: '60px',
                    fontSize: '13px',
                    marginBottom: '0'
                  }}>
                    {getTriggerDescription(trigger)}
                  </div>
                </Card>
              </Col>
            ))}
          </Row>
        </div>

        <div className="newspaper-divider"></div>

        {/* 新闻扫描优化 */}
        <div style={{ marginBottom: '40px' }}>
          <div className="newspaper-section-header">
            🔍 新闻扫描 • 数据采集
          </div>
          
          <Row gutter={[32, 24]}>
            <Col xs={24} md={12} className="newspaper-column">
              <Card
                title={
                  <div className="newspaper-title newspaper-title-small newspaper-content-left">
                    自动扫描
                  </div>
                }
                className="newspaper-card"
                size="small"
                actions={[
                  <Button
                    key="auto-scan"
                    className="newspaper-button"
                    icon={<ScanOutlined />}
                    loading={triggerLoading['scan-auto']}
                    onClick={() => triggerScan('auto')}
                    block
                  >
                    {triggerLoading['scan-auto'] ? '扫描中...' : '开始自动扫描'}
                  </Button>,
                ]}
              >
                <div className="newspaper-body newspaper-content-left" style={{ 
                  marginBottom: '0',
                  fontSize: '14px'
                }}>
                  使用上次扫描时间到现在的时间范围自动扫描新闻，智能处理增量数据，高效获取最新资讯动态。
                </div>
              </Card>
            </Col>

            <Col xs={24} md={12}>
              <Card
                title={
                  <div className="newspaper-title newspaper-title-small newspaper-content-left">
                    手动扫描
                  </div>
                }
                className="newspaper-card"
                size="small"
                actions={[
                  <Button
                    key="manual-scan"
                    className="newspaper-button-secondary"
                    icon={<ReloadOutlined />}
                    loading={triggerLoading['scan-manual']}
                    onClick={() => triggerScan('manual')}
                    block
                  >
                    {triggerLoading['scan-manual'] ? '扫描中...' : '开始手动扫描'}
                  </Button>,
                ]}
              >
                <div className="newspaper-body newspaper-content-left" style={{ 
                  marginBottom: '0',
                  fontSize: '14px'
                }}>
                  手动扫描最近30分钟的新闻，发送通知且不跳过已处理的内容，适用于紧急新闻获取。
                </div>
              </Card>
            </Col>
          </Row>
        </div>

        <div className="newspaper-divider"></div>

        {/* AI总结生成优化 */}
        <div style={{ marginBottom: '40px' }}>
          <div className="newspaper-section-header">
            🤖 AI总结生成 • 智能分析
          </div>
          
          <Row gutter={[20, 20]}>
            <Col xs={24} sm={8}>
              <Card
                title={
                  <Space>
                    <ClockCircleOutlined className="newspaper-icon" />
                    <span className="newspaper-title newspaper-title-small">小时总结</span>
                  </Space>
                }
                className="newspaper-card"
                size="small"
                actions={[
                  <Button
                    key="hourly-summary"
                    className="newspaper-button"
                    icon={<FileTextOutlined />}
                    loading={triggerLoading['summary-hourly']}
                    onClick={() => triggerSummary('hourly')}
                    block
                  >
                    {triggerLoading['summary-hourly'] ? '生成中...' : '生成小时总结'}
                  </Button>,
                ]}
              >
                <div className="newspaper-body newspaper-content-left newspaper-body-no-indent" style={{ 
                  fontSize: '13px',
                  marginBottom: '0'
                }}>
                  生成当前小时的新闻总结报告，快速了解最新动态，掌握时事要闻。
                </div>
              </Card>
            </Col>

            <Col xs={24} sm={8}>
              <Card
                title={
                  <Space>
                    <DatabaseOutlined className="newspaper-icon" />
                    <span className="newspaper-title newspaper-title-small">每日总结</span>
                  </Space>
                }
                className="newspaper-card"
                size="small"
                actions={[
                  <Button
                    key="daily-summary"
                    className="newspaper-button"
                    icon={<FileTextOutlined />}
                    loading={triggerLoading['summary-daily']}
                    onClick={() => triggerSummary('daily')}
                    block
                  >
                    {triggerLoading['summary-daily'] ? '生成中...' : '生成每日总结'}
                  </Button>,
                ]}
              >
                <div className="newspaper-body newspaper-content-left newspaper-body-no-indent" style={{ 
                  fontSize: '13px',
                  marginBottom: '0'
                }}>
                  生成当日的新闻总结报告，全面回顾一天的重要新闻事件。
                </div>
              </Card>
            </Col>

            <Col xs={24} sm={8}>
              <Card
                title={
                  <Space>
                    <RobotOutlined className="newspaper-icon" />
                    <span className="newspaper-title newspaper-title-small">自定义总结</span>
                  </Space>
                }
                className="newspaper-card"
                size="small"
                actions={[
                  <Button
                    key="custom-summary"
                    className="newspaper-button"
                    icon={<FileTextOutlined />}
                    loading={triggerLoading['summary-custom']}
                    onClick={() => triggerSummary('custom')}
                    block
                  >
                    {triggerLoading['summary-custom'] ? '生成中...' : '生成自定义总结'}
                  </Button>,
                ]}
              >
                <div className="newspaper-body newspaper-content-left newspaper-body-no-indent" style={{ 
                  fontSize: '13px',
                  marginBottom: '0'
                }}>
                  生成最近1小时的自定义新闻总结，灵活控制时间范围。
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
          <div className="newspaper-subtitle-secondary" style={{ fontSize: '12px' }}>
            大公报纸知识图谱系统 © 2024 • 传承经典，拥抱科技 • 专业新闻分析平台
          </div>
        </div>
      </div>
    </Layout>
  );
}
