'use client';

import { useState, useEffect } from 'react';
import { Layout } from '../components/Layout';
import { Card } from '../components/ui/Card';
import { Loading } from '../components/ui/Loading';

interface SchedulerStatus {
  running: boolean;
  jobs: Array<{
    name: string;
    schedule: string;
    description: string;
    enabled: boolean;
    running: boolean;
    lastRun?: string;
    nextRun?: string;
  }>;
  timestamp: string;
}

export default function Home() {
  const [schedulerStatus, setSchedulerStatus] = useState<SchedulerStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchSchedulerStatus();
    const interval = setInterval(fetchSchedulerStatus, 30000); // 每30秒更新一次
    return () => clearInterval(interval);
  }, []);

  const fetchSchedulerStatus = async () => {
    try {
      const response = await fetch('/api/scheduler/status');
      const data = await response.json();
      
      if (data.success) {
        setSchedulerStatus(data.data);
        setError(null);
      } else {
        setError(data.error || '获取调度器状态失败');
      }
    } catch (err) {
      setError('网络请求失败');
    } finally {
      setLoading(false);
    }
  };

  const triggerJob = async (jobName: string) => {
    try {
      const response = await fetch(`/api/scheduler/trigger/${jobName}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      const data = await response.json();
      
      if (data.success) {
        alert(`任务 ${jobName} 执行成功`);
      } else {
        alert(`任务 ${jobName} 执行失败: ${data.error}`);
      }
    } catch (err) {
      alert('网络请求失败');
    }
  };

  if (loading) {
    return (
      <Layout>
        <Loading />
      </Layout>
    );
  }

  return (
    <Layout>
    <div className="space-y-6">
        <div className="bg-white rounded-lg shadow p-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            新闻图谱应用
          </h1>
          <p className="text-gray-600 mb-4">
            基于 Next.js 构建的新闻图谱可视化应用，集成了定时任务调度功能
          </p>
          
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-4">
              <div className="flex">
                <div className="text-red-800">
                  <strong>错误:</strong> {error}
      </div>
            </div>
            </div>
          )}
          </div>

        <Card
          title="定时任务调度器"
          subtitle="实时监控和管理定时任务"
        >
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-medium text-gray-900">
                  调度器状态
                </h3>
                <p className="text-sm text-gray-500">
                  {schedulerStatus?.timestamp ? 
                    `最后更新: ${new Date(schedulerStatus.timestamp).toLocaleString()}` : 
                    '状态未知'
                  }
                </p>
              </div>
          <div className="flex items-center">
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                  schedulerStatus?.running 
                    ? 'bg-green-100 text-green-800' 
                    : 'bg-red-100 text-red-800'
                }`}>
                  {schedulerStatus?.running ? '运行中' : '已停止'}
                </span>
              </div>
            </div>

            {schedulerStatus?.jobs && schedulerStatus.jobs.length > 0 && (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        任务名称
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        描述
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        调度配置
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        状态
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        操作
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {schedulerStatus.jobs.map((job) => (
                      <tr key={job.name}>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">
                            {job.name}
            </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm text-gray-900">
                            {job.description}
          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">
                            {job.schedule}
            </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            job.running 
                              ? 'bg-green-100 text-green-800' 
                              : 'bg-gray-100 text-gray-800'
                          }`}>
                            {job.running ? '运行中' : '已停止'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <button
                            onClick={() => triggerJob(job.name)}
                            className="text-indigo-600 hover:text-indigo-900"
                          >
                            手动触发
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
            </div>
            )}
          </div>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <Card
            title="高级别新闻扫描"
            subtitle="实时监控Level 1和Level 2新闻"
          >
            <div className="space-y-3">
              <div className="text-sm text-gray-600">
                • 每5分钟执行一次<br/>
                • 发现新的高级别新闻时发送通知<br/>
                • 支持手动触发扫描
            </div>
              <button
                onClick={() => triggerJob('high-level-scan')}
                className="w-full bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
              >
                立即扫描
              </button>
          </div>
        </Card>

          <Card
            title="小时总结"
            subtitle="生成每小时新闻总结"
          >
            <div className="space-y-3">
              <div className="text-sm text-gray-600">
                • 工作时间(11:00-22:00)每小时执行<br/>
                • 使用AI生成总结报告<br/>
                • 有高级别新闻时发送通知
                  </div>
              <button
                onClick={() => triggerJob('hourly-summary')}
                className="w-full bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 transition-colors"
              >
                生成总结
              </button>
            </div>
        </Card>

          <Card
            title="每日总结"
            subtitle="生成每日新闻总结"
          >
          <div className="space-y-3">
              <div className="text-sm text-gray-600">
                • 每天10:00执行<br/>
                • 总结前一天22:00到当天10:00的新闻<br/>
                • 发送每日总结通知
              </div>
              <button
                onClick={() => triggerJob('daily-summary')}
                className="w-full bg-purple-600 text-white px-4 py-2 rounded-md hover:bg-purple-700 transition-colors"
              >
                生成总结
              </button>
          </div>
        </Card>
      </div>
    </div>
    </Layout>
  );
}
