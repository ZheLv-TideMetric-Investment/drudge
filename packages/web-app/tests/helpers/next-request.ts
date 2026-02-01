import { NextRequest } from 'next/server';

type RequestOptions = {
  method?: string;
  query?: Record<string, string | number | boolean | undefined | null>;
  body?: unknown;
  headers?: Record<string, string>;
};

export const createNextRequest = (
  url: string,
  { method = 'GET', query, body, headers = {} }: RequestOptions = {}
) => {
  const fullUrl = new URL(url, 'http://localhost');
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined || value === null) continue;
      fullUrl.searchParams.set(key, String(value));
    }
  }

  type NextRequestInit = NonNullable<ConstructorParameters<typeof NextRequest>[1]>;

  const init: NextRequestInit = {
    method,
    headers: { ...headers }
  };

  if (body !== undefined) {
    init.body = JSON.stringify(body);
    if (!init.headers) {
      init.headers = {};
    }
    if (!('content-type' in init.headers)) {
      (init.headers as Record<string, string>)['content-type'] = 'application/json';
    }
  }

  return new NextRequest(fullUrl.toString(), init);
};
