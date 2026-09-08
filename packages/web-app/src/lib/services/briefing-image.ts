import type { BriefingDocument } from './notification-briefing';
import { TimeZoneUtils, TIME_FORMATS } from '../utils/timezone';
import { BRIEFING_TIME, briefingExcerpt, briefingPeriod, toneRank } from './briefing-content';

export const BRIEFING_IMAGE_WIDTH = 480;
export const BRIEFING_IMAGE_VERSION = 'plain-3';
const PADDING = 20;
const CONTENT_WIDTH = BRIEFING_IMAGE_WIDTH - PADDING * 2;
const BLOCK_GAP = 14;
const HEADER_HEIGHT = 32;
const TIME_COLUMN_WIDTH = 64;
const TIME_COLUMN_GAP = 12;

const COLORS = {
  ink: '#343434',
  accent: '#537568',
  secondary: '#777777',
  time: '#898F8B',
  paper: '#FFFFFF',
};

export const escapeXml = (value: string): string =>
  value
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\ufffe\uffff]/g, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

const characterWidth = (character: string): number =>
  /^[\u0020-\u007e]$/.test(character) && !/[MWmw@%&]/.test(character) ? 0.62 : 1;

const QUANTITY_PATTERN =
  '\\d+(?:[.,]\\d+)*\\s*(?:[%％]|个?基点|bps?|[万亿]?(?:美元|人民币|亿元|万元|元|吨|台|人|家|股|倍))';
const textWidth = (value: string): number =>
  Array.from(value).reduce((width, character) => width + characterWidth(character), 0);

/** 已选入图片的文字只换行，不截断或补写内容。 */
export const wrapText = (value: string, maxUnits: number): string[] => {
  if (!Number.isFinite(maxUnits) || maxUnits < 1) throw new Error('Invalid text width');
  const lines: string[] = [];
  for (const paragraph of value.replace(/\r\n?/g, '\n').split('\n')) {
    const text = paragraph.replace(/[\t ]+/g, ' ').trim();
    if (!text) continue;
    let line = '';
    let units = 0;
    // 常见财经数值与单位一起换行，避免“3.25”与“%”分离。
    const tokens = (text.match(new RegExp(`${QUANTITY_PATTERN}|.`, 'giu')) ?? []).flatMap(token =>
      textWidth(token) <= maxUnits ? [token] : Array.from(token)
    );
    for (let index = 0; index < tokens.length; index += 1) {
      const token = tokens[index];
      const width = textWidth(token);
      const next = tokens[index + 1] ?? '';
      // 避免中文标点落在行首，以及左括号单独留在行末。
      const keepNext = /^[，。；：！？、）】》”’]/.test(next) || /^[（【《“‘]/.test(token);
      const required = width + (keepNext ? textWidth(next) : 0);
      if (line && units + required > maxUnits) {
        lines.push(line);
        line = '';
        units = 0;
      }
      line += token;
      units += width;
    }
    if (line.trim()) lines.push(line);
  }
  return lines;
};

interface EmphasisRange {
  start: number;
  end: number;
}

const inlineText = (value: string, ranges: EmphasisRange[] = []): string => {
  let cursor = 0;
  let svg = '';
  for (const range of ranges) {
    const start = Math.max(cursor, range.start);
    if (range.end <= start) continue;
    svg += escapeXml(value.slice(cursor, start));
    svg += `<tspan fill="${COLORS.accent}" font-weight="600">${escapeXml(value.slice(start, range.end))}</tspan>`;
    cursor = range.end;
  }
  return svg + escapeXml(value.slice(cursor));
};

const textElement = (
  lines: string[],
  y: number,
  options: {
    size: number;
    weight?: number;
    color?: string;
    lineHeight: number;
    x?: number;
    emphasis?: EmphasisRange[];
  }
): string => {
  const { size, weight = 400, color = COLORS.ink, lineHeight, x = PADDING } = options;
  if (lines.length === 0) return '';
  return `<text x="${x}" y="${y}" fill="${color}" font-size="${size}" font-weight="${weight}">${lines
    .map(
      (line, index) =>
        `<tspan x="${x}" dy="${index === 0 ? 0 : lineHeight}">${inlineText(line, options.emphasis)}</tspan>`
    )
    .join('')}</text>`;
};

export const BRIEFING_IMAGE_MAX_HEIGHT = 1280;

export interface BriefingImage {
  svg: string;
  width: number;
  height: number;
}

interface ImageLine {
  text?: string;
  size?: number;
  weight?: number;
  color?: string;
  height: number;
  emphasis?: EmphasisRange[];
}

interface ImageBlock {
  lines: ImageLine[];
  time: ImageLine[];
}

const timeLines = (value: string): ImageLine[] => {
  const match = value.match(BRIEFING_TIME);
  if (!match) return [];
  const [, qualifier, date, clock] = match;
  const lines: ImageLine[] = [];
  if (date) lines.push({ text: date, size: 10, height: 14, color: COLORS.time });
  // 时间精确到分钟；保留原有“截至”和跨日日期，不补写缺失时间。
  lines.push({
    text: `${qualifier ? '截至' : ''}${clock.slice(0, 5)}`,
    size: 12,
    height: 18,
    color: COLORS.time,
  });
  return lines;
};

const linesFor = (
  value: string,
  size: number,
  height: number,
  options: { weight?: number; color?: string; maxWidth?: number } = {}
): ImageLine[] => {
  const { maxWidth = CONTENT_WIDTH, ...style } = options;
  return wrapText(value, maxWidth / size).map(text => ({
    text,
    size,
    height,
    ...style,
  }));
};

const eventLines = (
  headline: string,
  emphasis: string[] = [],
  maxWidth = CONTENT_WIDTH
): ImageLine[] => {
  // 只使用既有标记且仍在事件句中的文字；旧快照和无标记新闻不猜测重点。
  const ranges = emphasis
    .slice(0, 2)
    .map(phrase => ({
      start: headline.indexOf(phrase),
      end: headline.indexOf(phrase) + phrase.length,
    }))
    .filter(range => range.start >= 0 && range.end > range.start)
    .sort((a, b) => a.start - b.start);
  let offset = 0;
  return linesFor(headline, 18, 26, { maxWidth }).map(line => {
    const length = line.text!.length;
    line.emphasis = ranges
      .filter(range => range.start < offset + length && range.end > offset)
      .map(range => ({
        start: Math.max(0, range.start - offset),
        end: Math.min(length, range.end - offset),
      }));
    offset += length;
    return line;
  });
};

const heightOf = (lines: ImageLine[]): number =>
  lines.reduce((total, line) => total + line.height, 0);

const drawLines = (lines: ImageLine[], startY: number, x = PADDING): string => {
  let y = startY;
  return lines
    .map(line => {
      // 按行盒顶部定位；不同字号紧邻时，不沿用上一行的基线距离制造多余空白。
      const svg =
        line.text !== undefined
          ? textElement([line.text], y + line.size!, {
              size: line.size!,
              lineHeight: line.height,
              weight: line.weight,
              color: line.color,
              emphasis: line.emphasis,
              x,
            })
          : '';
      y += line.height;
      return svg;
    })
    .join('\n');
};

/** 快速播报：保留每条事件句，可附已有短背景；完整详情仍在同一份快照中。 */
export const renderBriefingImages = (briefing: BriefingDocument): BriefingImage[] => {
  const bodyY = PADDING + HEADER_HEIGHT;
  const capacity = BRIEFING_IMAGE_MAX_HEIGHT - bodyY - PADDING - 30;
  const headings = briefing.items.map(briefingExcerpt);
  const hasTimes = headings.some(heading => timeLines(heading.time).length > 0);
  const contentX = PADDING + (hasTimes ? TIME_COLUMN_WIDTH + TIME_COLUMN_GAP : 0);
  const maxWidth = BRIEFING_IMAGE_WIDTH - PADDING - contentX;
  const generatedAt = TimeZoneUtils.format(briefing.createdAt, TIME_FORMATS.NEWS_TIME);
  const period = briefingPeriod(briefing.meta);
  const pages: ImageBlock[][] = [[]];
  let page = pages[0];
  let used = 0;
  const nextPage = () => {
    page = [];
    pages.push(page);
    used = 0;
  };
  const startBlock = (time: ImageLine[]): ImageBlock => {
    const block: ImageBlock = { lines: [], time };
    used += page.length ? BLOCK_GAP : 0;
    page.push(block);
    return block;
  };
  const append = (block: ImageBlock, line: ImageLine) => {
    block.lines.push(line);
    used += line.height;
  };

  const items = briefing.items
    .map((item, index) => ({ item, index }))
    .sort(
      (left, right) =>
        toneRank[left.item.tone] - toneRank[right.item.tone] || left.index - right.index
    );

  items.forEach(({ item, index }) => {
    const { headline, context, time } = headings[index];
    const clock = timeLines(time);
    const heading = eventLines(headline, item.emphasis, maxWidth);
    const body = context ? linesFor(context, 14, 20, { color: COLORS.secondary, maxWidth }) : [];
    const section = [...heading, ...body];
    const timeHeight = heightOf(clock);
    if (timeHeight > heightOf(section)) section.push({ height: timeHeight - heightOf(section) });
    const sectionHeight = heightOf(section);
    const minimumStart = Math.min(sectionHeight, heightOf(heading) + 23, capacity);
    if (
      used > 0 &&
      used + BLOCK_GAP + (sectionHeight <= capacity ? sectionHeight : minimumStart) > capacity
    ) {
      nextPage();
    }
    let block = startBlock(clock);
    for (const line of section) {
      if (used + line.height > capacity && block.lines.length > 0) {
        nextPage();
        block = startBlock(clock);
        append(block, {
          text: '接上图',
          size: 14,
          height: 20,
          color: COLORS.secondary,
        });
      }
      append(block, line);
    }
  });

  return pages.map((blocks, index) => {
    let blockY = bodyY;
    const content = blocks
      .map((block, blockIndex) => {
        if (blockIndex > 0) blockY += BLOCK_GAP;
        const blockHeight = Math.max(heightOf(block.lines), heightOf(block.time));
        const svg = `<g class="briefing-item">
        <g class="briefing-time">${drawLines(block.time, blockY + 4)}</g>
        <g class="briefing-event">${drawLines(block.lines, blockY, contentX)}</g>
      </g>`;
        blockY += blockHeight;
        return svg;
      })
      .join('\n');
    const height = Math.max(64, blockY + PADDING + (pages.length > 1 ? 30 : 0));
    const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${BRIEFING_IMAGE_WIDTH}" height="${height}" viewBox="0 0 ${BRIEFING_IMAGE_WIDTH} ${height}" role="img" aria-label="${escapeXml(briefing.title)} · ${index + 1}/${pages.length}">
  <rect width="${BRIEFING_IMAGE_WIDTH}" height="${height}" fill="${COLORS.paper}"/>
  <g font-family="-apple-system, BlinkMacSystemFont, 'PingFang SC', 'Microsoft YaHei', sans-serif">
    <g class="briefing-period" fill="${COLORS.time}" font-size="12">
      <text x="${PADDING}" y="${PADDING + 12}">${escapeXml(generatedAt)} 生成</text>
      ${period ? `<text x="${BRIEFING_IMAGE_WIDTH - PADDING}" y="${PADDING + 12}" text-anchor="end">时段 ${escapeXml(period)}</text>` : ''}
    </g>
    ${content}
    ${pages.length > 1 ? `<text x="${BRIEFING_IMAGE_WIDTH - PADDING}" y="${blockY + 26}" text-anchor="end" fill="${COLORS.secondary}" font-size="14">${index + 1} / ${pages.length}</text>` : ''}
  </g>
</svg>`;
    return { svg, width: BRIEFING_IMAGE_WIDTH, height };
  });
};

/** 未带页码的既有图片 URL 仍提供全部图页，避免旧消息路径失效。 */
export const renderBriefingSvg = (briefing: BriefingDocument): string => {
  const pages = renderBriefingImages(briefing);
  if (pages.length === 1) return pages[0].svg;
  const height = pages.reduce((total, page) => total + page.height, 0);
  let y = 0;
  const content = pages
    .map(page => {
      const svg = page.svg.replace(/<\?xml[^>]+>\s*/, '').replace('<svg ', `<svg y="${y}" `);
      y += page.height;
      return svg;
    })
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?><svg xmlns="http://www.w3.org/2000/svg" width="${BRIEFING_IMAGE_WIDTH}" height="${height}" viewBox="0 0 ${BRIEFING_IMAGE_WIDTH} ${height}" role="img" aria-label="${escapeXml(briefing.title)}">${content}</svg>`;
};
