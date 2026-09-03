import { saveBriefing } from '../lib/services/briefing-store';
import { dingtalkMessageService } from '../lib/services/dingtalk-message';
import type { BriefingDraft } from '../lib/services/notification-briefing';

const TEST_BRIEFING: BriefingDraft = {
  title: 'Drudge 展示测试',
  meta: '图片摘要 + H5 详情 · 3 条模拟数据',
  l1Count: 1,
  l2Count: 1,
  l3PlusCount: 1,
  items: [
    {
      id: 'display-test-core',
      level: 'L1',
      tone: 'core',
      label: '首要信息',
      headline: '首要信息层级示例',
      time: '测试',
      detail: '事实：摘要图首先呈现最高优先级信息\n事件：本条仅用于展示验证，不是真实财经新闻',
      source: 'system_test',
      url: '',
    },
    {
      id: 'display-test-support',
      level: 'L2',
      tone: 'support',
      label: '次要信息',
      headline: '次要信息层级示例',
      time: '测试',
      detail: '事实：使用克制的第二主色区分信息层级\n事件：点击左侧目录可直接切换右侧详情',
      source: 'system_test',
      url: '',
    },
    {
      id: 'display-test-muted',
      level: 'L3',
      tone: 'muted',
      label: '补充信息',
      headline: '补充信息层级示例',
      time: '测试',
      detail: '事实：补充内容降低视觉权重但不删除\n事件：完整内容保留在 H5 详情中',
      source: 'system_test',
      url: '',
    },
  ],
};

const run = async () => {
  const briefing = await saveBriefing(TEST_BRIEFING);
  const sent = await dingtalkMessageService.sendBriefing(briefing);
  if (!sent) throw new Error('测试简报未被钉钉接受');

  console.log('Drudge 展示测试发送完成', { briefingId: briefing.id });
};

run().catch(error => {
  console.error('Drudge 展示测试失败', error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
