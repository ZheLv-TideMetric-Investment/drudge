import { EventEmitter } from 'events';
import { REALTIME_CONFIG } from './config.js';

class MemoryQueue extends EventEmitter {
    constructor() {
        super();
        this.queue = [];
        this.processing = false;
        this.maxSize = REALTIME_CONFIG.queue.maxSize;
        this.batchSize = REALTIME_CONFIG.queue.batchSize;
        this.flushInterval = REALTIME_CONFIG.queue.flushInterval;
        this.lastFlush = Date.now();
    }

    async push(item) {
        if (this.queue.length >= this.maxSize) {
            throw new Error('队列已满');
        }
        this.queue.push(item);
        this.emit('itemAdded', item);
        
        if (this.queue.length >= this.batchSize || 
            Date.now() - this.lastFlush >= this.flushInterval) {
            await this.flush();
        }
    }

    async flush() {
        if (this.processing || this.queue.length === 0) return;
        
        this.processing = true;
        try {
            const batch = this.queue.splice(0, this.batchSize);
            this.lastFlush = Date.now();
            this.emit('batchReady', batch);
        } catch (error) {
            console.error('队列刷新错误:', error);
            this.emit('error', error);
        } finally {
            this.processing = false;
        }
    }

    getSize() {
        return this.queue.length;
    }

    clear() {
        this.queue = [];
        this.emit('cleared');
    }

    startAutoFlush() {
        setInterval(() => this.flush(), this.flushInterval);
    }
}

export default new MemoryQueue(); 