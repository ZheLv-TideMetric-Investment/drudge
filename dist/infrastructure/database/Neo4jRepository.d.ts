import { Session, QueryResult } from 'neo4j-driver';
import { HealthCheckResult, DatabaseStats, Neo4jQuery, Neo4jQueryParams } from '../../shared/types/common';
/**
 * Neo4j 数据库连接服务
 * 提供数据库连接管理和基础操作
 */
declare class Neo4jService {
    private driver;
    connect(): Promise<boolean>;
    private createIndexes;
    getSession(): Session;
    executeQuery(cypher: string, parameters?: Neo4jQueryParams): Promise<QueryResult>;
    executeTransaction<T>(transactionFunction: (tx: any) => Promise<T>): Promise<T>;
    executeBatch(queries: Neo4jQuery[]): Promise<QueryResult[]>;
    healthCheck(): Promise<HealthCheckResult>;
    getStats(): Promise<DatabaseStats>;
    clearDatabase(): Promise<boolean>;
    close(): Promise<void>;
    isConnected(): boolean;
}
declare const _default: Neo4jService;
export default _default;
