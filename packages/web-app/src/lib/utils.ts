import { clsx, type ClassValue } from 'clsx';
import { format, formatDistanceToNow, parseISO, isValid } from 'date-fns';
import { zhCN } from 'date-fns/locale';
// 新闻级别配置
const newsLevels = {
  'Level 1': { color: '#ef4444', label: '紧急', priority: 1 },
  'Level 2': { color: '#f97316', label: '重要', priority: 2 },
  'Level 3': { color: '#eab308', label: '中等', priority: 3 },
  'Level 4': { color: '#22c55e', label: '一般', priority: 4 },
  'Level 5': { color: '#6b7280', label: '低', priority: 5 }
};

// 样式类合并工具
export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

// 日期格式化工具
export function formatDate(date: string | Date, formatStr = 'yyyy-MM-dd HH:mm:ss'): string {
  try {
    const dateObj = typeof date === 'string' ? parseISO(date) : date;
    if (!isValid(dateObj)) return '无效日期';
    return format(dateObj, formatStr, { locale: zhCN });
  } catch {
    return '无效日期';
  }
}

export function formatRelativeTime(date: string | Date): string {
  try {
    const dateObj = typeof date === 'string' ? parseISO(date) : date;
    if (!isValid(dateObj)) return '无效日期';
    return formatDistanceToNow(dateObj, { addSuffix: true, locale: zhCN });
  } catch {
    return '无效日期';
  }
}

// 新闻级别工具
export function getNewsLevelInfo(level: string) {
  return newsLevels[level as keyof typeof newsLevels] || {
    color: '#6b7280',
    label: '未知',
    priority: 6
  };
}

export function getNewsLevelColor(level: string): string {
  return getNewsLevelInfo(level).color;
}

// 文本处理工具
export function truncateText(text: string, maxLength = 100): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
}

// 数字格式化工具
export function formatNumber(num: number): string {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M';
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'K';
  }
  return num.toString();
}

// 错误处理工具
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return '未知错误';
} 