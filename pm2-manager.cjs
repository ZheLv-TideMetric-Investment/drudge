#!/usr/bin/env node

/**
 * PM2 管理脚本 - 用于管理所有子应用
 * 
 * 使用方法:
 * node pm2-manager.js start [app-name]     # 启动应用
 * node pm2-manager.js stop [app-name]      # 停止应用
 * node pm2-manager.js restart [app-name]   # 重启应用
 * node pm2-manager.js delete [app-name]    # 删除应用
 * node pm2-manager.js status               # 查看状态
 * node pm2-manager.js logs [app-name]      # 查看日志
 * node pm2-manager.js dev [app-name]       # 开发模式启动
 */

const { execSync } = require('child_process');
const path = require('path');

const apps = {
  'web-app': {
    path: './packages/web-app',
    name: 'web-app'
  },
  'ingest-worker': {
    path: './packages/ingest-worker',
    name: 'ingest-worker'
  },
  'graph-worker': {
    path: './packages/graph-worker',
    name: 'graph-worker'
  }
};

const commands = {
  start: (appName) => {
    if (appName && apps[appName]) {
      console.log(`🚀 启动 ${appName}...`);
      execSync(`cd ${apps[appName].path} && pnpm run pm2:start`, { stdio: 'inherit' });
    } else {
      console.log('🚀 启动所有应用...');
      Object.keys(apps).forEach(app => {
        try {
          execSync(`cd ${apps[app].path} && pnpm run pm2:start`, { stdio: 'inherit' });
          console.log(`✅ ${app} 启动成功`);
        } catch (error) {
          console.error(`❌ ${app} 启动失败:`, error.message);
        }
      });
    }
  },

  stop: (appName) => {
    if (appName && apps[appName]) {
      console.log(`🛑 停止 ${appName}...`);
      execSync(`cd ${apps[appName].path} && pnpm run pm2:stop`, { stdio: 'inherit' });
    } else {
      console.log('🛑 停止所有应用...');
      Object.keys(apps).forEach(app => {
        try {
          execSync(`cd ${apps[app].path} && pnpm run pm2:stop`, { stdio: 'inherit' });
          console.log(`✅ ${app} 停止成功`);
        } catch (error) {
          console.error(`❌ ${app} 停止失败:`, error.message);
        }
      });
    }
  },

  restart: (appName) => {
    if (appName && apps[appName]) {
      console.log(`🔄 重启 ${appName}...`);
      execSync(`cd ${apps[appName].path} && pnpm run pm2:restart`, { stdio: 'inherit' });
    } else {
      console.log('🔄 重启所有应用...');
      Object.keys(apps).forEach(app => {
        try {
          execSync(`cd ${apps[app].path} && pnpm run pm2:restart`, { stdio: 'inherit' });
          console.log(`✅ ${app} 重启成功`);
        } catch (error) {
          console.error(`❌ ${app} 重启失败:`, error.message);
        }
      });
    }
  },

  delete: (appName) => {
    if (appName && apps[appName]) {
      console.log(`🗑️  删除 ${appName}...`);
      execSync(`cd ${apps[appName].path} && pnpm run pm2:delete`, { stdio: 'inherit' });
    } else {
      console.log('🗑️  删除所有应用...');
      Object.keys(apps).forEach(app => {
        try {
          execSync(`cd ${apps[app].path} && pnpm run pm2:delete`, { stdio: 'inherit' });
          console.log(`✅ ${app} 删除成功`);
        } catch (error) {
          console.error(`❌ ${app} 删除失败:`, error.message);
        }
      });
    }
  },

  status: () => {
    console.log('📊 查看所有应用状态...');
    execSync('pm2 status', { stdio: 'inherit' });
  },

  logs: (appName) => {
    if (appName && apps[appName]) {
      console.log(`📜 查看 ${appName} 日志...`);
      execSync(`cd ${apps[appName].path} && pnpm run pm2:logs`, { stdio: 'inherit' });
    } else {
      console.log('📜 查看所有应用日志...');
      execSync('pm2 logs', { stdio: 'inherit' });
    }
  }
};

// 帮助信息
function showHelp() {
  console.log(`
 🚀 PM2 管理脚本 - Drudge项目

 用法:
   node pm2-manager.cjs <command> [app-name]

命令:
  start [app-name]     启动应用 (不指定则启动所有)
  stop [app-name]      停止应用 (不指定则停止所有)
  restart [app-name]   重启应用 (不指定则重启所有)
  delete [app-name]    删除应用 (不指定则删除所有)
  status               查看所有应用状态
  logs [app-name]      查看应用日志 (不指定则查看所有)

应用名称:
  web-app              Web应用
  ingest-worker        数据获取服务
  graph-worker         知识图谱服务

 示例:
   node pm2-manager.cjs start web-app        # 启动Web应用
   node pm2-manager.cjs restart ingest-worker # 重启数据获取服务
   node pm2-manager.cjs status               # 查看所有应用状态
   node pm2-manager.cjs logs graph-worker    # 查看知识图谱服务日志
`);
}

// 主函数
function main() {
  const [,, command, appName] = process.argv;

  if (!command || command === 'help' || command === '--help') {
    showHelp();
    return;
  }

  if (commands[command]) {
    try {
      commands[command](appName);
    } catch (error) {
      console.error(`❌ 执行命令失败:`, error.message);
      process.exit(1);
    }
  } else {
    console.error(`❌ 未知命令: ${command}`);
    showHelp();
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { apps, commands }; 