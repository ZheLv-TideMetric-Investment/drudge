const ingestRaw = require('../src/realtime/ingestRaw');
const llmExtract = require('../src/realtime/llmExtract');
const realtimeAlert = require('../src/realtime/realtimeAlert');
const analysisStore = require('../src/realtime/analysisStore');
const memoryQueue = require('../src/realtime/memoryQueue');
const aliasDict = require('../src/realtime/aliasDict');
const config = require('../src/realtime/config');

class Controller {
    constructor() {
        this.isRunning = false;
        this.startTime = null;
        this.stats = {
            articlesProcessed: 0,
            hotArticles: 0,
            errors: 0
        };
    }

    async start() {
        if (this.isRunning) {
            console.log('系统已经在运行中');
            return;
        }

        console.log('启动实时新闻知识图谱系统...');
        this.isRunning = true;
        this.startTime = new Date();
        this.startStats();

        try {
            // 初始化别名字典
            console.log('🔤 初始化别名字典...');
            await aliasDict.initialize();
            
            // 启动数据摄入
            await ingestRaw.start();

            // 设置队列处理器
            memoryQueue.on('batchReady', async (batch) => {
                try {
                    // LLM提取
                    const extracted = await llmExtract.extract(batch);
                    
                    // 处理每个文章
                    for (const article of extracted) {
                        try {
                            // 发送警报
                            await realtimeAlert.process(article);
                            
                            // 更新统计
                            this.stats.articlesProcessed++;
                            if (article.isHot) {
                                this.stats.hotArticles++;
                            }
                        } catch (error) {
                            console.error('文章处理错误:', error);
                            this.stats.errors++;
                        }
                    }

                    // 存储到图谱
                    await analysisStore.store(extracted);
                } catch (error) {
                    console.error('批次处理错误:', error);
                    this.stats.errors++;
                }
            });

            // 启动自动刷新
            memoryQueue.startAutoFlush();

            console.log('系统启动完成');
        } catch (error) {
            console.error('系统启动错误:', error);
            await this.stop();
        }
    }

    async stop() {
        if (!this.isRunning) {
            console.log('系统未在运行');
            return;
        }

        console.log('正在停止系统...');
        this.isRunning = false;

        try {
            // 停止数据摄入
            ingestRaw.stop();

            // 关闭数据库连接
            await analysisStore.close();

            // 清空队列
            memoryQueue.clear();

            console.log('系统已停止');
            this.printStats();
        } catch (error) {
            console.error('系统停止错误:', error);
        }
    }

    startStats() {
        // 每5秒打印一次统计信息
        this.statsInterval = setInterval(() => {
            this.printStats();
        }, 5000);
    }

    printStats() {
        const uptime = this.startTime ? 
            Math.floor((Date.now() - this.startTime) / 1000) : 0;

        console.log('\n系统状态:');
        console.log('----------------------------------------');
        console.log(`运行时间: ${uptime}秒`);
        console.log(`处理文章: ${this.stats.articlesProcessed}`);
        console.log(`爆点新闻: ${this.stats.hotArticles}`);
        console.log(`错误数量: ${this.stats.errors}`);
        console.log(`队列大小: ${memoryQueue.getSize()}`);
        console.log('----------------------------------------\n');
    }
}

// 创建控制器实例
const controller = new Controller();

// 处理进程信号
process.on('SIGINT', async () => {
    console.log('\n收到终止信号');
    await controller.stop();
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log('\n收到终止信号');
    await controller.stop();
    process.exit(0);
});

// 启动系统
controller.start().catch(error => {
    console.error('系统启动失败:', error);
    process.exit(1);
}); 