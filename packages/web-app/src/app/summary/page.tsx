'use client';

import { useEffect, useRef, useState } from 'react';
import { Alert, Button, Card, Checkbox, Empty, Space, Tag, Typography } from 'antd';
import { FileTextOutlined } from '@ant-design/icons';
import { Layout } from '../../components/Layout';
import {
  buildSummaryParams,
  buildSummaryRange,
  type SummaryRange,
} from '../../lib/utils/summary-request';
import type { SummaryResult } from '../../types/scheduler';
import styles from '../workbench.module.css';

const { Title, Paragraph, Text } = Typography;

export default function SummaryPage() {
  const [range, setRange] = useState<SummaryRange>({ start: '', end: '' });
  const [sendNotification, setSendNotification] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [report, setReport] = useState<SummaryResult | null>(null);
  const [delivered, setDelivered] = useState(false);
  const inFlight = useRef(false);

  useEffect(() => setRange(buildSummaryRange('previous-hour')), []);

  async function generate() {
    if (inFlight.current) return;
    setError('');
    try {
      const params = buildSummaryParams(range, sendNotification);
      inFlight.current = true;
      setLoading(true);
      setReport(null);
      setDelivered(false);
      const response = await fetch(`/api/summary?${params}`, { cache: 'no-store' });
      const result: SummaryResult = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.error || result.message || '总结生成失败');
      }
      setReport(result);
      setDelivered(sendNotification && !result.data?.empty);
    } catch (err) {
      setError(err instanceof Error ? err.message : '请求失败，请重试');
    } finally {
      inFlight.current = false;
      setLoading(false);
    }
  }

  return (
    <Layout>
      <div className={styles.page}>
        <div className={styles.header}>
          <Title level={2} className="newspaper-title">
            总结报告
          </Title>
          <Paragraph>按时间范围整理财经新闻，阅读完整总结。所有时间均为北京时间。</Paragraph>
        </div>

        <Card className={`newspaper-card ${styles.section}`} title="生成总结">
          <div className={styles.toolbar}>
            <Button disabled={loading} onClick={() => setRange(buildSummaryRange('previous-hour'))}>
              上一完整小时
            </Button>
            <Button disabled={loading} onClick={() => setRange(buildSummaryRange('today'))}>
              今天
            </Button>
            <Button disabled={loading} onClick={() => setRange(buildSummaryRange('last-day'))}>
              最近 24 小时
            </Button>
          </div>
          <div className={styles.range}>
            <label className={styles.field}>
              开始时间（北京时间）
              <input
                className={styles.dateInput}
                type="datetime-local"
                value={range.start}
                disabled={loading}
                onChange={event => setRange({ ...range, start: event.target.value })}
              />
            </label>
            <label className={styles.field}>
              结束时间（北京时间）
              <input
                className={styles.dateInput}
                type="datetime-local"
                value={range.end}
                disabled={loading}
                onChange={event => setRange({ ...range, end: event.target.value })}
              />
            </label>
          </div>
          <Space wrap size="large">
            <Checkbox
              checked={sendNotification}
              disabled={loading}
              onChange={event => setSendNotification(event.target.checked)}
            >
              同时推送到钉钉
            </Checkbox>
            <Button
              type="primary"
              className="newspaper-button"
              icon={<FileTextOutlined />}
              loading={loading}
              onClick={generate}
            >
              {sendNotification ? '生成并推送' : '生成总结'}
            </Button>
          </Space>
        </Card>

        {loading && (
          <Alert
            className={styles.section}
            type="info"
            showIcon
            message="正在分析新闻并生成总结，请稍候…"
          />
        )}
        {error && (
          <Alert
            className={styles.section}
            type="error"
            showIcon
            message="总结生成失败"
            description={error}
          />
        )}
        {report && (
          <Card className="newspaper-card" title={report.period || '总结结果'}>
            {report.data?.empty ? (
              <Empty description="这个时间范围内没有新闻，请调整时间后再试。" />
            ) : (
              <>
                <Space wrap>
                  <Tag>新闻 {report.data?.news_count ?? '—'} 条</Tag>
                  <Tag color="red">Level 1：{report.data?.high_level_count ?? '—'} 条</Tag>
                  {delivered && <Tag color="success">已推送到钉钉</Tag>}
                  <Text copyable={{ text: String(report.data?.summary || '') }}>复制总结</Text>
                </Space>
                <div className={styles.report}>{report.data?.summary}</div>
              </>
            )}
          </Card>
        )}
        {!report && !loading && !error && <Empty description="选择时间范围后生成总结" />}
      </div>
    </Layout>
  );
}
