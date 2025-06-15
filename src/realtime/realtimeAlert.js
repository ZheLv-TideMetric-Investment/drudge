const axios = require('axios');
const crypto = require('crypto');
const config = require('./config');

class RealtimeAlert {
    constructor() {
        this.cooldown = config.alert.cooldown;
        this.lastAlert = new Map();
        this.dingtalkWebhook = config.notification.dingtalk.webhook;
        this.dingtalkSecret = config.notification.dingtalk.secret;
        this.slackWebhook = config.notification.slack.webhook;
        this.customWebhook = config.notification.customWebhook;
    }

    async process(article) {
        if (!article.isHot) return;

        const alertKey = this.getAlertKey(article);
        if (this.isInCooldown(alertKey)) return;

        try {
            await this.sendAlert(article);
            this.updateLastAlert(alertKey);
        } catch (error) {
            console.error('警报发送错误:', error);
        }
    }

    getAlertKey(article) {
        // 使用文章指纹作为警报键
        return article.fingerprint || 
            crypto.createHash('md5')
                .update(article.title + article.content)
                .digest('hex');
    }

    isInCooldown(alertKey) {
        const lastTime = this.lastAlert.get(alertKey);
        if (!lastTime) return false;

        return Date.now() - lastTime < this.cooldown;
    }

    updateLastAlert(alertKey) {
        this.lastAlert.set(alertKey, Date.now());
    }

    async sendAlert(article) {
        const message = this.formatMessage(article);
        
        // 发送到钉钉
        if (this.dingtalkWebhook) {
            await this.sendToDingtalk(message);
        }

        // 发送到Slack
        if (this.slackWebhook) {
            await this.sendToSlack(message);
        }

        // 发送到自定义Webhook
        if (this.customWebhook) {
            await this.sendToCustomWebhook(message);
        }
    }

    formatMessage(article) {
        const { title, content, url, source, extracted } = article;
        
        return {
            title: '🔥 爆点新闻警报',
            content: [
                `标题：${title}`,
                `来源：${source}`,
                `时间：${new Date().toLocaleString()}`,
                `链接：${url}`,
                '',
                '提取信息：',
                `- 人物：${extracted.who.join(', ')}`,
                `- 地点：${extracted.where.join(', ')}`,
                `- 时间：${extracted.when}`,
                `- 事件：${extracted.what}`,
                `- 类型：${extracted.type}`,
                `- 重要性：${extracted.importance}`,
                `- 情感：${extracted.sentiment}`
            ].join('\n')
        };
    }

    async sendToDingtalk(message) {
        const timestamp = Date.now();
        const sign = this.generateDingtalkSign(timestamp);

        await axios.post(this.dingtalkWebhook, {
            msgtype: 'markdown',
            markdown: {
                title: message.title,
                text: message.content
            }
        }, {
            params: {
                timestamp,
                sign
            }
        });
    }

    generateDingtalkSign(timestamp) {
        const stringToSign = `${timestamp}\n${this.dingtalkSecret}`;
        return crypto.createHmac('sha256', this.dingtalkSecret)
            .update(stringToSign)
            .digest('base64');
    }

    async sendToSlack(message) {
        await axios.post(this.slackWebhook, {
            blocks: [
                {
                    type: 'header',
                    text: {
                        type: 'plain_text',
                        text: message.title
                    }
                },
                {
                    type: 'section',
                    text: {
                        type: 'mrkdwn',
                        text: message.content
                    }
                }
            ]
        });
    }

    async sendToCustomWebhook(message) {
        await axios.post(this.customWebhook, message);
    }
}

module.exports = new RealtimeAlert(); 