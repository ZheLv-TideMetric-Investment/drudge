import { TimeZoneUtils, TIME_FORMATS } from '../utils/timezone';

export type BriefingTone = 'core' | 'support' | 'muted';

export interface BriefingItem {
  id: string;
  level: string;
  tone: BriefingTone;
  label: string;
  headline: string;
  emphasis?: string[];
  time: string;
  detail: string;
  source: string;
  url: string;
}

export interface BriefingDraft {
  title: string;
  meta: string;
  l1Count: number;
  l2Count: number;
  l3PlusCount: number;
  items: BriefingItem[];
}

export interface BriefingDocument extends BriefingDraft {
  id: string;
  createdAt: string;
}

const LIST_LABEL_LENGTH = 8;

const asList = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return value.map(item => String(item).trim()).filter(Boolean);
};

const resolveDate = (value: unknown): Date | null => {
  if (value === null || value === undefined || value === '') return null;

  const normalized =
    typeof value === 'number' && value > 0 && value < 1_000_000_000_000 ? value * 1000 : value;
  const date = new Date(normalized as string | number | Date);
  return Number.isNaN(date.getTime()) ? null : date;
};

const formatShortTime = (value: unknown): string => {
  const date = resolveDate(value);
  return date ? TimeZoneUtils.format(date, TIME_FORMATS.TIME_SHORT) : '';
};

const levelNumber = (value: unknown): number | null => {
  const text = String(value ?? '');
  const match = text.match(/(?:level|l)\s*([1-9]\d*)|([1-9]\d*)\s*级/i);
  const raw = match?.[1] ?? match?.[2];
  return raw ? Number(raw) : null;
};

const levelLabel = (value: unknown): string => {
  const number = levelNumber(value);
  return number ? `L${number}` : 'INFO';
};

const toneForLevel = (value: unknown): BriefingTone => {
  const number = levelNumber(value);
  if (number === 1) return 'core';
  if (number === 2) return 'support';
  return 'muted';
};

export const plainText = (value: string): string => {
  return value
    .replace(/\[([^\]]+)]\([^)]+\)/g, '$1')
    .replace(/<br\s*\/?\s*>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/^\s{0,3}#{1,6}\s*/gm, '')
    .replace(/^\s*>\s?/gm, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/[*`~]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
};

export const detailText = (value: string): string => {
  return value
    .replace(/\r\n?/g, '\n')
    .replace(/<br\s*\/?\s*>/gi, '\n')
    .replace(/\[([^\]]+)]\(([^)]+)\)/g, '$1：$2')
    .replace(/<[^>]+>/g, '')
    .replace(/^\s{0,3}#{1,6}\s*/gm, '')
    .replace(/^\s*>\s?/gm, '')
    .replace(/^\s*-{3,}\s*$/gm, '')
    .replace(/^\s*[-*]\s+/gm, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/[*`~]/g, '')
    .replace(/[ \t]*\n[ \t]*/g, '\n')
    .replace(/\n{2,}/g, '\n')
    .trim();
};

export const safeWebUrl = (value: unknown): string => {
  const raw = String(value ?? '').trim();
  if (!raw) return '';

  try {
    const parsed = new URL(raw);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:' ? parsed.toString() : '';
  } catch {
    return '';
  }
};

const shortenLabel = (value: string): string => {
  const characters = Array.from(plainText(value));
  if (characters.length <= LIST_LABEL_LENGTH) return characters.join('');
  return `${characters.slice(0, LIST_LABEL_LENGTH).join('')}…`;
};

const extractClock = (value: string): string => {
  return value.match(/(?:^|[^\d])(\d{2}:\d{2})(?:[^\d]|$)/)?.[1] ?? '';
};

const makeItem = (
  id: string,
  level: unknown,
  headline: string,
  detail: string,
  options: { time?: string; source?: string; url?: string; tone?: BriefingTone } = {}
): BriefingItem => {
  const normalizedHeadline = plainText(headline) || '摘要';
  const emphasis = [
    ...new Set(Array.from(headline.matchAll(/\*\*([^*]+)\*\*/g), match => plainText(match[1]))),
  ]
    .filter(phrase => phrase && normalizedHeadline.includes(phrase))
    .slice(0, 2);
  return {
    id,
    level: levelLabel(level),
    tone: options.tone ?? toneForLevel(level),
    label: shortenLabel(normalizedHeadline),
    headline: normalizedHeadline,
    ...(emphasis.length ? { emphasis } : {}),
    time: options.time ?? extractClock(headline),
    detail: detailText(detail),
    source: plainText(options.source ?? ''),
    url: safeWebUrl(options.url),
  };
};

interface SummaryDraft {
  level: string;
  lines: string[];
}

export const parseSummaryItems = (summary: string): BriefingItem[] => {
  const drafts: SummaryDraft[] = [];
  const preamble: string[] = [];
  let currentLevel = 'INFO';
  let current: SummaryDraft | null = null;

  const flush = () => {
    if (!current) return;
    if (current.lines.some(line => line.trim())) drafts.push(current);
    current = null;
  };

  for (const rawLine of summary.replace(/\r\n?/g, '\n').split('\n')) {
    const line = rawLine.trimEnd();
    const trimmed = line.trim();
    if (!trimmed || /^-{3,}$/.test(trimmed)) continue;

    const headingLevel = trimmed.match(/^#{1,6}\s*(?:(?:Level|L)\s*)?(\d+)\s*级?新闻总结/i);
    if (headingLevel) {
      flush();
      currentLevel = `L${headingLevel[1]}`;
      continue;
    }

    if (/^#{1,6}\s*新闻内容\s*$/.test(trimmed)) continue;

    const bullet = trimmed.match(/^[-*]\s+(.+)$/);
    if (bullet) {
      flush();
      current = { level: currentLevel, lines: [bullet[1]] };
      continue;
    }

    if (current) current.lines.push(trimmed);
    else preamble.push(trimmed);
  }

  flush();

  if (preamble.length > 0) drafts.unshift({ level: 'INFO', lines: preamble });
  if (drafts.length === 0 && summary.trim())
    drafts.push({ level: 'INFO', lines: [summary.trim()] });

  return drafts.map((draft, index) => {
    const headline = draft.lines[0]?.trim() || '摘要';
    const allText = draft.lines.join('\n');
    const firstLink = allText.match(/\[[^\]]+\]\(([^)]+)\)/)?.[1] ?? '';
    const linksInHeadline = Array.from(headline.matchAll(/\[([^\]]+)]\(([^)]+)\)/g)).map(
      match => `${match[1]}：${match[2]}`
    );
    const detail = [...draft.lines.slice(1), ...linksInHeadline].join('\n');

    return makeItem(`summary-${index + 1}`, draft.level, headline, detail, {
      time: extractClock(headline),
      url: firstLink,
    });
  });
};

const joinField = (label: string, values: unknown): string => {
  const items = asList(values);
  return items.length > 0 ? `${label}：${items.join('、')}` : '';
};

const newsToItem = (news: any, index: number): BriefingItem => {
  const title = String(news?.title || '未命名新闻').trim();
  const detail = [
    news?.urgency ? `紧急度：${String(news.urgency)}` : '',
    news?.content ? `事实：${String(news.content).trim()}` : '',
    joinField('公司', news?.companies),
    joinField('人物', news?.persons),
    joinField('机构', news?.organizations),
    joinField('事件', news?.events),
  ]
    .filter(Boolean)
    .join('\n');

  return makeItem(
    `news-${String(news?.newsId || index + 1)}-${index}`,
    news?.level,
    title,
    detail,
    {
      time: formatShortTime(news?.timestamp ?? news?.time),
      source: String(news?.source || ''),
      url: String(news?.url || ''),
    }
  );
};

const countLevels = (values: Array<{ level?: unknown }>) => {
  let l1Count = 0;
  let l2Count = 0;
  let l3PlusCount = 0;

  values.forEach(value => {
    const number = levelNumber(value.level);
    if (number === 1) l1Count += 1;
    else if (number === 2) l2Count += 1;
    else l3PlusCount += 1;
  });

  return { l1Count, l2Count, l3PlusCount };
};

const formatRange = (start: unknown, end: unknown): string => {
  const startDate = resolveDate(start);
  const endDate = resolveDate(end);
  if (!startDate || !endDate) return '';

  return `${TimeZoneUtils.format(startDate, TIME_FORMATS.NEWS_TIME)}-${TimeZoneUtils.format(
    endDate,
    TIME_FORMATS.TIME_SHORT
  )}`;
};

const formatNewsRange = (newsItems: any[]): string => {
  const times = newsItems
    .map(news => resolveDate(news?.timestamp ?? news?.time)?.getTime() ?? null)
    .filter((value): value is number => value !== null)
    .sort((a, b) => a - b);
  if (times.length === 0) return TimeZoneUtils.now(TIME_FORMATS.TIME_SHORT);
  const first = TimeZoneUtils.format(new Date(times[0]), TIME_FORMATS.TIME_SHORT);
  const last = TimeZoneUtils.format(new Date(times[times.length - 1]), TIME_FORMATS.TIME_SHORT);
  return first === last ? first : `${first}-${last}`;
};

const buildMeta = (range: string, count: number): string => {
  return [range, `${count} 条`].filter(Boolean).join(' · ');
};

export const buildBatchNewsBriefing = (newsItems: any[]): BriefingDraft => ({
  title: '重点财经快讯',
  meta: buildMeta(formatNewsRange(newsItems), newsItems.length),
  ...countLevels(newsItems),
  items: newsItems.map(newsToItem),
});

export const buildSingleNewsBriefing = (news: any): BriefingDraft => ({
  title: '重点财经快讯',
  meta: buildMeta(formatNewsRange([news]), 1),
  ...countLevels([news]),
  items: [newsToItem(news, 0)],
});

export const buildSummaryBriefing = (
  summary: string,
  start: unknown,
  end: unknown,
  newsItems: any[]
): BriefingDraft => {
  let items = parseSummaryItems(summary);
  const sourceCounts = countLevels(newsItems);

  if (!items.some(item => item.level === 'L1') && sourceCounts.l1Count > 0) {
    const l1Items = newsItems
      .filter(news => levelNumber(news?.level) === 1)
      .map((news, index) => newsToItem(news, index));
    items = [...l1Items, ...items];
  }

  if (items.length === 0) items = newsItems.map(newsToItem);
  const counts = newsItems.length > 0 ? sourceCounts : countLevels(items);

  return {
    title: '财经摘要',
    meta: buildMeta(formatRange(start, end), newsItems.length || items.length),
    ...counts,
    items,
  };
};

export const buildSystemAlertBriefing = (title: string, message: string): BriefingDraft => ({
  title: '系统提醒',
  meta: TimeZoneUtils.now(TIME_FORMATS.TIME_SHORT),
  l1Count: 1,
  l2Count: 0,
  l3PlusCount: 0,
  items: [
    makeItem('system-alert', 'L1', title, message, {
      tone: 'core',
      time: TimeZoneUtils.now(TIME_FORMATS.TIME_SHORT),
      source: 'Drudge',
    }),
  ],
});
