import axios from 'axios';
import moment from 'moment-timezone';
import logger from '../../shared/utils/logger.js';

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
   * @param {string|moment.Moment} startTime - 开始时间 
   * @param {string|moment.Moment} endTime - 结束时间
   * @param {string} content - 消息内容
   * @param {string} title - 自定义标题（可选）
   * @returns {Promise<boolean>} 发送结果
   */
  async sendMessage(startTime, endTime, content, title = null) {
    const tokens = this.getAccessTokens();
    if (tokens.length === 0) {
      return false;
    }

    // 处理时间参数，支持字符串和moment对象
    const formatTime = (time) => {
      if (typeof time === 'string') {
        return time;
      }
      return moment(time).format('YYYY-MM-DD HH:mm');
    };

    const startTimeStr = formatTime(startTime);
    const endTimeStr = formatTime(endTime);

    // 确保标题始终包含Tide关键字
    let finalTitle;
    if (title) {
      finalTitle = title.includes('Tide') ? title : `[Tide] ${title}`;
    } else {
      finalTitle = `[Tide]${startTimeStr} - ${endTimeStr.split(' ')[1]}新闻摘要`;
    }

    // 确保消息内容始终包含Tide关键字
    let finalContent;
    if (content.includes('Tide')) {
      finalContent = content;
    } else {
      finalContent = `[Tide]\n\n${content}`;
    }

    const message = {
      msgtype: 'markdown',
      markdown: {
        title: finalTitle,
        text: finalContent,
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

export default new WebhookService();
