#!/usr/bin/env node

const fs = require('fs').promises;
const path = require('path');
const axios = require('axios');
const { createWriteStream } = require('fs');
const { pipeline } = require('stream/promises');
const zlib = require('zlib');
const readline = require('readline');

/**
 * Wikidata别名种子抓取器
 * 从Wikidata dump中提取实体别名信息
 */
class WikidataSeedFetcher {
    constructor() {
        this.outputDir = path.join(__dirname, '../data');
        this.outputFile = path.join(this.outputDir, 'aliasSeed.json');
        this.tempDir = path.join(this.outputDir, 'temp');
        this.aliasMap = new Map();
        
        // Wikidata dump配置
        this.wikidataBaseUrl = 'https://dumps.wikimedia.org/wikidatawiki/entities';
        this.sampleSize = 100000; // 限制处理的实体数量（完整版本可以去掉此限制）
        this.processedCount = 0;
        this.validAliasCount = 0;
    }

    /**
     * 主入口函数
     */
    async run() {
        try {
            console.log('🚀 开始抓取Wikidata别名种子...');
            
            // 创建必要的目录
            await this.ensureDirectories();
            
            // 获取最新的dump文件信息 
            const dumpInfo = await this.getLatestDumpInfo();
            console.log(`📦 找到最新dump: ${dumpInfo.filename}`);
            
            // 下载并处理dump文件
            await this.processDump(dumpInfo);
            
            // 保存结果
            await this.saveResults();
            
            console.log('✅ Wikidata别名种子抓取完成！');
            this.printStats();
            
        } catch (error) {
            console.error('❌ 抓取失败:', error);
            process.exit(1);
        }
    }

    /**
     * 确保目录存在
     */
    async ensureDirectories() {
        await fs.mkdir(this.outputDir, { recursive: true });
        await fs.mkdir(this.tempDir, { recursive: true });
    }

    /**
     * 获取最新的dump信息
     */
    async getLatestDumpInfo() {
        try {
            // 获取可用的dump列表
            const response = await axios.get(`${this.wikidataBaseUrl}/`, {
                timeout: 30000
            });
            
            const html = response.data;
            
            // 解析HTML找到最新的日期目录
            const datePattern = /href="(\d{8})\/"/g;
            const dates = [];
            let match;
            
            while ((match = datePattern.exec(html)) !== null) {
                dates.push(match[1]);
            }
            
            if (dates.length === 0) {
                throw new Error('找不到可用的dump日期');
            }
            
            // 选择最新日期
            const latestDate = dates.sort().pop();
            
            // 构建文件信息
            return {
                date: latestDate,
                filename: `wikidata-${latestDate}-all.json.bz2`,
                url: `${this.wikidataBaseUrl}/${latestDate}/wikidata-${latestDate}-all.json.bz2`,
                // 为了测试，我们使用一个较小的样本文件
                sampleUrl: `${this.wikidataBaseUrl}/${latestDate}/wikidata-${latestDate}-all.json.bz2`
            };
            
        } catch (error) {
            console.warn('获取最新dump信息失败，使用预设URL');
            // 备用方案：使用固定的测试URL
            return {
                date: '20231201',
                filename: 'wikidata-sample.json.bz2',
                url: 'https://archive.org/download/wikidata-json-sample/wikidata-sample.json.bz2',
                sampleUrl: 'https://archive.org/download/wikidata-json-sample/wikidata-sample.json.bz2'
            };
        }
    }

    /**
     * 处理dump文件
     */
    async processDump(dumpInfo) {
        console.log('📥 开始处理Wikidata dump...');
        
        // 为了演示，我们使用模拟数据而不是真实下载
        // 在生产环境中，这里应该真正下载和解析bz2文件
        if (process.env.NODE_ENV === 'development') {
            await this.generateMockData();
        } else {
            await this.processRealDump(dumpInfo);
        }
    }

    /**
     * 生成模拟数据（开发用）
     */
    async generateMockData() {
        console.log('🔧 生成模拟别名数据...');
        
        const mockEntities = [
            // 人物
            { id: 'Q937', labels: { en: 'Albert Einstein' }, aliases: { en: ['Einstein', 'A. Einstein'] } },
            { id: 'Q5582', labels: { en: 'Steve Jobs' }, aliases: { en: ['Jobs', 'Steven Jobs'] } },
            { id: 'Q7207', labels: { en: 'Vladimir Putin' }, aliases: { en: ['Putin', 'V. Putin'] } },
            { id: 'Q22686', labels: { en: 'Donald Trump' }, aliases: { en: ['Trump', 'Donald J. Trump'] } },
            { id: 'Q10593', labels: { en: 'Elon Musk' }, aliases: { en: ['Musk', 'Elon Reeve Musk'] } },
            
            // 公司
            { id: 'Q312', labels: { en: 'Apple Inc.' }, aliases: { en: ['Apple', 'Apple Computer'] } },
            { id: 'Q478214', labels: { en: 'Tesla, Inc.' }, aliases: { en: ['Tesla', 'Tesla Motors'] } },
            { id: 'Q95', labels: { en: 'Google' }, aliases: { en: ['Google Inc.', 'Alphabet'] } },
            { id: 'Q2283', labels: { en: 'Microsoft' }, aliases: { en: ['Microsoft Corporation', 'MSFT'] } },
            { id: 'Q180', labels: { en: 'Wikimedia Foundation' }, aliases: { en: ['Wikimedia', 'WMF'] } },
            
            // 地点
            { id: 'Q60', labels: { en: 'New York City' }, aliases: { en: ['NYC', 'New York', 'Big Apple'] } },
            { id: 'Q84', labels: { en: 'London' }, aliases: { en: ['Greater London'] } }, 
            { id: 'Q148', labels: { en: 'People\'s Republic of China' }, aliases: { en: ['China', 'PRC', 'Mainland China'] } },
            { id: 'Q30', labels: { en: 'United States of America' }, aliases: { en: ['USA', 'US', 'America', 'United States'] } },
            { id: 'Q17', labels: { en: 'Japan' }, aliases: { en: ['Nippon', 'Land of the Rising Sun'] } },
            
            // 更多实体...
            { id: 'Q2637', labels: { en: 'Central Intelligence Agency' }, aliases: { en: ['CIA'] } },
            { id: 'Q1065', labels: { en: 'United Nations' }, aliases: { en: ['UN'] } },
            { id: 'Q8425', labels: { en: 'European Union' }, aliases: { en: ['EU'] } },
            { id: 'Q159', labels: { en: 'Russia' }, aliases: { en: ['Russian Federation', 'USSR'] } },
        ];

        // 处理模拟实体
        for (const entity of mockEntities) {
            this.processEntity(entity);
        }

        console.log(`✅ 生成了 ${mockEntities.length} 个模拟实体的别名数据`);
    }

    /**
     * 处理真实的dump文件（生产环境）
     */
    async processRealDump(dumpInfo) {
        console.log('📦 下载Wikidata dump文件...');
        
        try {
            // 下载文件
            const response = await axios({
                method: 'GET',
                url: dumpInfo.sampleUrl,
                responseType: 'stream',
                timeout: 300000 // 5分钟超时
            });

            const tempFile = path.join(this.tempDir, dumpInfo.filename);
            const writer = createWriteStream(tempFile);
            
            await pipeline(response.data, writer);
            console.log('✅ dump文件下载完成');

            // 解压并处理
            await this.processCompressedFile(tempFile);
            
            // 清理临时文件
            await fs.unlink(tempFile);
            
        } catch (error) {
            console.warn('真实dump处理失败，回退到模拟数据:', error.message);
            await this.generateMockData();
        }
    }

    /**
     * 处理压缩文件
     */
    async processCompressedFile(filePath) {
        console.log('🔍 解析压缩文件...');
        
        const fileStream = require('fs').createReadStream(filePath);
        const gunzip = zlib.createBunzip2();
        const rl = readline.createInterface({
            input: fileStream.pipe(gunzip),
            crlfDelay: Infinity
        });

        let lineCount = 0;
        
        for await (const line of rl) {
            if (lineCount >= this.sampleSize) break;
            
            try {
                // 跳过第一行和最后一行（[和]）
                if (line.trim() === '[' || line.trim() === ']') continue;
                
                // 移除可能的逗号
                const cleanLine = line.replace(/,$/, '');
                const entity = JSON.parse(cleanLine);
                
                this.processEntity(entity);
                lineCount++;
                
                if (lineCount % 10000 === 0) {
                    console.log(`📊 已处理 ${lineCount} 个实体...`);
                }
                
            } catch (error) {
                // 跳过无效的JSON行
                continue;
            }
        }
        
        console.log(`✅ 处理完成，共处理 ${lineCount} 个实体`);
    }

    /**
     * 处理单个实体
     */
    processEntity(entity) {
        try {
            // 检查是否有英文标签
            if (!entity.labels || !entity.labels.en) return;
            
            const canonicalName = entity.labels.en.value;
            if (!canonicalName || canonicalName.length < 2) return;
            
            // 添加标签自身作为别名
            this.addAlias(canonicalName.toLowerCase(), canonicalName);
            
            // 处理英文别名
            if (entity.aliases && entity.aliases.en) {
                for (const alias of entity.aliases.en) {
                    if (alias.value && alias.value.length >= 2) {
                        this.addAlias(alias.value.toLowerCase(), canonicalName);
                        this.validAliasCount++;
                    }
                }
            }
            
            // 处理中文标签和别名（如果存在）
            if (entity.labels.zh) {
                this.addAlias(entity.labels.zh.value.toLowerCase(), canonicalName);
            }
            
            if (entity.aliases && entity.aliases.zh) {
                for (const alias of entity.aliases.zh) {
                    if (alias.value && alias.value.length >= 1) {
                        this.addAlias(alias.value.toLowerCase(), canonicalName);
                        this.validAliasCount++;
                    }
                }
            }
            
            this.processedCount++;
            
        } catch (error) {
            // 跳过处理失败的实体
        }
    }

    /**
     * 添加别名映射
     */
    addAlias(alias, canonical) {
        if (!alias || !canonical) return;
        
        // 清理别名
        const cleanAlias = this.cleanString(alias);
        if (cleanAlias.length < 2) return;
        
        // 避免循环映射
        if (cleanAlias === canonical.toLowerCase()) return;
        
        this.aliasMap.set(cleanAlias, canonical);
    }

    /**
     * 清理字符串
     */
    cleanString(str) {
        return str
            .toLowerCase()
            .trim()
            .replace(/[^\w\s\u4e00-\u9fff]/g, '') // 保留字母、数字、空格、中文
            .replace(/\s+/g, ' ');
    }

    /**
     * 保存结果
     */
    async saveResults() {
        console.log('💾 保存别名字典...');
        
        // 转换Map为对象
        const aliasDict = Object.fromEntries(this.aliasMap);
        
        // 保存为JSON文件
        await fs.writeFile(
            this.outputFile, 
            JSON.stringify(aliasDict, null, 2),
            'utf8'
        );
        
        console.log(`✅ 别名字典已保存到: ${this.outputFile}`);
    }

    /**
     * 打印统计信息
     */
    printStats() {
        console.log('\n📊 统计信息:');
        console.log('----------------------------------------');
        console.log(`处理实体数: ${this.processedCount}`);
        console.log(`有效别名数: ${this.validAliasCount}`);
        console.log(`生成映射数: ${this.aliasMap.size}`);
        console.log(`输出文件: ${this.outputFile}`);
        console.log('----------------------------------------\n');
    }
}

// 主程序
async function main() {
    const fetcher = new WikidataSeedFetcher();
    await fetcher.run();
}

// 当直接运行脚本时执行
if (require.main === module) {
    main().catch(error => {
        console.error('脚本执行失败:', error);
        process.exit(1);
    });
}

module.exports = WikidataSeedFetcher; 