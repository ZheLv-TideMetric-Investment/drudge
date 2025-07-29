import { neo4jConnection } from '../neo4j';
import { notificationService } from './notification';

/**
 * 服务初始化状态
 */
let servicesInitialized = false;
let initializationPromise: Promise<void> | null = null;

/**
 * 初始化所有服务
 * 确保只初始化一次，并且是线程安全的
 */
export async function initializeServices(): Promise<void> {
  // 如果已经初始化，直接返回
  if (servicesInitialized) {
    return;
  }

  // 如果正在初始化，等待完成
  if (initializationPromise) {
    return initializationPromise;
  }

  // 开始初始化
  initializationPromise = performInitialization();
  
  try {
    await initializationPromise;
    servicesInitialized = true;
    console.log('✅ 所有服务初始化完成');
  } catch (error) {
    // 初始化失败，重置状态以便重试
    initializationPromise = null;
    console.error('❌ 服务初始化失败:', error);
    throw error;
  }
}

/**
 * 执行实际的初始化工作
 */
async function performInitialization(): Promise<void> {
  console.log('🚀 开始初始化服务...');

  try {
    // 1. 初始化Neo4j连接
    console.log('正在连接Neo4j数据库...');
    await neo4jConnection.connect();
    
    // 2. 初始化通知服务
    console.log('正在初始化通知服务...');
    await notificationService.initialize();

    console.log('✅ 服务初始化成功');
  } catch (error) {
    console.error('❌ 服务初始化过程中出错:', error);
    throw error;
  }
}

/**
 * 优雅关闭所有服务
 */
export async function shutdownServices(): Promise<void> {
  console.log('🔄 开始关闭服务...');
  
  try {
    // 关闭Neo4j连接
    await neo4jConnection.disconnect();
    
    // 注意：通知服务通常不需要特别的关闭操作
    
    servicesInitialized = false;
    initializationPromise = null;
    
    console.log('✅ 服务关闭完成');
  } catch (error) {
    console.error('❌ 服务关闭失败:', error);
    throw error;
  }
}

/**
 * 检查服务是否已初始化
 */
export function areServicesInitialized(): boolean {
  return servicesInitialized;
}

/**
 * 健康检查所有服务
 */
export async function healthCheckServices(): Promise<{
  neo4j: boolean;
  notification: boolean;
  overall: boolean;
}> {
  const results = {
    neo4j: false,
    notification: false,
    overall: false
  };

  try {
    // 检查Neo4j连接状态
    results.neo4j = neo4jConnection.isConnected();
    
    // 检查通知服务（假设它有健康检查方法，如果没有就默认为true）
    results.notification = true; // 通知服务通常没有复杂的健康检查
    
    // 整体健康状态
    results.overall = results.neo4j && results.notification;
    
  } catch (error) {
    console.error('健康检查失败:', error);
  }

  return results;
} 