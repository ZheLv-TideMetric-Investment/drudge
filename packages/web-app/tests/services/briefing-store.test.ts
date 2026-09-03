import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import type { BriefingDraft } from '../../src/lib/services/notification-briefing';
import {
  createBriefingId,
  readBriefing,
  saveBriefing,
} from '../../src/lib/services/briefing-store';

const draft: BriefingDraft = {
  title: '重点财经快讯',
  meta: '14:30 · 1 条',
  l1Count: 1,
  l2Count: 0,
  l3PlusCount: 0,
  items: [
    {
      id: 'one',
      level: 'L1',
      tone: 'core',
      label: '核心新闻',
      headline: '核心新闻标题',
      time: '14:30',
      detail: '事实：完整事实',
      source: 'futu_live',
      url: 'https://example.com/one',
    },
  ],
};

describe('briefing store', () => {
  let storagePath: string;

  beforeEach(async () => {
    storagePath = await fs.mkdtemp(path.join(os.tmpdir(), 'drudge-briefing-store-'));
  });

  afterEach(async () => {
    await fs.rm(storagePath, { recursive: true, force: true });
  });

  it('persists and reads an immutable content-addressed briefing', async () => {
    const first = await saveBriefing(draft, storagePath);
    const second = await saveBriefing(draft, storagePath);
    const files = await fs.readdir(storagePath);

    expect(first.id).toBe(createBriefingId(draft));
    expect(second).toEqual(first);
    expect(files).toEqual([`${first.id}.json`]);
    await expect(readBriefing(first.id, storagePath)).resolves.toEqual(first);
  });

  it('returns null for unknown or path-like IDs', async () => {
    await expect(readBriefing('missing', storagePath)).resolves.toBeNull();
    await expect(readBriefing('../secrets', storagePath)).resolves.toBeNull();
    await expect(readBriefing('0123456789abcdef0123456789abcdef', storagePath)).resolves.toBeNull();
  });

  it('rejects malformed drafts and corrupted stored documents', async () => {
    await expect(saveBriefing({ ...draft, items: [] }, storagePath)).rejects.toThrow();

    const id = '0123456789abcdef0123456789abcdef';
    await fs.writeFile(path.join(storagePath, `${id}.json`), '{"title":"broken"}\n');
    await expect(readBriefing(id, storagePath)).rejects.toThrow();
  });
});
