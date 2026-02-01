const { BEIJING_TIMEZONE } = require('./timezone');

const beijingDateTimeFormatter = new Intl.DateTimeFormat('zh-CN', {
  timeZone: BEIJING_TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
});

const formatBeijingLocaleString = (date = new Date(), locale = 'zh-CN') => {
  const targetDate = date instanceof Date ? date : new Date(date);
  return targetDate.toLocaleString(locale, { timeZone: BEIJING_TIMEZONE });
};

const formatBeijingDateTime = (date = new Date()) => {
  const targetDate = date instanceof Date ? date : new Date(date);
  const parts = beijingDateTimeFormatter.formatToParts(targetDate);
  const partMap = {};
  for (const part of parts) {
    partMap[part.type] = part.value;
  }

  if (!partMap.year) {
    return beijingDateTimeFormatter.format(targetDate);
  }

  return `${partMap.year}-${partMap.month}-${partMap.day} ${partMap.hour}:${partMap.minute}:${partMap.second}`;
};

const createMarkdownPayload = (title, text, at) => {
  const payload = {
    msgtype: 'markdown',
    markdown: {
      title,
      text,
    },
  };

  if (at) {
    payload.at = at;
  }

  return payload;
};

const buildNotificationTitle = (service, title) => {
  if (!service) {
    return `[tide] ${title}`;
  }
  return `[tide] ${service} - ${title}`;
};

module.exports = {
  formatBeijingLocaleString,
  formatBeijingDateTime,
  buildNotificationTitle,
  createMarkdownPayload,
};
