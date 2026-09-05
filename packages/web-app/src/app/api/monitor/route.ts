import axios from 'axios';
import { NextResponse } from 'next/server';
import { config } from '@/lib/config';
import { highLevelNewsScanner } from '@/lib/services/high-level-scanner';
import type { MonitorReport, ServiceProbe } from '@/types/monitor';

export const dynamic = 'force-dynamic';

async function probe(
  id: ServiceProbe['id'],
  name: string,
  check: () => Promise<boolean | null>
): Promise<ServiceProbe> {
  const started = Date.now();
  try {
    return { id, name, available: await check(), latencyMs: Date.now() - started };
  } catch {
    return { id, name, available: false, latencyMs: Date.now() - started };
  }
}

async function checkWorker(service: string, port: number): Promise<boolean> {
  const response = await axios.get(`http://127.0.0.1:${port}/health`, {
    timeout: 5000,
    maxRedirects: 0,
    proxy: false,
  });
  return (
    response.status === 200 &&
    response.data?.service === service &&
    ['ok', 'healthy'].includes(response.data?.status)
  );
}

export async function GET() {
  const services = await Promise.all([
    probe('web-app', '工作台', async () => true),
    probe('ingest-worker', '新闻采集', () =>
      checkWorker('ingest-worker', config.workers.ingestPort)
    ),
    probe('graph-worker', '新闻分析', () => checkWorker('graph-worker', config.workers.graphPort)),
    probe('neo4j', '图谱数据库', async () => {
      try {
        const response = await axios.get(
          `http://127.0.0.1:${config.workers.graphPort}/api/system/status`,
          { timeout: 5000, maxRedirects: 0, proxy: false }
        );
        const connected = response.data?.data?.services?.knowledgeGraph;
        return response.status === 200 && response.data?.success && typeof connected === 'boolean'
          ? connected
          : null;
      } catch {
        // 无法访问 graph-worker 时，数据库自身的状态仍然未知。
        return null;
      }
    }),
  ]);

  const report: MonitorReport = {
    checkedAt: new Date().toISOString(),
    services,
    scanner: highLevelNewsScanner.getStatus(),
    notificationEnabled: config.notification.enabled,
  };
  return NextResponse.json(report, { headers: { 'Cache-Control': 'no-store' } });
}
