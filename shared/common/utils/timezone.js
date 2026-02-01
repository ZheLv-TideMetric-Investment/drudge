const BEIJING_TIMEZONE = 'Asia/Shanghai';
const UTC_TIMEZONE = 'UTC';
const BEIJING_OFFSET_MS = 8 * 60 * 60 * 1000;
const TIMESTAMP_MS_THRESHOLD = 1e11;

const normalizeTimestampMs = (value) => {
  if (value === null || value === undefined) {
    return null;
  }

  const normalizeNumeric = (numeric) => {
    if (!Number.isFinite(numeric)) {
      return null;
    }
    const abs = Math.abs(numeric);
    return abs < TIMESTAMP_MS_THRESHOLD ? numeric * 1000 : numeric;
  };

  if (typeof value === 'number') {
    return normalizeNumeric(value);
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return null;
    if (/^\d+$/.test(trimmed)) {
      const numeric = Number(trimmed);
      return normalizeNumeric(numeric);
    }
  }

  return null;
};

const toUTCDate = (input) => {
  const date = new Date(input);
  return new Date(date.getTime() - BEIJING_OFFSET_MS);
};

const toBeijingDate = (input) => {
  const date = new Date(input);
  return new Date(date.getTime() + BEIJING_OFFSET_MS);
};

const toUTCISOString = (input) => toUTCDate(input).toISOString();

const toBeijingISOString = (input) => {
  const beijingDate = toBeijingDate(input);
  return beijingDate.toISOString().replace('Z', '+08:00');
};

module.exports = {
  BEIJING_TIMEZONE,
  UTC_TIMEZONE,
  toUTCDate,
  toBeijingDate,
  toUTCISOString,
  toBeijingISOString,
  normalizeTimestampMs
};
