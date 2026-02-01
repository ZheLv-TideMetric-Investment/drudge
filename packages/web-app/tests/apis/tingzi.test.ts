import { createNextRequest } from '../helpers/next-request';

const processTingziMessage = jest.fn();

jest.mock('../../src/lib/services/robot', () => ({
  __esModule: true,
  processTingziMessage
}));

describe('api/tingzi', () => {
  beforeEach(() => {
    processTingziMessage.mockReset();
  });

  it('rejects invalid token', async () => {
    jest.resetModules();
    const { POST } = await import('../../src/app/api/tingzi/route');

    const request = createNextRequest('/api/tingzi', {
      method: 'POST',
      headers: { token: 'bad' },
      body: { text: { content: 'hi' } }
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error).toBe('Invalid token');
    expect(body).toMatchSnapshot();
  });

  it('rejects when token is missing', async () => {
    jest.resetModules();
    const { POST } = await import('../../src/app/api/tingzi/route');

    const request = createNextRequest('/api/tingzi', {
      method: 'POST',
      body: { text: { content: 'hi' } }
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error).toBe('Invalid token');
  });

  it('handles tingzi message', async () => {
    jest.resetModules();
    const { POST } = await import('../../src/app/api/tingzi/route');

    processTingziMessage.mockResolvedValue({ success: true });

    const request = createNextRequest('/api/tingzi', {
      method: 'POST',
      headers: { token: 'tide' },
      body: { text: { content: 'hi' } }
    });

    const response = await POST(request);
    const body = await response.json();

    expect(body).toEqual({ success: true });
    expect(body).toMatchSnapshot();
  });

  it('returns error when processing fails', async () => {
    jest.resetModules();
    const { POST } = await import('../../src/app/api/tingzi/route');

    processTingziMessage.mockRejectedValue(new Error('boom'));

    const request = createNextRequest('/api/tingzi', {
      method: 'POST',
      headers: { token: 'tide' },
      body: { text: { content: 'hi' } }
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toBe('Internal server error');
  });
});
