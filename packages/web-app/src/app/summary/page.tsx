'use client';

import { Card, Typography } from 'antd';
import { Layout } from '../../components/Layout';

const { Title, Paragraph } = Typography;

export default function SummaryPage() {
  return (
    <Layout>
      <div className="newspaper-page" style={{ padding: 'var(--space-3xl)' }}>
        <Card className="newspaper-card" style={{ maxWidth: 800, margin: '0 auto' }}>
          <Title level={3} className="newspaper-title">
            📄 总结报告
          </Title>
          <Paragraph className="newspaper-body newspaper-content-left">
            总结报告页面正在建设中。当前可以通过 <code>/api/summary</code> 获取摘要数据。
          </Paragraph>
        </Card>
      </div>
    </Layout>
  );
}
