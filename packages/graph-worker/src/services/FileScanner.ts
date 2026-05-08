import fs from 'fs';
import path from 'path';
import { logger } from '../utils/logger';
import config from '../config/config';
import { getCurrentTime } from '../utils/timeUtils';

/**
 * 文件扫描服务
 * 负责扫描新闻目录，找到未图谱化的文件
 */

export interface FileInfo {
  filePath: string;
  fileName: string;
  fullPath: string;
  size: number;
  modifiedTime: Date;
  isProcessed: boolean;
}

/**
 * 扫描未处理的新闻文件
 */
export async function scanUnprocessedFiles(): Promise<FileInfo[]> {
  try {
    const newsDirectory = config.dataSource.newsDirectory;
    const supportedPrefixes = config.dataSource.supportedPrefixes;

    logger.debug(`📂 扫描目录: ${newsDirectory}`);

    if (!fs.existsSync(newsDirectory)) {
      logger.warn(`⚠️ 新闻目录不存在: ${newsDirectory}`);
      return [];
    }

    const files = fs.readdirSync(newsDirectory);
    const newsFiles: FileInfo[] = [];

    for (const fileName of files) {
      // 检查文件是否符合支持的前缀
      const isSupported = supportedPrefixes.some(prefix => fileName.startsWith(prefix));
      if (!isSupported || !fileName.endsWith('.json')) {
        continue;
      }

      const fullPath = path.join(newsDirectory, fileName);
      const stats = fs.statSync(fullPath);

      if (!stats.isFile()) {
        continue;
      }

      // 检查文件是否已经被处理过
      const isProcessed = await checkIfFileProcessed(fullPath, fileName);

      const fileInfo: FileInfo = {
        filePath: newsDirectory,
        fileName,
        fullPath,
        size: stats.size,
        modifiedTime: stats.mtime,
        isProcessed,
      };

      if (!isProcessed) {
        newsFiles.push(fileInfo);
      }
    }

    logger.debug(`📄 找到 ${newsFiles.length} 个未处理的新闻文件`);

    // Keep near-real-time summaries useful even when a large historical backlog exists.
    return newsFiles.sort((a, b) => b.modifiedTime.getTime() - a.modifiedTime.getTime());
  } catch (error) {
    logger.error('扫描新闻文件失败:', error);
    throw error;
  }
}

/**
 * 检查文件是否已经被处理过
 * 通过检查文件名是否在已处理列表中，或者通过文件修改时间判断
 */
async function checkIfFileProcessed(fullPath: string, fileName: string): Promise<boolean> {
  try {
    // 创建处理记录文件路径
    const processedRecordFile = path.join(
      path.dirname(fullPath),
      '.processed',
      `${fileName}.processed`
    );

    // 检查是否存在处理记录文件
    if (fs.existsSync(processedRecordFile)) {
      const recordStats = fs.statSync(processedRecordFile);
      const fileStats = fs.statSync(fullPath);

      // 如果记录文件比原文件新，说明已处理
      if (recordStats.mtime >= fileStats.mtime) {
        return true;
      }
    }

    // 还可以通过其他方式检查，比如查询数据库中是否有该文件的记录
    // 这里可以扩展数据库查询逻辑

    return false;
  } catch (error) {
    logger.debug(`检查文件处理状态失败: ${fileName}`, error);
    return false; // 如果无法确定，默认认为未处理
  }
}

/**
 * 标记文件为已处理
 */
export async function markFileAsProcessed(filePath: string): Promise<void> {
  try {
    const fileName = path.basename(filePath);
    const processedDir = path.join(path.dirname(filePath), '.processed');

    // 确保处理记录目录存在
    if (!fs.existsSync(processedDir)) {
      fs.mkdirSync(processedDir, { recursive: true });
    }

    const recordFile = path.join(processedDir, `${fileName}.processed`);

    // 写入处理记录
    const record = {
      fileName,
      processedAt: getCurrentTime(),
      fileSize: fs.statSync(filePath).size,
      processedBy: 'graph-worker',
    };

    fs.writeFileSync(recordFile, JSON.stringify(record, null, 2));
    logger.debug(`✅ 文件标记为已处理: ${fileName}`);
  } catch (error) {
    logger.error(`标记文件处理状态失败: ${filePath}`, error);
    throw error;
  }
}

/**
 * 获取文件处理统计信息
 */
export async function getFileProcessingStats(): Promise<any> {
  try {
    const newsDirectory = config.dataSource.newsDirectory;
    const supportedPrefixes = config.dataSource.supportedPrefixes;

    if (!fs.existsSync(newsDirectory)) {
      return {
        totalFiles: 0,
        processedFiles: 0,
        unprocessedFiles: 0,
        lastScanTime: getCurrentTime(),
      };
    }

    const files = fs.readdirSync(newsDirectory);
    let totalFiles = 0;
    let processedFiles = 0;

    for (const fileName of files) {
      const isSupported = supportedPrefixes.some(prefix => fileName.startsWith(prefix));
      if (!isSupported || !fileName.endsWith('.json')) {
        continue;
      }

      totalFiles++;

      const fullPath = path.join(newsDirectory, fileName);
      const isProcessed = await checkIfFileProcessed(fullPath, fileName);

      if (isProcessed) {
        processedFiles++;
      }
    }

    return {
      totalFiles,
      processedFiles,
      unprocessedFiles: totalFiles - processedFiles,
      lastScanTime: getCurrentTime(),
    };
  } catch (error) {
    logger.error('获取文件处理统计失败:', error);
    throw error;
  }
}
