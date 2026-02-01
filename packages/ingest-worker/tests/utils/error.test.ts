import { buildErrorDetails } from '../../src/utils/error';
import axios from 'axios';

describe('buildErrorDetails', () => {
  it('builds details for axios errors', () => {
    const error = new Error('Request failed') as any;
    error.isAxiosError = true;
    error.code = 'ECONNRESET';
    error.config = {
      url: 'https://example.com',
      baseURL: 'https://example.com',
      method: 'get',
      params: { q: 'test' },
      data: { hello: 'world' },
      timeout: 1000
    };
    error.response = {
      status: 500,
      statusText: 'Server Error',
      data: { message: 'boom' },
      headers: { 'x-test': '1' }
    };

    const details = buildErrorDetails(error, { context: 'test' });

    expect(axios.isAxiosError(error)).toBe(true);
    expect(details.isAxiosError).toBe(true);
    expect(details.message).toBe('Request failed');
    expect(details.response?.status).toBe(500);
    expect(details.request?.method).toBe('GET');
    expect(details.extra).toMatchObject({ context: 'test' });
  });

  it('builds details for standard errors', () => {
    const error = new Error('boom') as any;
    error.code = 'E_TEST';
    error.cause = new Error('root');
    const details = buildErrorDetails(error);

    expect(details.isAxiosError).toBeUndefined();
    expect(details.message).toBe('boom');
    expect(details.name).toBe('Error');
    expect(details.code).toBe('E_TEST');
    expect(details.cause).toBe('Error: root');
  });

  it('handles string errors', () => {
    const details = buildErrorDetails('bad');
    expect(details.message).toBe('bad');
  });

  it('uses default message for empty axios error', () => {
    const error = new Error('') as any;
    error.message = '';
    error.isAxiosError = true;

    const details = buildErrorDetails(error);

    expect(details.message).toBe('Axios error');
  });

  it('handles non-error objects and merges extra', () => {
    const details = buildErrorDetails({ reason: 'oops' }, { meta: BigInt(1) });

    expect(details.message).toBe('Unknown error');
    expect(details.extra).toMatchObject({ reason: 'oops', meta: '1' });
  });

  it('sanitizes long strings and complex values', () => {
    const longText = 'a'.repeat(2100);
    const date = new Date('2024-01-01T00:00:00.000Z');
    const details = buildErrorDetails({
      text: longText,
      when: date,
      buffer: Buffer.from('hi'),
      items: [1, 2, 3]
    });

    expect(details.extra?.text).toContain('<truncated>');
    expect(details.extra?.when).toBe(date.toISOString());
    expect(details.extra?.buffer).toBe('hi');
    expect(details.extra?.items).toEqual([1, 2, 3]);
  });

  it('handles axios errors without response or config', () => {
    const error = new Error('Request failed') as any;
    error.isAxiosError = true;
    error.cause = 'network';

    const details = buildErrorDetails(error);

    expect(details.isAxiosError).toBe(true);
    expect(details.response).toBeUndefined();
    expect(details.request).toBeUndefined();
    expect(details.cause).toBe('network');
  });

  it('merges extra data for string errors', () => {
    const details = buildErrorDetails('oops', { tag: 'unit' });

    expect(details.extra).toMatchObject({ tag: 'unit' });
  });
});
