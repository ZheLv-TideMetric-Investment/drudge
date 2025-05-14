const axios = require('axios');
const config = require('../config/config');
const logger = require('../utils/logger');

class WebhookService {
  async sendMessage(message) {
    try {
      if (!config.webhook.url) {
        logger.error('Webhook URL未配置');
        return false;
      }

      const response = await axios.post(config.webhook.url, {
        content: message,
      });

      if (response.status === 200) {
        logger.info('消息发送成功');
        return true;
      }
      return false;
    } catch (error) {
      logger.error('消息发送失败:', error);
      return false;
    }
  }
}

module.exports = new WebhookService();
