const axios = require('axios');
const moment = require('moment-timezone');

const logger = require('../utils/logger');

// 设置默认时区为北京时间
moment.tz.setDefault('Asia/Shanghai');

class WebhookService {
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
          const response = await axios.post(
            `https://oapi.dingtalk.com/robot/send?access_token=${token}`,
            message,
            {
              headers: {
                'Content-Type': 'application/json',
              },
            }
          );

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
          return false;
        }
      })
    );

    // 只要有一个发送成功就返回 true
    return results.some(result => result === true);
  }
}

module.exports = new WebhookService();
