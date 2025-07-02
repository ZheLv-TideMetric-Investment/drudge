/**
 * 文件存储服务
 * 负责处理本地文件的读写操作
 */
declare class FileStorage {
    constructor();
    /**
     * 确保存储目录存在
     */
    ensureStorageDirectory(): void;
    /**
     * 保存数据到文件
     */
    saveData(filename: string, data: any): Promise<void>;
    /**
     * 从文件读取数据
     */
    loadData(filename: string): Promise<any>;
    /**
     * 检查文件是否存在
     */
    fileExists(filename: string): boolean;
    /**
     * 删除文件
     */
    deleteFile(filename: string): Promise<void>;
    /**
     * 获取文件列表
     */
    getFileList(pattern?: string): Promise<string[]>;
    /**
     * 获取文件信息
     */
    getFileInfo(filename: string): Promise<any>;
    /**
     * 清理旧文件
     */
    cleanupOldFiles(maxAge?: number): Promise<number>;
    /**
     * 获取所有文件的数据
     */
    getAll(pattern?: string): Promise<any[]>;
    /**
     * 获取最新的一条数据
     */
    getLatest(): Promise<any>;
    /**
     * 保存数据（支持数组和单个对象）
     */
    save(data: any): Promise<void>;
    /**
     * 按时间范围获取数据
     */
    getByTimeRange(startTime: any, endTime: any): Promise<any[]>;
    /**
     * 获取存储路径
     */
    getStoragePath(): string;
}
declare const _default: FileStorage;
export default _default;
