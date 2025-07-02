const { spawn, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

let tsxProcess = null;

function buildWorkers() {
  console.log('🔧 编译Worker文件...');
  try {
    execSync('node scripts/build-workers.cjs', { stdio: 'inherit' });
    return true;
  } catch (error) {
    console.error('❌ Worker编译失败');
    return false;
  }
}

function startApp() {
  if (tsxProcess) {
    console.log('🔄 重启应用...');
    tsxProcess.kill();
  }
  
  console.log('🚀 启动TypeScript应用...');
  tsxProcess = spawn('npx', ['tsx', 'src/index.ts'], {
    stdio: 'inherit',
    env: { ...process.env, NODE_ENV: 'development' }
  });
  
  tsxProcess.on('exit', (code) => {
    if (code !== 0 && code !== null) {
      console.log(`应用退出，代码: ${code}`);
    }
  });
}

function watchWorkerFiles() {
  const workerFiles = [
    'src/workers/',
    'src/shared/',
    'src/infrastructure/',
    'src/application/services/',
    'src/domain/services/'
  ];
  
  console.log('👀 监控Worker相关文件变化...');
  
  for (const dir of workerFiles) {
    if (fs.existsSync(dir)) {
      fs.watch(dir, { recursive: true }, (eventType, filename) => {
        if (filename && filename.endsWith('.ts')) {
          console.log(`📝 检测到文件变化: ${filename}`);
          if (buildWorkers()) {
            startApp();
          }
        }
      });
    }
  }
}

function cleanup() {
  console.log('\n🛑 正在关闭开发服务器...');
  if (tsxProcess) {
    tsxProcess.kill();
  }
  process.exit(0);
}

// 监听退出信号
process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);

// 主流程
async function main() {
  console.log('🎯 启动TypeScript开发服务器');
  console.log('===============================');
  
  // 初始编译Worker文件
  if (!buildWorkers()) {
    process.exit(1);
  }
  
  // 启动应用
  startApp();
  
  // 开始监控文件变化
  watchWorkerFiles();
  
  console.log('✅ 开发服务器已启动');
  console.log('📁 主程序: tsx直接运行TypeScript');
  console.log('⚡ Worker: 预编译JavaScript');
  console.log('🔄 自动重载: 文件变化时自动重新编译');
  console.log('🛑 按 Ctrl+C 停止服务器\n');
}

main().catch(console.error); 