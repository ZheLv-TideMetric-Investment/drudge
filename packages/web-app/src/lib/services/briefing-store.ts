import { createHash, randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import { config } from '../config';
import type { BriefingDocument, BriefingDraft } from './notification-briefing';

export const BRIEFING_ID_PATTERN = /^[a-f0-9]{32}$/;

const briefingItemSchema = z
  .object({
    id: z.string().min(1),
    level: z.string().min(1),
    tone: z.enum(['core', 'support', 'muted']),
    label: z.string().min(1),
    headline: z.string().min(1),
    time: z.string(),
    detail: z.string(),
    source: z.string(),
    url: z.union([z.literal(''), z.string().url()]),
  })
  .strict();

const briefingDraftSchema = z
  .object({
    title: z.string().min(1),
    meta: z.string(),
    l1Count: z.number().int().nonnegative(),
    l2Count: z.number().int().nonnegative(),
    l3PlusCount: z.number().int().nonnegative(),
    items: z.array(briefingItemSchema).min(1),
  })
  .strict();

export const briefingDocumentSchema = briefingDraftSchema
  .extend({
    id: z.string().regex(BRIEFING_ID_PATTERN),
    createdAt: z.string().datetime(),
  })
  .strict();

export const createBriefingId = (draft: BriefingDraft): string => {
  const normalized = briefingDraftSchema.parse(draft);
  return createHash('sha256').update(JSON.stringify(normalized)).digest('hex').slice(0, 32);
};

const resolveStoragePath = (storagePath?: string): string => {
  const resolved = String(storagePath ?? config.notification.briefing.storagePath).trim();
  if (!resolved) throw new Error('BRIEFING_STORAGE_PATH 未配置');
  return path.resolve(resolved);
};

const filePathFor = (id: string, storagePath?: string): string | null => {
  if (!BRIEFING_ID_PATTERN.test(id)) return null;
  return path.join(resolveStoragePath(storagePath), `${id}.json`);
};

export const readBriefing = async (
  id: string,
  storagePath?: string
): Promise<BriefingDocument | null> => {
  const filePath = filePathFor(id, storagePath);
  if (!filePath) return null;

  try {
    const serialized = await fs.readFile(filePath, 'utf8');
    return briefingDocumentSchema.parse(JSON.parse(serialized));
  } catch (error) {
    if ((error as NodeJS.ErrnoException)?.code === 'ENOENT') return null;
    throw error;
  }
};

export const saveBriefing = async (
  draft: BriefingDraft,
  storagePath?: string
): Promise<BriefingDocument> => {
  const normalized = briefingDraftSchema.parse(draft);
  const id = createBriefingId(normalized);
  const directory = resolveStoragePath(storagePath);
  const finalPath = path.join(directory, `${id}.json`);

  const existing = await readBriefing(id, directory);
  if (existing) return existing;

  const document = briefingDocumentSchema.parse({
    ...normalized,
    id,
    createdAt: new Date().toISOString(),
  });
  const temporaryPath = path.join(directory, `.${id}.${randomUUID()}.tmp`);

  await fs.mkdir(directory, { recursive: true, mode: 0o700 });
  try {
    await fs.writeFile(temporaryPath, `${JSON.stringify(document, null, 2)}\n`, {
      encoding: 'utf8',
      flag: 'wx',
      mode: 0o600,
    });
    await fs.rename(temporaryPath, finalPath);
  } catch (error) {
    await fs.unlink(temporaryPath).catch(() => undefined);
    throw error;
  }

  return document;
};
