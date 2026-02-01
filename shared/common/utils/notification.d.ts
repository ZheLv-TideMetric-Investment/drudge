export type NotificationAt = {
  isAtAll: boolean;
  atUserIds?: string[];
  atMobiles?: string[];
};

export type NotificationPayload = {
  msgtype: 'markdown';
  markdown: {
    title: string;
    text: string;
  };
  at?: NotificationAt;
};

export function createMarkdownPayload(
  title: string,
  text: string,
  at?: NotificationAt
): NotificationPayload;

export function buildNotificationTitle(service: string | undefined, title: string): string;

export function formatBeijingLocaleString(date?: Date, locale?: string): string;
export function formatBeijingDateTime(date?: Date): string;
