// @ts-nocheck
import fs from 'fs';
import path from 'path';
import logger from '../../shared/utils/logger';
import config from '../../shared/config/config';

/**
 * 文件存储服务
 * 负责处理本地文件的读写操作
 */
class FileStorage {
  constructor() {
    this.storagePath = config.storage.path || './data';
    this.ensureStorageDirectory();
  }

  /**
   * 确保存储目录存在
   */
  ensureStorageDirectory() {
    try {
      if (!fs.existsSync(this.storagePath)) {
        fs.mkdirSync(this.storagePath, { recursive: true });
        logger.info(`创建存储目录: ${this.storagePath}`);
      }
    } catch (error) {
      logger.error('创建存储目录失败:', error);
      throw error;
    }
  }

  /**
   * 保存数据到文件
   */
  async saveData(filename: string, data: any): Promise<void> {
    try {
      const filePath = path.join(this.storagePath, filename);
      const jsonData = JSON.stringify(data, null, 2);
      await fs.promises.writeFile(filePath, jsonData, 'utf8');
      logger.debug(`数据已保存到: ${filePath}`);
    } catch (error) {
      logger.error(`保存数据失败: ${filename}`, error);
      throw error;
    }
  }

  /**
   * 从文件读取数据
   */
  async loadData(filename: string): Promise<any> {
    try {
      const filePath = path.join(this.storagePath, filename);
      
      if (!fs.existsSync(filePath)) {
        logger.debug(`文件不存在: ${filePath}`);
        return null;
      }

      const fileContent = await fs.promises.readFile(filePath, 'utf8');
      const data = JSON.parse(fileContent);
      logger.debug(`数据已加载: ${filePath}`);
      return data;
    } catch (error) {
      logger.error(`加载数据失败: ${filename}`, error);
      throw error;
    }
  }

  /**
   * 检查文件是否存在
   */
  fileExists(filename: string): boolean {
    const filePath = path.join(this.storagePath, filename);
    return fs.existsSync(filePath);
  }

  /**
   * 删除文件
   */
  async deleteFile(filename: string): Promise<void> {
    try {
      const filePath = path.join(this.storagePath, filename);
      
      if (fs.existsSync(filePath)) {
        await fs.promises.unlink(filePath);
        logger.debug(`文件已删除: ${filePath}`);
      }
    } catch (error) {
      logger.error(`删除文件失败: ${filename}`, error);
      throw error;
    }
  }

  /**
   * 获取文件列表
   */
  async getFileList(pattern?: string): Promise<string[]> {
    try {
      const items = await fs.promises.readdir(this.storagePath);
      const files = [];

      for (const item of items) {
        const itemPath = path.join(this.storagePath, item);
        const stats = await fs.promises.stat(itemPath);
        
        // 只包含JSON文件，排除目录和非JSON文件
        if (stats.isFile() && item.endsWith('.json')) {
          files.push(item);
        }
      }
      
      if (pattern) {
        const regex = new RegExp(pattern);
        return files.filter(file => regex.test(file));
      }
      
      return files;
    } catch (error) {
      logger.error('获取文件列表失败:', error);
      throw error;
    }
  }

  /**
   * 获取文件信息
   */
  async getFileInfo(filename: string): Promise<any> {
    try {
      const filePath = path.join(this.storagePath, filename);
      
      if (!fs.existsSync(filePath)) {
        return null;
      }

      const stats = await fs.promises.stat(filePath);
      return {
        filename,
        size: stats.size,
        created: stats.birthtime,
        modified: stats.mtime,
        isFile: stats.isFile(),
        isDirectory: stats.isDirectory()
      };
    } catch (error) {
      logger.error(`获取文件信息失败: ${filename}`, error);
      throw error;
    }
  }

  /**
   * 清理旧文件
   */
  async cleanupOldFiles(maxAge: number = 7 * 24 * 60 * 60 * 1000): Promise<number> {
    try {
      const files = await this.getFileList();
      const now = Date.now();
      let deletedCount = 0;

      for (const file of files) {
        const fileInfo = await this.getFileInfo(file);
        if (fileInfo && (now - fileInfo.modified.getTime()) > maxAge) {
          await this.deleteFile(file);
          deletedCount++;
        }
      }

      logger.info(`清理了 ${deletedCount} 个过期文件`);
      return deletedCount;
    } catch (error) {
      logger.error('清理文件失败:', error);
      throw error;
    }
  }

  /**
   * 获取所有文件的数据
   */
  async getAll(pattern?: string): Promise<any[]> {
    try {
      const files = await this.getFileList(pattern);
      const allData = [];

      for (const file of files) {
        try {
          const data = await this.loadData(file);
          if (data && Array.isArray(data)) {
            // 如果是数组，展开所有项目
            allData.push(...data);
          } else if (data) {
            // 如果是单个对象，直接添加
            allData.push(data);
          }
        } catch (error) {
          logger.warn(`跳过无法读取的文件: ${file}`, error);
        }
      }

      logger.debug(`加载了 ${allData.length} 条数据`);
      return allData;
    } catch (error) {
      logger.error('获取所有数据失败:', error);
      throw error;
    }
  }

  /**
   * 获取最新的一条数据
   */
  async getLatest(): Promise<any> {
    try {
      const allData = await this.getAll();
      
      if (allData.length === 0) {
        return null;
      }

      // 按照时间戳或ID排序，获取最新的一条
      const sortedData = allData.sort((a, b) => {
        // 优先使用时间戳排序
        if (a.time && b.time) {
          return b.time - a.time;
        }
        // 其次使用ID排序
        if (a.id && b.id) {
          return b.id - a.id;
        }
        // 最后使用创建时间
        return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
      });

      logger.debug(`获取最新数据: ${sortedData[0].id || '未知ID'}`);
      return sortedData[0];
    } catch (error) {
      logger.error('获取最新数据失败:', error);
      throw error;
    }
  }

  /**
   * 保存数据（支持数组和单个对象）
   */
  async save(data: any): Promise<void> {
    try {
      const timestamp = Date.now();
      const filename = `news_${timestamp}.json`;
      
      await this.saveData(filename, data);
      logger.info(`数据已保存到: ${filename}, 数据量: ${Array.isArray(data) ? data.length : 1}`);
    } catch (error) {
      logger.error('保存数据失败:', error);
      throw error;
    }
  }

  /**
   * 按时间范围获取数据
   */
  async getByTimeRange(startTime: any, endTime: any): Promise<any[]> {
    try {
      const allData = await this.getAll();
      const startTimestamp = typeof startTime.unix === 'function' ? startTime.unix() : Math.floor(startTime.getTime() / 1000);
      const endTimestamp = typeof endTime.unix === 'function' ? endTime.unix() : Math.floor(endTime.getTime() / 1000);

      const filteredData = allData.filter(item => {
        if (!item.time) return false;
        return item.time >= startTimestamp && item.time <= endTimestamp;
      });

      logger.debug(`时间范围查询: ${filteredData.length} 条数据`);
      return filteredData;
    } catch (error) {
      logger.error('按时间范围获取数据失败:', error);
      throw error;
    }
  }

  /**
   * 获取存储路径
   */
  getStoragePath(): string {
    return this.storagePath;
  }
}

export default new FileStorage(); 