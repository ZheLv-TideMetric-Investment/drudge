const axios = require('axios');
const moment = require('moment');

const logger = require('../utils/logger');
class WebhookService {
  /**
   * 发送消息到钉钉群
   * @param {string} content 消息内容
   * @returns {Promise<boolean>} 发送结果
   */
  async sendMessage(content) {
    try {
      if (!process.env.DINGTALK_ACCESS_TOKEN) {
        logger.error('钉钉机器人 accessToken 未配置，请设置环境变量 DINGTALK_ACCESS_TOKEN');
        return false;
      }

      const message = {
        msgtype: 'text',
        text: {
          content: `[Tide]${moment().subtract(1, 'hour').format('YYYY-MM-DD HH:mm')} - ${moment().format('HH:mm')}新闻摘要: \n${content}`,
        },
      };

      const response = await axios.post(
        `https://oapi.dingtalk.com/robot/send?access_token=${process.env.DINGTALK_ACCESS_TOKEN}`,
        message,
        {
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      if (response.data.errcode === 0) {
        logger.info('钉钉消息发送成功');
        return true;
      }

      logger.error(`钉钉消息发送失败: ${response.data.errmsg}`);
      return false;
    } catch (error) {
      logger.error('钉钉消息发送失败:', error);
      return false;
    }
  }
}

module.exports = new WebhookService();
