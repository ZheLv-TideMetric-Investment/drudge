'use client';

import { useMemo, useState } from 'react';
import type { BriefingDocument } from '@/lib/services/notification-briefing';
import styles from './briefing.module.css';

const DETAIL_LABELS = new Set(['紧急度', '事实', '公司', '人物', '机构', '事件']);

const DetailLine = ({ line }: { line: string }) => {
  const separator = line.indexOf('：');
  const label = separator > 0 ? line.slice(0, separator) : '';
  const hasStructuredLabel = DETAIL_LABELS.has(label);
  const value = hasStructuredLabel ? line.slice(separator + 1) : line;
  const linkMatch = value.match(/https?:\/\/[^\s]+/);

  return (
    <p className={styles.detailLine}>
      <span className={styles.detailLabel}>{hasStructuredLabel ? label : ''}</span>
      <span>
        {linkMatch ? (
          <>
            {value.slice(0, linkMatch.index)}
            <a href={linkMatch[0]} target="_blank" rel="noreferrer">
              {linkMatch[0]}
            </a>
            {value.slice((linkMatch.index ?? 0) + linkMatch[0].length)}
          </>
        ) : (
          value
        )}
      </span>
    </p>
  );
};

export default function BriefingView({ briefing }: { briefing: BriefingDocument }) {
  const initialIndex = Math.max(
    0,
    briefing.items.findIndex(item => item.tone === 'core')
  );
  const [selectedIndex, setSelectedIndex] = useState(initialIndex);
  const selected = briefing.items[selectedIndex] ?? briefing.items[0];
  const detailLines = useMemo(
    () =>
      selected.detail
        .split('\n')
        .map(line => line.trim())
        .filter(Boolean),
    [selected.detail]
  );

  return (
    <main className={styles.page}>
      <section className={styles.shell}>
        <header className={styles.header}>
          <div>
            <p className={styles.brand}>DRUDGE BRIEF</p>
            <h1>{briefing.title}</h1>
            <p className={styles.meta}>{briefing.meta}</p>
          </div>
          <div className={styles.counts} aria-label="新闻级别统计">
            <span className={styles.coreText}>L1 {briefing.l1Count}</span>
            <span className={styles.supportText}>L2 {briefing.l2Count}</span>
            <span className={styles.mutedText}>L3+ {briefing.l3PlusCount}</span>
          </div>
        </header>

        <div className={styles.content}>
          <nav className={styles.rail} aria-label="简报目录">
            <p className={styles.railTitle}>{briefing.items.length} 条</p>
            <div className={styles.railItems}>
              {briefing.items.map((item, index) => (
                <button
                  key={`${item.id}-${index}`}
                  type="button"
                  className={`${styles.railItem} ${styles[item.tone]} ${
                    index === selectedIndex ? styles.active : ''
                  }`}
                  aria-current={index === selectedIndex ? 'true' : undefined}
                  onClick={() => setSelectedIndex(index)}
                >
                  <span className={styles.level}>{item.level}</span>
                  <span className={styles.label}>{item.label}</span>
                </button>
              ))}
            </div>
          </nav>

          <article className={styles.detail} aria-live="polite">
            <div className={styles.detailTopline}>
              <span className={`${styles.selectedLevel} ${styles[selected.tone]}`}>
                {selected.level}
              </span>
              <span>{[selected.time, selected.source].filter(Boolean).join(' · ')}</span>
            </div>
            <h2>{selected.headline}</h2>

            <div className={styles.detailBody}>
              {detailLines.length > 0 ? (
                detailLines.map((line, index) => (
                  <DetailLine key={`${index}-${line}`} line={line} />
                ))
              ) : (
                <p className={styles.detailLine}>当前条目的完整信息已包含在标题中。</p>
              )}
            </div>

            {selected.url ? (
              <a className={styles.sourceLink} href={selected.url} target="_blank" rel="noreferrer">
                查看原文 <span aria-hidden="true">↗</span>
              </a>
            ) : null}
          </article>
        </div>
      </section>
    </main>
  );
}
