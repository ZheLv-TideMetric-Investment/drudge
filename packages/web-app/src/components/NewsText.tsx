import React from 'react';

export function NewsText({ text, keyword = '' }: { text: string; keyword?: string }) {
  if (!keyword) return <>{text}</>;
  const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const parts = text.split(new RegExp(`(${escaped})`, 'gi'));
  return <>{parts.map((part, index) => (index % 2 ? <mark key={index}>{part}</mark> : part))}</>;
}
