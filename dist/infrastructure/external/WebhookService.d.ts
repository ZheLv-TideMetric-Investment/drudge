declare class WebhookService {
    /**
     * 获取所有配置的钉钉机器人 access token
     * @returns {string[]} access token 数组
     */
    getAccessTokens(): string[];
    /**
     * 发送消息到钉钉群
     * @param {string|moment.Moment} startTime - 开始时间
     * @param {string|moment.Moment} endTime - 结束时间
     * @param {string} content - 消息内容
     * @param {string} title - 自定义标题（可选）
     * @returns {Promise<boolean>} 发送结果
     */
    sendMessage(startTime: any, endTime: any, content: any, title?: any): Promise<boolean>;
}
declare const _default: WebhookService;
export default _default;
