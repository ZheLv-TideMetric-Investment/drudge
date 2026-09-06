import type { BriefingDocument, BriefingItem } from './notification-briefing';

export const BRIEFING_IMAGE_WIDTH = 720;
export const BRIEFING_IMAGE_VERSION = 'quick-2';
const PADDING = 36;
const CONTENT_WIDTH = BRIEFING_IMAGE_WIDTH - PADDING * 2;
const BLOCK_PADDING = 12;
const BLOCK_GAP = 16;

const COLORS = {
  ink: '#35453D',
  accent: '#587466',
  secondary: '#6D7870',
  block: '#F0F3EE',
  paper: '#FAFBF8',
};

// 图片不承担点击或复制操作；只移除网址，正文与来源名称继续保留。
const imageText = (value: string): string =>
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

const toneRank: Record<BriefingItem['tone'], number> = { core: 0, support: 1, muted: 2 };

interface Emphasis {
  start: number;
  end: number;
}

const inlineText = (value: string, emphasis: Emphasis[] = []): string => {
  let position = 0;
  const spans = emphasis.map(({ start, end }) => {
    const span = `${escapeXml(value.slice(position, start))}<tspan font-weight="700" fill="${COLORS.accent}">${escapeXml(value.slice(start, end))}</tspan>`;
    position = end;
    return span;
  });
  return spans.join('') + escapeXml(value.slice(position));
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
    emphasis?: Emphasis[];
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

const imageHeading = (item: BriefingItem): { headline: string; time: string; context: string } => {
  let context = '';
  const selectContext = (label: string, value: string) => {
    if (context) return;
    const text = imageText(value).replace(/\s+/g, ' ').trim();
    if (!text) return;
    // 仅使用已有历史/背景的首个完整句，不按字数硬截，也不从实体清单推断历史。
    const sentence = text.match(/^.*?[。！？][”’」』]?/u)?.[0] ?? text;
    context = `${label}：${sentence}`;
  };
  const historyPattern = /(?:\[|【)(历史|背景)\s*[:：]([^\]】]*)(?:\]|】)/g;
  let headline = imageText(item.headline)
    .replace(historyPattern, (_match, label: string, value: string) => {
      selectContext(label, value);
      return '';
    })
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
    if (event) return { headline: event, time: timestamp[1], context };
  }
  return { headline, time: item.time, context };
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
  emphasis?: Emphasis[];
}

interface ImageBlock {
  lines: ImageLine[];
}

const linesFor = (
  value: string,
  size: number,
  height: number,
  options: { weight?: number; color?: string } = {}
): ImageLine[] =>
  wrapText(value, CONTENT_WIDTH / size).map(text => ({
    text,
    size,
    height,
    ...options,
  }));

const eventLines = (headline: string): ImageLine[] => {
  const lines = linesFor(headline, 30, 42, { weight: 600 });
  let emphasisLeft = 2;
  for (const line of lines) {
    // 强调放在事件句内，不再把详细正文里的数值做成另一个阅读层级。
    line.emphasis = [];
    for (const match of line.text!.matchAll(new RegExp(QUANTITY_PATTERN, 'gi'))) {
      if (emphasisLeft === 0) break;
      line.emphasis.push({ start: match.index!, end: match.index! + match[0].length });
      emphasisLeft -= 1;
    }
  }
  return lines;
};

const heightOf = (lines: ImageLine[]): number =>
  lines.reduce((total, line) => total + line.height, 0);

const drawLines = (lines: ImageLine[], startY: number): string => {
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
            })
          : '';
      y += line.height;
      return svg;
    })
    .join('\n');
};

/** 快速播报：保留每条事件句，可附已有短背景；完整详情仍在同一份快照中。 */
export const renderBriefingImages = (briefing: BriefingDocument): BriefingImage[] => {
  const header = [
    ...linesFor(briefing.title, 20, 28, { weight: 600, color: COLORS.accent }),
    ...linesFor(briefing.meta, 18, 24, { color: COLORS.secondary }),
  ];
  const headerY = 20;
  const bodyY = headerY + heightOf(header) + 14;
  const footerHeight = 48;
  const capacity = Math.max(160, BRIEFING_IMAGE_MAX_HEIGHT - bodyY - footerHeight);
  const pages: ImageBlock[][] = [[]];
  let page = pages[0];
  let used = 0;
  const nextPage = () => {
    page = [];
    pages.push(page);
    used = 0;
  };
  const startBlock = (): ImageBlock => {
    const block: ImageBlock = { lines: [] };
    used += (page.length ? BLOCK_GAP : 0) + BLOCK_PADDING * 2;
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

  items.forEach(({ item }) => {
    const { headline, time, context } = imageHeading(item);
    const source =
      ({ futu_live: '富途快讯', awtmt_live: '华尔街见闻' } as Record<string, string>)[
        item.source
      ] ?? item.source;
    const metadata = [item.level, time, imageText(source)].filter(Boolean).join(' · ');
    const heading = eventLines(headline);
    const body = [
      ...(context
        ? [{ height: 2 }, ...linesFor(context, 22, 30, { color: COLORS.secondary })]
        : []),
      ...(metadata
        ? [{ height: 4 }, ...linesFor(metadata, 18, 24, { color: COLORS.secondary })]
        : []),
    ];
    const section = [...heading, ...body];
    const sectionHeight = heightOf(section) + BLOCK_PADDING * 2;
    const minimumStart = Math.min(
      sectionHeight,
      heightOf(heading) + 44 + BLOCK_PADDING * 2,
      capacity
    );
    if (
      used > 0 &&
      used + BLOCK_GAP + (sectionHeight <= capacity ? sectionHeight : minimumStart) > capacity
    ) {
      nextPage();
    }
    let block = startBlock();
    for (const line of section) {
      if (used + line.height > capacity && block.lines.length > 0) {
        nextPage();
        block = startBlock();
        append(block, {
          text: `${item.level} · 接上图`,
          size: 18,
          height: 28,
          color: COLORS.secondary,
          weight: 500,
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
        const blockHeight = heightOf(block.lines) + BLOCK_PADDING * 2;
        const svg = `<g class="briefing-item">
        <rect x="20" y="${blockY}" width="680" height="${blockHeight}" rx="4" fill="${COLORS.block}"/>
        ${drawLines(block.lines, blockY + BLOCK_PADDING)}
      </g>`;
        blockY += blockHeight;
        return svg;
      })
      .join('\n');
    const footerY = blockY + 12;
    const height = Math.max(180, footerY + 36);
    const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${BRIEFING_IMAGE_WIDTH}" height="${height}" viewBox="0 0 ${BRIEFING_IMAGE_WIDTH} ${height}" role="img" aria-label="${escapeXml(briefing.title)} · ${index + 1}/${pages.length}">
  <rect width="${BRIEFING_IMAGE_WIDTH}" height="${height}" fill="${COLORS.paper}"/>
  <g font-family="-apple-system, BlinkMacSystemFont, 'PingFang SC', 'Microsoft YaHei', sans-serif">
    ${drawLines(header, headerY)}
    ${content}
    ${textElement(['长婷报社'], footerY + 16, { size: 16, lineHeight: 22, color: COLORS.secondary })}
    <text x="684" y="${footerY + 16}" text-anchor="end" fill="${COLORS.secondary}" font-size="16">${index + 1} / ${pages.length}</text>
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
