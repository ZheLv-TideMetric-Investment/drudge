import fs from 'fs/promises';
import path from 'path';
import axios from 'axios';
import { spawn } from 'child_process';
import { REALTIME_CONFIG } from './config.js';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class AliasDict {
    constructor() {
        this.aliasDict = new Map(); // 内存别名字典
        this.cacheFile = path.join(__dirname, '../../data/aliasSeed.json');
        this.wikiApiTimeout = 5000;
        this.llmTimeout = 10000;
        this.minSimilarity = 0.9;
        this.initialized = false;
    }

    /**
     * 初始化别名字典 - 从缓存文件加载
     */
    async initialize() {
        if (this.initialized) return;

        try {
            await this.loadSeedDict();
            this.initialized = true;
            console.log(`别名字典初始化完成，加载了 ${this.aliasDict.size} 条记录`);
        } catch (error) {
            console.warn('加载别名字典失败，将使用空字典:', error.message);
            this.initialized = true;
        }
    }

    /**
     * 加载种子字典
     */
    async loadSeedDict() {
        try {
            const data = await fs.readFile(this.cacheFile, 'utf8');
            const seedData = JSON.parse(data);
            
            if (Array.isArray(seedData)) {
                // 兼容数组格式
                seedData.forEach(([key, value]) => {
                    this.aliasDict.set(key, value);
                });
            } else {
                // 对象格式
                Object.entries(seedData).forEach(([key, value]) => {
                    this.aliasDict.set(key, value);
                });
            }
        } catch (error) {
            console.warn('种子字典文件不存在或格式错误:', error.message);
        }
    }

    /**
     * 标准化实体名称 - 核心函数
     * @param {string} raw 原始名称
     * @returns {Promise<string>} 标准化后的名称
     */
    async canonicalize(raw) {
        if (!raw || typeof raw !== 'string') return raw;
        
        // 确保已初始化
        if (!this.initialized) {
            await this.initialize();
        }

        const key = this.clean(raw);
        
        // ① 快查内存别名字典
        if (this.aliasDict.has(key)) {
            return this.aliasDict.get(key);
        }

        try {
            // ② Wikipedia OpenSearch API
            const wikiResult = await this.wikiSearch(key);
            if (wikiResult && wikiResult.score >= this.minSimilarity) {
                // 缓存结果
                this.aliasDict.set(key, wikiResult.title);
                await this.saveToCache();
                return wikiResult.title;
            }

            // ③ LLM 兜底检查
            const llmResult = await this.llmQuickCheck(raw);
            if (llmResult && llmResult !== 'NO') {
                // 缓存结果
                this.aliasDict.set(key, llmResult);
                await this.saveToCache();
                return llmResult;
            }

        } catch (error) {
            console.warn(`别名解析失败 "${raw}":`, error.message);
        }

        // 返回原名
        return raw;
    }

    /**
     * 清理名称 - 统一格式
     * @param {string} name 原始名称
     * @returns {string} 清理后的名称
     */
    clean(name) {
        return name
            .toLowerCase()
            .trim()
            .replace(/[^\w\s\u4e00-\u9fff]/g, '') // 保留字母、数字、空格、中文
            .replace(/\s+/g, ' ');
    }

    /**
     * Wikipedia OpenSearch API 查询
     * @param {string} query 查询关键词
     * @returns {Promise<Object|null>} 搜索结果
     */
    async wikiSearch(query) {
        try {
            // 同时查询英文和中文Wikipedia
            const [enResult, zhResult] = await Promise.allSettled([
                this.searchWiki('en', query),
                this.searchWiki('zh', query)
            ]);

            // 选择最佳结果
            const results = [];
            if (enResult.status === 'fulfilled' && enResult.value) {
                results.push({ ...enResult.value, source: 'en' });
            }
            if (zhResult.status === 'fulfilled' && zhResult.value) {
                results.push({ ...zhResult.value, source: 'zh' });
            }

            if (results.length === 0) return null;

            // 返回分数最高的结果，优先英文
            results.sort((a, b) => {
                if (a.score !== b.score) return b.score - a.score;
                return a.source === 'en' ? -1 : 1;
            });

            return results[0];

        } catch (error) {
            console.warn('Wikipedia搜索失败:', error.message);
            return null;
        }
    }

    /**
     * 搜索指定语言的Wikipedia
     * @param {string} lang 语言代码 (en/zh)
     * @param {string} query 查询词
     * @returns {Promise<Object|null>} 搜索结果
     */
    async searchWiki(lang, query) {
        const apiUrl = `https://${lang}.wikipedia.org/w/api.php`;
        
        try {
            const response = await axios.get(apiUrl, {
                params: {
                    action: 'opensearch',
                    search: query,
                    limit: 1,
                    format: 'json',
                    formatversion: 2
                },
                timeout: this.wikiApiTimeout
            });

            const [, titles, descriptions, urls] = response.data;
            
            if (!titles || titles.length === 0) return null;

            const title = titles[0];
            const description = descriptions[0] || '';
            
            // 计算相似度分数
            const score = this.calculateSimilarity(query, title);
            
            return {
                title,
                description,
                url: urls[0],
                score,
                query
            };

        } catch (error) {
            console.warn(`${lang}wiki搜索失败:`, error.message);
            return null;
        }
    }

    /**
     * LLM快速检查
     * @param {string} raw 原始名称
     * @returns {Promise<string>} LLM返回的标准名称或'NO'
     */
    async llmQuickCheck(raw) {
        if (!REALTIME_CONFIG.llm.apiKey) {
            return 'NO'; // 没有API Key时跳过LLM检查
        }

        try {
            const prompt = `Does "${raw}" refer to an existing famous person, company or place?
If yes, return ONLY the canonical English name, else return "NO".

Examples:
- "马斯克" → "Elon Musk"
- "特斯拉" → "Tesla"
- "苹果公司" → "Apple"
- "随机词汇abc123" → "NO"

Answer for "${raw}":`;

            const response = await axios.post(
                'https://api.deepseek.com/v1/chat/completions',
                {
                    model: REALTIME_CONFIG.llm.model,
                    messages: [{ role: 'user', content: prompt }],
                    max_tokens: 50,
                    temperature: 0.1
                },
                {
                    headers: {
                        'Authorization': `Bearer ${REALTIME_CONFIG.llm.apiKey}`,
                        'Content-Type': 'application/json'
                    },
                    timeout: this.llmTimeout
                }
            );

            const answer = response.data.choices[0].message.content.trim();
            
            // 验证答案格式
            if (answer === 'NO' || answer.length > 100) {
                return 'NO';
            }

            return answer;

        } catch (error) {
            console.warn('LLM快速检查失败:', error.message);
            return 'NO';
        }
    }

    /**
     * 计算字符串相似度
     * @param {string} str1 字符串1
     * @param {string} str2 字符串2
     * @returns {number} 相似度分数 (0-1)
     */
    calculateSimilarity(str1, str2) {
        const s1 = this.clean(str1);
        const s2 = this.clean(str2);
        
        // 完全匹配
        if (s1 === s2) return 1.0;
        
        // 包含关系
        if (s1.includes(s2) || s2.includes(s1)) return 0.95;
        
        // Levenshtein距离
        const maxLen = Math.max(s1.length, s2.length);
        if (maxLen === 0) return 1.0;
        
        const distance = this.levenshteinDistance(s1, s2);
        return 1 - (distance / maxLen);
    }

    /**
     * 计算Levenshtein距离
     */
    levenshteinDistance(str1, str2) {
        const matrix = Array(str1.length + 1).fill().map(() => Array(str2.length + 1).fill(0));
        
        for (let i = 0; i <= str1.length; i++) matrix[i][0] = i;
        for (let j = 0; j <= str2.length; j++) matrix[0][j] = j;
        
        for (let i = 1; i <= str1.length; i++) {
            for (let j = 1; j <= str2.length; j++) {
                const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
                matrix[i][j] = Math.min(
                    matrix[i - 1][j] + 1,
                    matrix[i][j - 1] + 1,
                    matrix[i - 1][j - 1] + cost
                );
            }
        }
        
        return matrix[str1.length][str2.length];
    }

    /**
     * 保存缓存到文件
     */
    async saveToCache() {
        try {
            // 确保目录存在
            await fs.mkdir(path.dirname(this.cacheFile), { recursive: true });
            
            // 转换Map为对象
            const cacheData = Object.fromEntries(this.aliasDict);
            
            await fs.writeFile(this.cacheFile, JSON.stringify(cacheData, null, 2));
        } catch (error) {
            console.warn('保存别名缓存失败:', error.message);
        }
    }

    /**
     * 批量标准化实体名称
     * @param {Array<string>} names 实体名称数组
     * @returns {Promise<Array<string>>} 标准化后的名称数组
     */
    async canonicalizeBatch(names) {
        if (!Array.isArray(names)) return [];
        
        const results = await Promise.allSettled(
            names.map(name => this.canonicalize(name))
        );
        
        return results.map((result, index) => 
            result.status === 'fulfilled' ? result.value : names[index]
        );
    }

    /**
     * 刷新种子字典 - 周期性任务
     */
    async refreshSeed() {
        try {
            console.log('开始刷新别名种子字典...');
            
            // 这里应该调用 fetch_alias_seed.js 脚本
            import { spawn } from 'child_process';
            const child = spawn('node', [path.join(__dirname, '../../scripts/fetch_alias_seed.js')]);
            
            return new Promise((resolve, reject) => {
                child.on('close', (code) => {
                    if (code === 0) {
                        console.log('别名种子字典刷新完成');
                        // 重新加载字典
                        this.aliasDict.clear();
                        this.loadSeedDict().then(resolve).catch(reject);
                    } else {
                        reject(new Error(`刷新脚本退出码: ${code}`));
                    }
                });
            });
            
        } catch (error) {
            console.error('刷新种子字典失败:', error);
            throw error;
        }
    }

    /**
     * 获取统计信息
     */
    getStats() {
        return {
            totalAliases: this.aliasDict.size,
            initialized: this.initialized,
            cacheFile: this.cacheFile
        };
    }
}

// 创建全局实例
const aliasDict = new AliasDict();

export default {
    canonicalize: (name) => aliasDict.canonicalize(name),
    canonicalizeBatch: (names) => aliasDict.canonicalizeBatch(names),
    refreshSeed: () => aliasDict.refreshSeed(),
    getStats: () => aliasDict.getStats(),
    initialize: () => aliasDict.initialize()
}; 