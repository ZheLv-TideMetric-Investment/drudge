import axios from 'axios';
import type { BriefingDocument } from '../../src/lib/services/notification-briefing';
import { setEnv } from '../helpers/env';

const mockedAxios = axios as jest.Mocked<typeof axios>;

const briefing: BriefingDocument = {
  id: '0123456789abcdef0123456789abcdef',
  createdAt: '2026-09-03T01:00:00.000Z',
  title: '重点财经快讯',
  meta: '14:30-14:35 · 3 条',
  l1Count: 1,
  l2Count: 1,
  l3PlusCount: 1,
  items: [
    {
      id: 'one',
      level: 'L1',
      tone: 'core',
      label: '美联储',
      headline: '美联储维持利率不变',
      emphasis: ['维持利率不变'],
      time: '14:30',
      detail: '事实：目标区间维持不变',
      source: 'futu_live',
      url: 'https://example.com/one',
    },
  ],
};

const configure = (overrides: Record<string, string | undefined> = {}) =>
  setEnv({
    WEB_ENABLE_DINGTALK_NOTIFICATION: undefined,
    ENABLE_DINGTALK_NOTIFICATION: 'true',
    DINGTALK_APP_CLIENT_ID: 'client-id',
    DINGTALK_APP_CLIENT_SECRET: 'client-secret',
    DINGTALK_TARGET_USER_ID: 'designated-user-id',
    BRIEFING_PUBLIC_BASE_URL: 'https://news.example.com',
    BRIEFING_STORAGE_PATH: '/tmp/drudge-test-briefings',
    DRUDGE_BRIEFING_PUBLIC_HOST: 'news.example.com',
    ...overrides,
  });

describe('dingtalkMessageService', () => {
  beforeEach(() => {
    mockedAxios.post.mockReset();
  });

  it('puts the event, existing time and emphasis directly in Markdown with one detail link', async () => {
    const { buildBriefingMessage } = await import('../../src/lib/services/dingtalk-message');
    const message = buildBriefingMessage(briefing, 'https://news.example.com/');

    expect(message.detailUrl).toBe(
      'https://news.example.com/briefings/0123456789abcdef0123456789abcdef'
    );
    expect(message.text).toContain('14:30 · 美联储**维持利率不变**');
    expect(message.text).toContain('时段 14:30–14:35');
    expect(message.text).not.toMatch(/!\[|image\.(?:png|svg)|L1|futu_live/);
    expect(message.text).not.toContain(briefing.title);
    expect(message.text).toContain(`[查看完整详情 · 1 条 →](${message.detailUrl})`);
    expect(message.text).not.toContain(briefing.items[0].detail);
  });

  it('includes all forty events without truncation and leaves full details in H5', async () => {
    const { buildBriefingMessage } = await import('../../src/lib/services/dingtalk-message');
    const document = {
      ...briefing,
      items: Array.from({ length: 40 }, (_, index) => ({
        ...briefing.items[0],
        id: `news-${index}`,
        headline: `第${index + 1}条事件仍需审批`,
        detail: '事实：全部信息保留。'.repeat(30),
      })),
    };
    const message = buildBriefingMessage(document, 'https://news.example.com');
    document.items.forEach(item => expect(message.text).toContain(item.headline));
    expect(message.text).not.toContain('全部信息保留');
    expect(message.text).not.toContain('![');
    expect(message.text.match(/查看完整详情/g)).toHaveLength(1);
    expect(message.text.indexOf(document.items.at(-1)!.headline)).toBeLessThan(
      message.text.indexOf('查看完整详情')
    );
  });

  it('keeps event qualifiers, as-of date and one existing history sentence without changing the snapshot', async () => {
    const { buildBriefingMessage } = await import('../../src/lib/services/dingtalk-message');
    const { parseSummaryItems } = await import('../../src/lib/services/notification-briefing');
    const document = {
      ...briefing,
      items: parseSummaryItems(`## Level 2级新闻总结
- 某企业**拟投资12亿元**，仍需审批。 *(截至 2026-09-05 14:30)* [历史：去年披露过扩产计划。更早资料另见详情。] [原文](https://example.com/source)`),
    };
    const before = JSON.stringify(document);
    const { text } = buildBriefingMessage(document, 'https://news.example.com');
    expect(text).toContain('截至 2026\\-09\\-05 14:30 · 某企业**拟投资12亿元**，仍需审批。');
    expect(text).toContain('\n\n> 历史：去年披露过扩产计划。');
    expect(text).not.toMatch(/更早资料|https:\/\/example.com\/source|L2|\[历史/);
    expect(JSON.stringify(document)).toBe(before);
  });

  it('retains priority ordering and leaves missing time and history absent', async () => {
    const { buildBriefingMessage } = await import('../../src/lib/services/dingtalk-message');
    const document: BriefingDocument = {
      ...briefing,
      meta: '2 条',
      items: [
        {
          ...briefing.items[0],
          id: 'muted',
          tone: 'muted',
          headline: '补充事件',
          time: '测试',
          detail: '',
        },
        { ...briefing.items[0], id: 'core', headline: '核心事件', time: '', detail: '' },
      ],
    };
    const { text } = buildBriefingMessage(document, 'https://news.example.com');
    expect(text.indexOf('核心事件')).toBeLessThan(text.indexOf('补充事件'));
    expect(text).not.toMatch(/测试|14:30|历史|背景|时段|暂无|\*\*/);
  });

  it('escapes literal Markdown characters and merges overlapping emphasis without duplicating text', async () => {
    const { buildBriefingMessage } = await import('../../src/lib/services/dingtalk-message');
    const document = {
      ...briefing,
      items: [
        {
          ...briefing.items[0],
          headline: '某公司拟投资12亿元，[A_B] <待确认>',
          emphasis: ['拟投', '投资12亿元'],
          detail: '',
        },
      ],
    };
    const { text } = buildBriefingMessage(document, 'https://news.example.com');
    expect(text).toContain('某公司**拟投资12亿元**，\\[A\\_B\\] \\<待确认\\>');
    expect(text).not.toContain('****');
  });

  it('does not call DingTalk when disabled or incompletely configured', async () => {
    let restore = configure({ ENABLE_DINGTALK_NOTIFICATION: 'false' });
    try {
      jest.resetModules();
      const { dingtalkMessageService } = await import('../../src/lib/services/dingtalk-message');
      await expect(dingtalkMessageService.sendBriefing(briefing)).resolves.toBe(false);
      expect(mockedAxios.post).not.toHaveBeenCalled();
    } finally {
      restore();
    }

    restore = configure({ BRIEFING_PUBLIC_BASE_URL: '' });
    try {
      jest.resetModules();
      const { dingtalkMessageService } = await import('../../src/lib/services/dingtalk-message');
      await expect(dingtalkMessageService.sendBriefing(briefing)).resolves.toBe(false);
      expect(mockedAxios.post).not.toHaveBeenCalled();
    } finally {
      restore();
    }
  });

  it.each([
    ['comma list', 'first-user,second-user'],
    ['space list', 'first-user second-user'],
    ['empty target', ''],
  ])('rejects %s instead of broadening the recipient', async (_label, targetUserId) => {
    const restore = configure({ DINGTALK_TARGET_USER_ID: targetUserId });
    try {
      jest.resetModules();
      const { dingtalkMessageService } = await import('../../src/lib/services/dingtalk-message');
      await expect(dingtalkMessageService.sendBriefing(briefing)).resolves.toBe(false);
      expect(mockedAxios.post).not.toHaveBeenCalled();
    } finally {
      restore();
    }
  });

  it.each([
    'http://news.example.com',
    'https://user:pass@news.example.com',
    'https://news.example.com/subpath',
    'not-a-url',
  ])('rejects unsafe public base URL %s', async publicBaseUrl => {
    const restore = configure({ BRIEFING_PUBLIC_BASE_URL: publicBaseUrl });
    try {
      jest.resetModules();
      const { dingtalkMessageService } = await import('../../src/lib/services/dingtalk-message');
      await expect(dingtalkMessageService.sendBriefing(briefing)).resolves.toBe(false);
      expect(mockedAxios.post).not.toHaveBeenCalled();
    } finally {
      restore();
    }
  });

  it('fails closed when the public URL changed after the Web App build', async () => {
    const restore = configure({ DRUDGE_BRIEFING_PUBLIC_HOST: 'old.example.com' });
    try {
      jest.resetModules();
      const { dingtalkMessageService } = await import('../../src/lib/services/dingtalk-message');
      await expect(dingtalkMessageService.sendBriefing(briefing)).resolves.toBe(false);
      expect(mockedAxios.post).not.toHaveBeenCalled();
    } finally {
      restore();
    }
  });

  it('sends Markdown to exactly one explicit robot chat without card-template fields', async () => {
    const restore = configure();
    try {
      mockedAxios.post
        .mockResolvedValueOnce({
          status: 200,
          data: { accessToken: 'access-token', expireIn: 7200 },
        } as any)
        .mockResolvedValueOnce({
          status: 200,
          data: {
            processQueryKey: 'query-key',
            invalidStaffIdList: [],
            flowControlledStaffIdList: [],
          },
        } as any);

      jest.resetModules();
      const { dingtalkMessageService } = await import('../../src/lib/services/dingtalk-message');

      await expect(dingtalkMessageService.sendBriefing(briefing)).resolves.toBe(true);
      expect(mockedAxios.post).toHaveBeenCalledTimes(2);

      const [tokenUrl, tokenBody] = mockedAxios.post.mock.calls[0];
      expect(tokenUrl).toContain('/v1.0/oauth2/accessToken');
      expect(tokenBody).toEqual({ appKey: 'client-id', appSecret: 'client-secret' });

      const [messageUrl, payload, requestConfig] = mockedAxios.post.mock.calls[1];
      expect(messageUrl).toContain('/v1.0/robot/oToMessages/batchSend');
      expect(payload).toMatchObject({
        robotCode: 'client-id',
        userIds: ['designated-user-id'],
        msgKey: 'sampleMarkdown',
      });
      expect(payload).not.toHaveProperty('openConversationId');
      expect(payload).not.toHaveProperty('cardTemplateId');
      expect(payload).not.toHaveProperty('atAll');
      const message = JSON.parse(payload.msgParam);
      expect(message.text).toContain('14:30 · 美联储**维持利率不变**');
      expect(message.text).not.toMatch(/!\[|\/image\.(?:png|svg)/);
      expect(message.text).toContain('/briefings/0123456789abcdef0123456789abcdef');
      expect(requestConfig?.headers?.['x-acs-dingtalk-access-token']).toBe('access-token');
    } finally {
      restore();
    }
  });

  it('reuses a token and treats invalid or throttled recipients as failure', async () => {
    const restore = configure();
    try {
      mockedAxios.post
        .mockResolvedValueOnce({
          status: 200,
          data: { accessToken: 'access-token', expireIn: 7200 },
        } as any)
        .mockResolvedValueOnce({ status: 200, data: { processQueryKey: 'one' } } as any)
        .mockResolvedValueOnce({
          status: 200,
          data: { processQueryKey: 'two', invalidStaffIdList: ['designated-user-id'] },
        } as any)
        .mockResolvedValueOnce({
          status: 200,
          data: { processQueryKey: 'three', flowControlledStaffIdList: ['designated-user-id'] },
        } as any);

      jest.resetModules();
      const { dingtalkMessageService } = await import('../../src/lib/services/dingtalk-message');

      await expect(dingtalkMessageService.sendBriefing(briefing)).resolves.toBe(true);
      await expect(dingtalkMessageService.sendBriefing(briefing)).resolves.toBe(false);
      await expect(dingtalkMessageService.sendBriefing(briefing)).resolves.toBe(false);
      expect(mockedAxios.post).toHaveBeenCalledTimes(4);
      expect(
        mockedAxios.post.mock.calls.filter(([url]) => String(url).includes('accessToken'))
      ).toHaveLength(1);
    } finally {
      restore();
    }
  });

  it('checks authentication health without sending a message and exposes no secrets', async () => {
    const restore = configure();
    try {
      mockedAxios.post.mockResolvedValueOnce({
        status: 200,
        data: { accessToken: 'access-token', expireIn: 7200 },
      } as any);
      jest.resetModules();
      const { dingtalkMessageService } = await import('../../src/lib/services/dingtalk-message');

      await expect(dingtalkMessageService.healthCheck()).resolves.toBe(true);
      expect(mockedAxios.post).toHaveBeenCalledTimes(1);
      expect(dingtalkMessageService.getStatus()).toEqual(
        expect.objectContaining({
          enabled: true,
          mode: 'explicit_single_user_markdown_h5',
          configured: true,
        })
      );
      expect(JSON.stringify(dingtalkMessageService.getStatus())).not.toContain('client-secret');
    } finally {
      restore();
    }
  });
});
