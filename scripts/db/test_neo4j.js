#!/usr/bin/env node

import neo4j from 'neo4j-driver';
import dotenv from 'dotenv';

// 加载环境变量
dotenv.config();

const NEO4J_URI = process.env.NEO4J_URI || 'bolt://localhost:7687';
const NEO4J_USER = process.env.NEO4J_USER || 'neo4j';
const NEO4J_PASSWORD = process.env.NEO4J_PASSWORD || 'neo4j';

console.log('🔧 Neo4j 连接测试');
console.log(`URI: ${NEO4J_URI}`);
console.log(`用户: ${NEO4J_USER}`);

async function testNeo4j() {
  let driver;
  
  try {
    // 创建驱动
    driver = neo4j.driver(
      NEO4J_URI,
      neo4j.auth.basic(NEO4J_USER, NEO4J_PASSWORD)
    );

    // 验证连接
    console.log('⏳ 验证连接...');
    await driver.verifyConnectivity();
    console.log('✅ 连接成功');

    // 获取会话
    const session = driver.session();

    try {
      // 测试基础查询
      console.log('⏳ 测试基础查询...');
      const result = await session.run('RETURN 1 as test');
      console.log('✅ 基础查询成功');

      // 测试统计查询
      console.log('⏳ 测试统计查询...');
      const nodeCount = await session.run('MATCH (n) RETURN count(n) as count');
      const relCount = await session.run('MATCH ()-[r]->() RETURN count(r) as count');
      
      console.log(`📊 节点数量: ${nodeCount.records[0].get('count').toNumber()}`);
      console.log(`📊 关系数量: ${relCount.records[0].get('count').toNumber()}`);

      // 测试 APOC
      console.log('⏳ 测试 APOC 插件...');
      try {
        const apocResult = await session.run('CALL apoc.help("meta") YIELD name RETURN count(name) as count');
        console.log('✅ APOC 插件可用');
        console.log(`📦 APOC meta 函数数量: ${apocResult.records[0].get('count').toNumber()}`);
      } catch (apocError) {
        console.log('❌ APOC 插件不可用:', apocError.message);
      }

    } finally {
      await session.close();
    }

    console.log('🎉 所有测试完成');

  } catch (error) {
    console.error('❌ 测试失败:', error.message);
    process.exit(1);
  } finally {
    if (driver) {
      await driver.close();
    }
  }
}

testNeo4j(); 