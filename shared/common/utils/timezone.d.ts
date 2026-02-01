export const BEIJING_TIMEZONE: string;
export const UTC_TIMEZONE: string;
export function normalizeTimestampMs(
  input: string | number | Date | null | undefined
): number | null;
export function toUTCDate(input: string | number | Date): Date;
export function toBeijingDate(input: string | number | Date): Date;
export function toUTCISOString(input: string | number | Date): string;
export function toBeijingISOString(input: string | number | Date): string;
