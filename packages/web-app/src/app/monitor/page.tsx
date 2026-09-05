'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Button,
  Card,
  Col,
  Descriptions,
  Row,
  Space,
  Spin,
  Switch,
  Tag,
  Typography,
} from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import { Layout } from '../../components/Layout';
import { TimeZoneUtils } from '../../lib/utils/timezone';
import type { MonitorReport } from '../../types/monitor';
import styles from '../workbench.module.css';

const { Title, Paragraph, Text } = Typography;

export default function MonitorPage() {
  const [report, setReport] = useState<MonitorReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const inFlight = useRef(false);

  const refresh = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setLoading(true);
    try {
      const response = await fetch('/api/monitor', { cache: 'no-store' });
      if (!response.ok) throw new Error(`监控请求失败（HTTP ${response.status}）`);
      setReport(await response.json());
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : '无法获取监控状态');
    } finally {
      inFlight.current = false;
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);
  useEffect(() => {
    if (!autoRefresh) return;
    const timer = setInterval(() => void refresh(), 30000);
    return () => clearInterval(timer);
  }, [autoRefresh, refresh]);

  const unavailable = report?.services.filter(service => !service.available) || [];

  return (
    <Layout>
      <div className={styles.page}>
        <div className={styles.header}>
          <Title level={2} className="newspaper-title">
            实时监控
          </Title>
          <Paragraph>查看应用与数据库连通性、Level 1 扫描进度和推送开关。</Paragraph>
        </div>
        <div className={styles.toolbar}>
          <Button icon={<ReloadOutlined />} onClick={() => void refresh()} loading={loading}>
            刷新状态
          </Button>
          <Space>
            <Switch aria-label="自动刷新" checked={autoRefresh} onChange={setAutoRefresh} />
            <Text>每 30 秒自动刷新</Text>
          </Space>
          {report && (
            <Text type="secondary">最近更新：{TimeZoneUtils.format(report.checkedAt)}</Text>
          )}
        </div>
        {error && (
          <Alert
            className={styles.section}
            type="error"
            showIcon
            message={error}
            description={report ? '下方保留最近一次成功获取的状态。' : undefined}
          />
        )}
        {!report && loading && (
          <div style={{ padding: 48, textAlign: 'center' }}>
            <Spin size="large" />
          </div>
        )}
        {report && (
          <>
            {unavailable.length > 0 && (
              <Alert
                className={styles.section}
                type="warning"
                showIcon
                message={`${unavailable.map(service => service.name).join('、')}未通过本轮检测`}
              />
            )}
            <Row gutter={[16, 16]} className={styles.section}>
              {report.services.map(service => (
                <Col xs={24} sm={12} xl={6} key={service.id}>
                  <Card className="newspaper-card" title={service.name}>
                    <Space direction="vertical">
                      <Tag
                        color={
                          service.available === null
                            ? 'default'
                            : service.available
                              ? 'success'
                              : 'error'
                        }
                      >
                        {service.available === null
                          ? '未确认'
                          : service.available
                            ? '可访问'
                            : '连接失败'}
                      </Tag>
                      <Text type="secondary">检测耗时 {service.latencyMs} ms</Text>
                    </Space>
                  </Card>
                </Col>
              ))}
            </Row>
            <Card className="newspaper-card" title="扫描与推送">
              <Descriptions column={1}>
                <Descriptions.Item label="Level 1 扫描">
                  {report.scanner.isRunning ? (
                    <Tag color="processing">正在扫描</Tag>
                  ) : (
                    <Tag>空闲</Tag>
                  )}
                </Descriptions.Item>
                <Descriptions.Item label="扫描进度">
                  {report.scanner.lastScanTime
                    ? TimeZoneUtils.format(report.scanner.lastScanTime)
                    : '暂无扫描记录'}
                </Descriptions.Item>
                <Descriptions.Item label="当前去重记录">
                  {report.scanner.processedNewsCount} 条
                </Descriptions.Item>
                <Descriptions.Item label="钉钉推送开关">
                  <Tag color={report.notificationEnabled ? 'success' : 'default'}>
                    {report.notificationEnabled ? '已开启' : '已关闭'}
                  </Tag>
                </Descriptions.Item>
              </Descriptions>
              <Text type="secondary">扫描进度和去重记录属于当前工作台进程，重启后会重新记录。</Text>
            </Card>
          </>
        )}
      </div>
    </Layout>
  );
}
