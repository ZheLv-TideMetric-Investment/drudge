import axios, { AxiosError } from 'axios';
import { logger } from './logger';

export interface ErrorDetails {
  message: string;
  name?: string;
  stack?: string;
  code?: string;
  isAxiosError?: boolean;
  response?: {
    status?: number;
    statusText?: string;
    data?: any;
    headers?: any;
  };
  request?: {
    url?: string;
    baseURL?: string;
    method?: string;
    params?: any;
    data?: any;
    timeout?: number;
  };
  cause?: string;
  extra?: Record<string, unknown>;
}

// 仅保留可序列化的信息，避免循环引用
function sanitizeValue(value: any): any {
  if (value === undefined || value === null) return value;
  if (typeof value === 'string')
    return value.length > 2000 ? `${value.slice(0, 2000)}...<truncated>` : value;
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (value instanceof Date) return value.toISOString();
  if (Buffer.isBuffer(value)) return value.toString('utf8');
  if (Array.isArray(value)) return value.slice(0, 20).map(item => sanitizeValue(item));
  if (typeof value === 'object') {
    const result: Record<string, any> = {};
    Object.keys(value)
      .slice(0, 20)
      .forEach(key => {
        result[key] = sanitizeValue(value[key]);
      });
    return result;
  }
  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return String(value);
  }
}

export function buildErrorDetails(error: unknown, extra?: Record<string, unknown>): ErrorDetails {
  if (axios.isAxiosError(error)) {
    const axiosError = error as AxiosError;
    const details: ErrorDetails = {
      message: axiosError.message || 'Axios error',
      name: axiosError.name,
      stack: axiosError.stack,
      code: axiosError.code,
      isAxiosError: true,
      response: axiosError.response
        ? {
            status: axiosError.response.status,
            statusText: axiosError.response.statusText,
            data: sanitizeValue(axiosError.response.data),
            headers: sanitizeValue(axiosError.response.headers),
          }
        : undefined,
      request: axiosError.config
        ? {
            url: axiosError.config.url,
            baseURL: axiosError.config.baseURL,
            method: axiosError.config.method?.toUpperCase(),
            params: sanitizeValue(axiosError.config.params),
            data: sanitizeValue(axiosError.config.data),
            timeout: axiosError.config.timeout as number | undefined,
          }
        : undefined,
      cause: axiosError.cause ? String(axiosError.cause) : undefined,
    };

    if (extra) {
      details.extra = sanitizeValue(extra);
    }
    return details;
  }

  if (error instanceof Error) {
    const details: ErrorDetails = {
      message: error.message,
      name: error.name,
      stack: error.stack,
      code: (error as any).code,
      cause: (error as any).cause ? String((error as any).cause) : undefined,
    };
    if (extra) {
      details.extra = sanitizeValue(extra);
    }
    return details;
  }

  const details: ErrorDetails = {
    message: typeof error === 'string' ? error : 'Unknown error',
  };

  if (error && typeof error === 'object') {
    details.extra = sanitizeValue(error as any);
  }
  if (extra) {
    details.extra = { ...(details.extra || {}), ...sanitizeValue(extra) };
  }
  return details;
}

export function logErrorWithDetails(
  message: string,
  error: unknown,
  extra?: Record<string, unknown>
): ErrorDetails {
  const details = buildErrorDetails(error, extra);
  logger.error(message, details);
  return details;
}
