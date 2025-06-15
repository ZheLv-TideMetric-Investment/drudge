import crypto from 'crypto';
import { REALTIME_CONFIG } from './config.js';

class Fingerprint {
    constructor() {
        this.hashBits = 64;
        this.threshold = REALTIME_CONFIG.fingerprint.threshold;
        this.minLength = REALTIME_CONFIG.fingerprint.minLength;
    }

    // 计算文本的SimHash值
    calculateSimHash(text) {
        if (text.length < this.minLength) {
            return null;
        }

        const features = this.extractFeatures(text);
        const weights = new Array(this.hashBits).fill(0);

        for (const feature of features) {
            const hash = this.hashFeature(feature);
            for (let i = 0; i < this.hashBits; i++) {
                if (hash & (1 << i)) {
                    weights[i] += 1;
                } else {
                    weights[i] -= 1;
                }
            }
        }

        let simHash = 0;
        for (let i = 0; i < this.hashBits; i++) {
            if (weights[i] > 0) {
                simHash |= (1 << i);
            }
        }

        return simHash;
    }

    // 提取文本特征
    extractFeatures(text) {
        const words = text.split(/\s+/);
        const features = new Set();
        
        // 添加单词特征
        words.forEach(word => {
            if (word.length > 1) {
                features.add(word);
            }
        });

        // 添加双词特征
        for (let i = 0; i < words.length - 1; i++) {
            const bigram = words[i] + ' ' + words[i + 1];
            features.add(bigram);
        }

        return Array.from(features);
    }

    // 计算特征的哈希值
    hashFeature(feature) {
        const hash = crypto.createHash('md5')
            .update(feature)
            .digest('hex');
        return parseInt(hash.substring(0, 16), 16);
    }

    // 计算两个SimHash值的相似度
    calculateSimilarity(hash1, hash2) {
        const xor = hash1 ^ hash2;
        let distance = 0;
        
        while (xor) {
            distance += xor & 1;
            xor >>= 1;
        }

        return 1 - (distance / this.hashBits);
    }

    // 检查两段文本是否相似
    isSimilar(text1, text2) {
        const hash1 = this.calculateSimHash(text1);
        const hash2 = this.calculateSimHash(text2);

        if (!hash1 || !hash2) {
            return false;
        }

        const similarity = this.calculateSimilarity(hash1, hash2);
        return similarity >= this.threshold;
    }

    // 获取文本的指纹
    getFingerprint(text) {
        const hash = this.calculateSimHash(text);
        return hash ? hash.toString(16) : null;
    }
}

export default new Fingerprint(); 