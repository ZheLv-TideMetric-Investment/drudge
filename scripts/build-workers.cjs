const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function compileWorkers() {
  console.log('🔧 编译Worker文件用于开发...');
  
  try {
    // 确保输出目录存在
    ensureDir('./dist/workers');
    ensureDir('./dist/shared/utils');
    ensureDir('./dist/shared/config');
    ensureDir('./dist/shared/types');
    ensureDir('./dist/infrastructure/external');
    ensureDir('./dist/infrastructure/storage');
    ensureDir('./dist/infrastructure/database');
    ensureDir('./dist/application/services');
    ensureDir('./dist/domain/services');
    ensureDir('./dist/domain/entities');
    
    // 只编译Worker及其依赖的文件
    const filesToCompile = [
      'src/infrastructure/workers/schedulerWorker.ts',
      'src/infrastructure/workers/newsProcessorWorker.ts',
      'src/infrastructure/workers/processors/NewsProcessor.ts',
      'src/infrastructure/workers/processors/FileWatcher.ts',
      'src/infrastructure/workers/handlers/MessageHandler.ts',
      'src/shared/utils/logger.ts',
      'src/shared/utils/llm.ts',
      'src/shared/config/config.ts',
      'src/shared/types/common.ts',
      'src/shared/types/enums.ts',
      'src/infrastructure/external/NewsApiService.ts',
      'src/infrastructure/external/WebhookService.ts',
      'src/infrastructure/external/AiService.ts',
      'src/infrastructure/storage/FileStorage.ts',
      'src/infrastructure/database/Neo4jRepository.ts',
      'src/infrastructure/database/GraphRepository.ts',
      'src/application/services/KnowledgeGraphServiceV2.ts',
      'src/application/services/NewsProcessingServiceV2.ts',
      'src/application/services/business/QueryService.ts',
      'src/application/services/business/NotificationService.ts',
      'src/application/services/processing/entityExtractionService.ts',
      'src/domain/entities/Event.ts',
      'src/domain/entities/Company.ts',
      'src/domain/entities/Person.ts',
      'src/domain/entities/Location.ts',
      'src/domain/entities/Time.ts',
      'src/domain/entities/NewsExtractionResult.ts',
      'src/domain/entities/index.ts'
    ];
    
        // 编译指定文件
    const cmd = `npx tsc ${filesToCompile.join(' ')} --outDir ./dist --module ESNext --target ES2022 --moduleResolution bundler --esModuleInterop --skipLibCheck --resolveJsonModule --declaration false`;
    execSync(cmd, { stdio: 'pipe' });
    
    // 修复导入扩展名（优化版）
    execSync('node scripts/fix-imports.cjs', { stdio: 'pipe' });
      
    console.log('✅ Worker文件编译完成');
  } catch (error) {
    console.error('❌ Worker编译失败:', error.message);
    process.exit(1);
  }
}

compileWorkers(); 