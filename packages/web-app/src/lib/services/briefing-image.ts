import type { BriefingDocument, BriefingItem } from './notification-briefing';

export const BRIEFING_IMAGE_WIDTH = 720;
export const BRIEFING_IMAGE_HEIGHT = 400;

const COLORS = {
  core: '#C7493A',
  support: '#315D66',
  muted: '#7F9298',
  ink: '#1E292C',
  secondary: '#607176',
  line: '#DCE3E4',
  paper: '#FFFFFF',
  background: '#F2F5F4',
};

export const escapeXml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

const characterWidth = (character: string): number => {
  return /^[\u0000-\u00ff]$/.test(character) ? 0.56 : 1;
};

export const wrapText = (value: string, maxUnits: number, maxLines: number): string[] => {
  const characters = Array.from(value.replace(/\s+/g, ' ').trim());
  if (characters.length === 0) return [];

  const lines: string[] = [];
  let line = '';
  let units = 0;
  let consumed = 0;

  for (const character of characters) {
    const width = characterWidth(character);
    if (line && units + width > maxUnits) {
      lines.push(line.trimEnd());
      if (lines.length === maxLines) break;
      line = '';
      units = 0;
    }
    line += character;
    units += width;
    consumed += 1;
  }

  if (lines.length < maxLines && line) lines.push(line.trimEnd());
  if (consumed < characters.length && lines.length > 0) {
    const final = Array.from(lines[lines.length - 1]);
    let finalUnits = final.reduce((sum, character) => sum + characterWidth(character), 0);
    while (final.length > 0 && finalUnits + 1 > maxUnits) {
      finalUnits -= characterWidth(final.pop() ?? '');
    }
    lines[lines.length - 1] = `${final.join('').replace(/[，。；、,.\s]+$/, '')}…`;
  }
  return lines;
};

const factFor = (item: BriefingItem): string => {
  const lines = item.detail
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean);
  const fact = lines.find(line => /^事实[：:]/.test(line));
  if (fact) return fact.replace(/^事实[：:]\s*/, '');
  const useful = lines.find(line => !/^(紧急度|公司|人物|机构|事件)[：:]/.test(line));
  return useful ?? '';
};

const toneRank: Record<BriefingItem['tone'], number> = { core: 0, support: 1, muted: 2 };

const textElement = (
  lines: string[],
  x: number,
  y: number,
  options: { size: number; weight?: number; color?: string; lineHeight?: number }
): string => {
  const { size, weight = 400, color = COLORS.ink, lineHeight = Math.round(size * 1.35) } = options;
  return `<text x="${x}" y="${y}" fill="${color}" font-size="${size}" font-weight="${weight}">${lines
    .map(
      (line, index) =>
        `<tspan x="${x}" dy="${index === 0 ? 0 : lineHeight}">${escapeXml(line)}</tspan>`
    )
    .join('')}</text>`;
};

const renderLead = (item: BriefingItem): string => {
  const color = COLORS[item.tone];
  return [
    `<text x="44" y="132" fill="${color}" font-size="16" font-weight="700">${escapeXml(item.level)}</text>`,
    textElement(wrapText(item.headline, 21, 2), 92, 132, { size: 23, weight: 700 }),
    textElement(wrapText(factFor(item), 36, 2), 92, 188, {
      size: 15,
      color: COLORS.secondary,
      lineHeight: 23,
    }),
    `<text x="626" y="132" text-anchor="end" fill="${COLORS.secondary}" font-size="13">${escapeXml(
      [item.time, item.source].filter(Boolean).join(' · ')
    )}</text>`,
  ].join('');
};

const renderRow = (item: BriefingItem, y: number): string => {
  const color = COLORS[item.tone];
  const metadata = [item.time, item.source].filter(Boolean).join(' · ');
  return [
    `<line x1="92" y1="${y - 25}" x2="676" y2="${y - 25}" stroke="${COLORS.line}"/>`,
    `<text x="44" y="${y}" fill="${color}" font-size="15" font-weight="700">${escapeXml(item.level)}</text>`,
    textElement(wrapText(item.headline, 24, 1), 92, y, { size: 17, weight: 650 }),
    `<text x="676" y="${y}" text-anchor="end" fill="${COLORS.secondary}" font-size="12">${escapeXml(metadata)}</text>`,
    textElement(wrapText(factFor(item), 43, 1), 92, y + 24, {
      size: 13,
      color: COLORS.secondary,
    }),
  ].join('');
};

export const renderBriefingSvg = (briefing: BriefingDocument): string => {
  const visibleItems = briefing.items
    .map((item, index) => ({ item, index }))
    .sort(
      (left, right) =>
        toneRank[left.item.tone] - toneRank[right.item.tone] || left.index - right.index
    )
    .slice(0, 3)
    .map(entry => entry.item);
  const remaining = Math.max(0, briefing.items.length - visibleItems.length);
  const counts = `L1 ${briefing.l1Count}   L2 ${briefing.l2Count}   L3+ ${briefing.l3PlusCount}`;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${BRIEFING_IMAGE_WIDTH}" height="${BRIEFING_IMAGE_HEIGHT}" viewBox="0 0 ${BRIEFING_IMAGE_WIDTH} ${BRIEFING_IMAGE_HEIGHT}" role="img" aria-label="${escapeXml(briefing.title)}">
  <rect width="720" height="400" fill="${COLORS.background}"/>
  <rect x="20" y="18" width="680" height="364" rx="18" fill="${COLORS.paper}"/>
  <rect x="20" y="18" width="5" height="364" rx="2.5" fill="${COLORS.core}"/>
  <g font-family="-apple-system, BlinkMacSystemFont, 'PingFang SC', 'Microsoft YaHei', sans-serif">
    <text x="44" y="53" fill="${COLORS.ink}" font-size="24" font-weight="750">${escapeXml(briefing.title)}</text>
    <text x="44" y="80" fill="${COLORS.secondary}" font-size="13">${escapeXml(briefing.meta)}</text>
    <text x="676" y="54" text-anchor="end" fill="${COLORS.support}" font-size="14" font-weight="650">${counts}</text>
    <text x="676" y="79" text-anchor="end" fill="${COLORS.secondary}" font-size="12">DRUDGE BRIEF</text>
    <line x1="44" y1="100" x2="676" y2="100" stroke="${COLORS.line}"/>
    ${visibleItems[0] ? renderLead(visibleItems[0]) : ''}
    ${visibleItems[1] ? renderRow(visibleItems[1], 258) : ''}
    ${visibleItems[2] ? renderRow(visibleItems[2], 322) : ''}
    <text x="44" y="365" fill="${COLORS.secondary}" font-size="12">详情页保留完整事实、主体、来源与原文${
      remaining > 0 ? ` · 另有 ${remaining} 条` : ''
    }</text>
    <text x="676" y="365" text-anchor="end" fill="${COLORS.support}" font-size="13" font-weight="650">查看详情 →</text>
  </g>
</svg>`;
};
