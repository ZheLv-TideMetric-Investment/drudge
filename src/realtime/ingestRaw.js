const axios = require('axios');
const config = require('./config');
const memoryQueue = require('./memoryQueue');

class NewsIngester {
    constructor() {
        this.interval = config.dataSource.interval;
        this.maxItems = config.dataSource.maxItems;
        this.timeout = config.dataSource.timeout;
        this.isDev = config.system.isDev;
    }

    async start() {
        console.log('启动新闻摄入服务...');
        this.scheduleIngestion();
    }

    scheduleIngestion() {
        setInterval(async () => {
            try {
                await this.ingest();
            } catch (error) {
                console.error('新闻摄入错误:', error);
            }
        }, this.interval);
    }

    async ingest() {
        const articles = this.isDev ? 
            await this.getMockData() : 
            await this.fetchNews();

        for (const article of articles) {
            try {
                await memoryQueue.push(article);
            } catch (error) {
                console.error('队列推送错误:', error);
            }
        }
    }

    async fetchNews() {
        try {
            // 这里应该替换为实际的新闻API
            const response = await axios.get('https://api.example.com/news', {
                params: {
                    limit: this.maxItems,
                    sort: 'published_at:desc'
                },
                timeout: this.timeout
            });

            return this.normalizeArticles(response.data);
        } catch (error) {
            console.error('新闻获取错误:', error);
            return [];
        }
    }

    normalizeArticles(articles) {
        return articles.map(article => ({
            id: article.id,
            title: article.title,
            content: article.content,
            url: article.url,
            source: article.source,
            publishedAt: new Date(article.published_at),
            createdAt: new Date()
        }));
    }

    async getMockData() {
        // 生成模拟数据
        const mockArticles = [];
        const sources = ['新华社', '路透社', '彭博社', '华尔街日报'];
        const types = ['财经', '政治', '科技', '社会'];

        for (let i = 0; i < 10; i++) {
            const type = types[Math.floor(Math.random() * types.length)];
            const source = sources[Math.floor(Math.random() * sources.length)];
            
            mockArticles.push({
                id: `mock-${Date.now()}-${i}`,
                title: `${type}新闻标题 ${i + 1}`,
                content: `这是一条${type}新闻的详细内容。来源：${source}。`,
                url: `https://example.com/news/${i}`,
                source,
                publishedAt: new Date(),
                createdAt: new Date()
            });
        }

        return mockArticles;
    }

    stop() {
        console.log('停止新闻摄入服务...');
        // 清理定时器
        if (this.interval) {
            clearInterval(this.interval);
        }
    }
}

module.exports = new NewsIngester(); 