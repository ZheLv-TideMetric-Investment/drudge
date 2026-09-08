import type { BriefingItem } from './notification-briefing';

export const toneRank: Record<BriefingItem['tone'], number> = { core: 0, support: 1, muted: 2 };

// 快捷播报保留事件与已有背景，网址和操作标签留给详情。
const excerptText = (value: string): string =>
  value
    .split(/\r\n?|\n/)
    .map(line => {
      const text = line.replace(/(?:https?:\/\/|www\.)[^\s<>"'，。；！？、（）【】《》)\]]+/gi, '');
      if (text === line) return text;
      return text
        .replace(/(?:原文链接|查看原文|阅读原文|原文|详情|链接|来源)\s*[:：]?\s*$/, '')
        .replace(/\s*[:：]\s*$/, '')
        .trim();
    })
    .join('\n');

const CLOCK = '(?:[01]\\d|2[0-3]):[0-5]\\d(?::[0-5]\\d)?';
export const BRIEFING_TIME = new RegExp(`^(截至\\s*)?(?:(\\d{4}-\\d{2}-\\d{2})\\s+)?(${CLOCK})$`);

export const briefingExcerpt = (
  item: BriefingItem
): { headline: string; context: string; time: string } => {
  let context = '';
  const selectContext = (label: string, value: string) => {
    if (context) return;
    const text = excerptText(value).replace(/\s+/g, ' ').trim();
    if (!text) return;
    // 仅使用已有历史/背景的首个完整句，不按字数硬截，也不从实体清单推断历史。
    const sentence = text.match(/^.*?[。！？][”’」』]?/u)?.[0] ?? text;
    context = `${label}：${sentence}`;
  };
  const historyPattern = /(?:\[|【)(历史|背景)\s*[:：]([^\]】]*)(?:\]|】)/g;
  let headline = excerptText(item.headline)
    .replace(historyPattern, (_match, label: string, value: string) => {
      selectContext(label, value);
      return '';
    })
    .replace(/\s+/g, ' ')
    .trim();
  for (const paragraph of item.detail.split(/\r\n?|\n/)) {
    const marked = paragraph.match(/^(历史|背景)\s*[:：]\s*(.+)$/);
    if (marked) selectContext(marked[1], marked[2]);
    for (const match of paragraph.matchAll(historyPattern)) selectContext(match[1], match[2]);
  }
  if (item.url) headline = headline.replace(/\s+(?:原文|查看原文|阅读原文)\s*$/, '');
  const timestamp = headline.match(
    /\s*[（(]((?:截至\s*)?(?:\d{4}-\d{2}-\d{2}\s+)?\d{2}:\d{2}(?::\d{2})?)[）)]\s*$/
  );
  if (timestamp && item.time && timestamp[1].includes(item.time)) {
    const event = headline.slice(0, timestamp.index).trim();
    if (event && BRIEFING_TIME.test(timestamp[1])) {
      return { headline: event, context, time: timestamp[1] };
    }
  }
  return { headline, context, time: item.time.trim() };
};

export const briefingPeriod = (meta: string): string => {
  const candidate = meta.split('·')[0].trim();
  const datedClock = `(?:(?:\\d{4}-)?\\d{2}-\\d{2}\\s+)?${CLOCK}`;
  return new RegExp(`^${datedClock}\\s*[-–—~～]\\s*${datedClock}$`).test(candidate)
    ? candidate.replace(/(:\d{2})\s*[-–—~～]\s*/g, '$1–')
    : '';
};
