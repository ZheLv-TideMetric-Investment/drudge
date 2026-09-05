import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { NewsText } from '../../src/components/NewsText';

describe('news text display', () => {
  it('preserves text and highlights a literal keyword', () => {
    const html = renderToStaticMarkup(
      React.createElement(NewsText, { text: '收入 [120] 亿元；同比 8%。', keyword: '[120]' })
    );
    expect(html).toBe('收入 <mark>[120]</mark> 亿元；同比 8%。');
  });

  it('renders news and search terms as text, without executing source HTML', () => {
    const html = renderToStaticMarkup(
      React.createElement(NewsText, {
        text: '<img src=x onerror=alert(1)> Example',
        keyword: '<img',
      })
    );
    expect(html).not.toContain('<img');
    expect(html).toContain('<mark>&lt;img</mark>');
    expect(html).toContain('src=x onerror=alert(1)&gt; Example');
  });

  it('keeps complete content when there is no keyword', () => {
    const html = renderToStaticMarkup(
      React.createElement(NewsText, { text: '第一行\n第二行 & 原文链接' })
    );
    expect(html).toBe('第一行\n第二行 &amp; 原文链接');
  });
});
