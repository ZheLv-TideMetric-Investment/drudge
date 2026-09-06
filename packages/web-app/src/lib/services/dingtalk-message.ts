import axios from 'axios';
import { config } from '../config';
import { BUILT_BRIEFING_PUBLIC_HOST, isBriefingPublicHost } from '../public-surface';
import type { BriefingDocument } from './notification-briefing';
import { BRIEFING_IMAGE_VERSION, renderBriefingImages } from './briefing-image';

const DINGTALK_API = 'https://api.dingtalk.com';
const TOKEN_ENDPOINT = `${DINGTALK_API}/v1.0/oauth2/accessToken`;
const MESSAGE_ENDPOINT = `${DINGTALK_API}/v1.0/robot/oToMessages/batchSend`;
const REQUEST_TIMEOUT_MS = 10_000;
const TOKEN_EXPIRY_SAFETY_MS = 60_000;

interface AccessTokenCache {
  value: string;
  expiresAt: number;
}

const errorSummary = (error: unknown): string => {
  if (!error || typeof error !== 'object') return String(error);
  const response = (error as any).response;
  const status = response?.status ? `HTTP ${response.status}` : '';
  const code = response?.data?.code ? `code=${response.data.code}` : '';
  const message = error instanceof Error ? error.message : '未知错误';
  return [message, status, code].filter(Boolean).join(' · ');
};

export const normalizePublicBaseUrl = (value: string): string | null => {
  try {
    const parsed = new URL(value.trim());
    if (
      parsed.protocol !== 'https:' ||
      parsed.username ||
      parsed.password ||
      parsed.pathname !== '/' ||
      parsed.search ||
      parsed.hash
    ) {
      return null;
    }
    return parsed.toString().replace(/\/$/, '');
  } catch {
    return null;
  }
};

export const buildBriefingMessage = (briefing: BriefingDocument, publicBaseUrl: string) => {
  const baseUrl = normalizePublicBaseUrl(publicBaseUrl);
  if (!baseUrl)
    throw new Error('BRIEFING_PUBLIC_BASE_URL 必须是无凭证、路径、查询参数和锚点的 HTTPS Origin');

  const detailUrl = `${baseUrl}/briefings/${encodeURIComponent(briefing.id)}`;
  const imageUrls = renderBriefingImages(briefing).map(
    (_image, index) => `${detailUrl}/image.png?v=${BRIEFING_IMAGE_VERSION}&page=${index + 1}`
  );
  return {
    title: briefing.title,
    text: `${imageUrls.map((url, index) => `![${briefing.title} ${index + 1}/${imageUrls.length}](${url})`).join('\n\n')}\n\n[查看完整详情 · ${briefing.items.length} 条 →](${detailUrl})`,
    detailUrl,
    imageUrls,
  };
};

class DingTalkMessageService {
  private tokenCache: AccessTokenCache | null = null;

  private get settings() {
    return config.notification.dingtalk;
  }

  private get briefingSettings() {
    return config.notification.briefing;
  }

  private missingConfig(): string[] {
    const missing: string[] = [];
    if (!this.settings.clientId) missing.push('DINGTALK_APP_CLIENT_ID');
    if (!this.settings.clientSecret) missing.push('DINGTALK_APP_CLIENT_SECRET');
    if (!this.settings.targetUserId) missing.push('DINGTALK_TARGET_USER_ID');
    if (!this.briefingSettings.publicBaseUrl) missing.push('BRIEFING_PUBLIC_BASE_URL');
    if (!this.briefingSettings.storagePath) missing.push('BRIEFING_STORAGE_PATH');
    return missing;
  }

  private hasExplicitSingleTarget(): boolean {
    const target = this.settings.targetUserId.trim();
    return Boolean(target) && !target.includes(',') && !/\s/.test(target);
  }

  private hasValidPublicBaseUrl(): boolean {
    return normalizePublicBaseUrl(this.briefingSettings.publicBaseUrl) !== null;
  }

  private matchesBuiltPublicHost(): boolean {
    const baseUrl = normalizePublicBaseUrl(this.briefingSettings.publicBaseUrl);
    if (!baseUrl) return false;
    return isBriefingPublicHost(new URL(baseUrl).hostname, BUILT_BRIEFING_PUBLIC_HOST);
  }

  private async getAccessToken(): Promise<string> {
    if (this.tokenCache && this.tokenCache.expiresAt > Date.now()) return this.tokenCache.value;

    const response = await axios.post(
      TOKEN_ENDPOINT,
      {
        appKey: this.settings.clientId,
        appSecret: this.settings.clientSecret,
      },
      { timeout: REQUEST_TIMEOUT_MS }
    );
    const accessToken = String(response.data?.accessToken || '');
    if (!accessToken) throw new Error('钉钉 access token 响应缺少 accessToken');

    const expireInSeconds = Number(response.data?.expireIn || 7200);
    this.tokenCache = {
      value: accessToken,
      expiresAt: Date.now() + Math.max(0, expireInSeconds * 1000 - TOKEN_EXPIRY_SAFETY_MS),
    };
    return accessToken;
  }

  async sendBriefing(briefing: BriefingDocument): Promise<boolean> {
    if (!config.notification.enabled) {
      console.log('钉钉单聊通知未启用，跳过发送');
      return false;
    }

    const missing = this.missingConfig();
    if (missing.length > 0) {
      console.warn(`钉钉单聊通知配置不完整：${missing.join(', ')}`);
      return false;
    }

    if (!this.hasExplicitSingleTarget()) {
      console.error('DINGTALK_TARGET_USER_ID 必须显式配置且只能包含一个用户 ID');
      return false;
    }

    if (!this.hasValidPublicBaseUrl()) {
      console.error('BRIEFING_PUBLIC_BASE_URL 必须是安全且不带路径的 HTTPS Origin');
      return false;
    }

    if (!this.matchesBuiltPublicHost()) {
      console.error('BRIEFING_PUBLIC_BASE_URL 与 Web App 构建时的公网 Host 不一致，请重新构建');
      return false;
    }

    try {
      const accessToken = await this.getAccessToken();
      const message = buildBriefingMessage(briefing, this.briefingSettings.publicBaseUrl);
      const payload = {
        robotCode: this.settings.clientId,
        userIds: [this.settings.targetUserId.trim()],
        msgKey: 'sampleMarkdown',
        msgParam: JSON.stringify({ title: message.title, text: message.text }),
      };

      const response = await axios.post(MESSAGE_ENDPOINT, payload, {
        timeout: REQUEST_TIMEOUT_MS,
        headers: {
          'Content-Type': 'application/json',
          'x-acs-dingtalk-access-token': accessToken,
        },
      });

      const invalidTargets = Array.isArray(response.data?.invalidStaffIdList)
        ? response.data.invalidStaffIdList
        : [];
      const throttledTargets = Array.isArray(response.data?.flowControlledStaffIdList)
        ? response.data.flowControlledStaffIdList
        : [];
      if (
        !response.data?.processQueryKey ||
        invalidTargets.length > 0 ||
        throttledTargets.length > 0
      ) {
        console.error('钉钉单聊通知发送失败：接口未接受唯一收件人');
        return false;
      }

      console.log('钉钉图片摘要与详情链接发送成功', {
        title: briefing.title,
        itemCount: briefing.items.length,
      });
      return true;
    } catch (error) {
      console.error(`钉钉单聊通知发送异常：${errorSummary(error)}`);
      return false;
    }
  }

  async healthCheck(): Promise<boolean> {
    if (!config.notification.enabled) return false;
    if (
      this.missingConfig().length > 0 ||
      !this.hasExplicitSingleTarget() ||
      !this.hasValidPublicBaseUrl() ||
      !this.matchesBuiltPublicHost()
    ) {
      return false;
    }

    try {
      await this.getAccessToken();
      return true;
    } catch (error) {
      console.error(`钉钉单聊鉴权失败：${errorSummary(error)}`);
      return false;
    }
  }

  getStatus() {
    return {
      enabled: config.notification.enabled,
      mode: 'explicit_single_user_image_h5',
      configured:
        this.missingConfig().length === 0 &&
        this.hasExplicitSingleTarget() &&
        this.hasValidPublicBaseUrl() &&
        this.matchesBuiltPublicHost(),
      timestamp: new Date().toISOString(),
    };
  }
}

export const dingtalkMessageService = new DingTalkMessageService();
