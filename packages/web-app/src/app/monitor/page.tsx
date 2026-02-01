'use client';

import { Card, Typography } from 'antd';
import { Layout } from '../../components/Layout';

const { Title, Paragraph } = Typography;

export default function MonitorPage() {
  return (
    <Layout>
      <div className="newspaper-page" style={{ padding: 'var(--space-3xl)' }}>
        <Card className="newspaper-card" style={{ maxWidth: 800, margin: '0 auto' }}>
          <Title level={3} className="newspaper-title">
            👁️ 实时监控
          </Title>
          <Paragraph className="newspaper-body newspaper-content-left">
            实时监控面板正在建设中，后续会展示任务状态与运行指标。
          </Paragraph>
        </Card>
      </div>
    </Layout>
  );
}
