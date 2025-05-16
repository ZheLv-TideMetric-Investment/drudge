const axios = require('axios');
const moment = require('moment-timezone');

const logger = require('../utils/logger');

// 设置默认时区为北京时间
moment.tz.setDefault('Asia/Shanghai');

// 随机生成 User-Agent
function getRandomUserAgent() {
  const userAgents = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36 Edg/122.0.0.0',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.3.1 Safari/605.1.15',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:123.0) Gecko/20100101 Firefox/123.0',
  ];
  return userAgents[Math.floor(Math.random() * userAgents.length)];
}

// 随机生成 Referer
function getRandomReferer() {
  const referers = [
    'https://www.google.com/',
    'https://www.bing.com/',
    'https://www.baidu.com/',
    'https://www.sogou.com/',
    'https://www.so.com/',
  ];
  return referers[Math.floor(Math.random() * referers.length)];
}

class WebhookService {
  constructor() {
    this.lastRequestTime = 0;
    this.minRequestInterval = 2000; // 最小请求间隔 2 秒
  }

  /**
   * 获取所有配置的钉钉机器人 access token
   * @returns {string[]} access token 数组
   */
  getAccessTokens() {
    const tokens = process.env.DINGTALK_ACCESS_TOKEN;
    if (!tokens) {
      logger.error('钉钉机器人 accessToken 未配置，请设置环境变量 DINGTALK_ACCESS_TOKEN');
      return [];
    }
    // 支持逗号分隔的多个 token
    return tokens
      .split(',')
      .map(token => token.trim())
      .filter(token => token);
  }

  /**
   * 发送消息到钉钉群
   * @param {string} content 消息内容
   * @returns {Promise<boolean>} 发送结果
   */
  async sendMessage(startTime, endTime, content) {
    const tokens = this.getAccessTokens();
    if (tokens.length === 0) {
      return false;
    }

    const message = {
      msgtype: 'markdown',
      markdown: {
        title: `[Tide]${startTime.format('YYYY-MM-DD HH:mm')} - ${endTime.format('HH:mm')}新闻摘要`,
        text: `${startTime.format('YYYY-MM-DD HH:mm')} - ${endTime.format('HH:mm')}摘要：\n${content}`,
      },
    };

    const results = await Promise.all(
      tokens.map(async token => {
        try {
          // 控制请求频率
          const now = Date.now();
          const timeSinceLastRequest = now - this.lastRequestTime;
          if (timeSinceLastRequest < this.minRequestInterval) {
            await new Promise(resolve =>
              setTimeout(resolve, this.minRequestInterval - timeSinceLastRequest)
            );
          }

          // 添加随机延迟
          const randomDelay = Math.floor(Math.random() * 1000) + 500; // 500-1500ms
          await new Promise(resolve => setTimeout(resolve, randomDelay));

          // 添加请求头伪装
          const headers = {
            'User-Agent': getRandomUserAgent(),
            Referer: getRandomReferer(),
            'Content-Type': 'application/json',
            Accept: 'application/json, text/plain, */*',
            'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
            'Accept-Encoding': 'gzip, deflate, br',
            Connection: 'keep-alive',
            'Cache-Control': 'no-cache',
            Pragma: 'no-cache',
            'Sec-Fetch-Dest': 'empty',
            'Sec-Fetch-Mode': 'cors',
            'Sec-Fetch-Site': 'same-origin',
            DNT: '1',
            'Upgrade-Insecure-Requests': '1',
          };

          const response = await axios.post(
            `https://oapi.dingtalk.com/robot/send?access_token=${token}`,
            message,
            {
              headers,
              timeout: 10000, // 10 秒超时
              validateStatus: function (status) {
                return status >= 200 && status < 300; // 只接受 2xx 的状态码
              },
            }
          );

          this.lastRequestTime = Date.now();

          if (response.data.errcode === 0) {
            logger.info(`钉钉消息发送成功 (token: ${token.substring(0, 8)}...)`);
            return true;
          }

          logger.error(
            `钉钉消息发送失败 (token: ${token.substring(0, 8)}...): ${response.data.errmsg}`
          );
          return false;
        } catch (error) {
          logger.error(`钉钉消息发送失败 (token: ${token.substring(0, 8)}...):`, error);
          // 如果是网络错误，等待更长时间后重试
          if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
            await new Promise(resolve => setTimeout(resolve, 5000));
          }
          return false;
        }
      })
    );

    // 只要有一个发送成功就返回 true
    return results.some(result => result === true);
  }
}

module.exports = new WebhookService();
