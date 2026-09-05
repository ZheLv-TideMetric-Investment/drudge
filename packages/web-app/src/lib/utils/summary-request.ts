import { TimeZoneUtils } from './timezone';

export type SummaryPreset = 'previous-hour' | 'today' | 'last-day';
export interface SummaryRange {
  start: string;
  end: string;
}

export function buildSummaryRange(preset: SummaryPreset, now = new Date()): SummaryRange {
  const current = TimeZoneUtils.toBeijingDayjs(now);
  const end = preset === 'previous-hour' ? current.startOf('hour') : current;
  const start =
    preset === 'previous-hour'
      ? end.subtract(1, 'hour')
      : preset === 'today'
        ? current.startOf('day')
        : current.subtract(1, 'day');
  return {
    start: start.format('YYYY-MM-DDTHH:mm'),
    end: end.format('YYYY-MM-DDTHH:mm'),
  };
}

export function buildSummaryParams(
  range: SummaryRange,
  sendNotification: boolean
): URLSearchParams {
  if (!range.start || !range.end) throw new Error('请选择开始和结束时间');
  const startTime = TimeZoneUtils.toUTC(range.start);
  const endTime = TimeZoneUtils.toUTC(range.end);
  if (new Date(startTime).getTime() >= new Date(endTime).getTime()) {
    throw new Error('结束时间必须晚于开始时间');
  }
  return new URLSearchParams({ startTime, endTime, sendNotification: String(sendNotification) });
}
