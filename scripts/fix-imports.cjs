const fs = require('fs');
const path = require('path');

/**
 * 优化版导入修复脚本
 * 专门为ESM模块添加.js扩展名
 */
function fixImports(dir) {
  const files = fs.readdirSync(dir);
  
  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory()) {
      fixImports(filePath); // 递归处理目录
    } else if (file.endsWith('.js')) {
      let content = fs.readFileSync(filePath, 'utf8');
      
      // 修复相对导入路径，添加.js扩展名
      content = content.replace(
        /from\s+['"](\.\S*?)(?<!\.js)['"];?/g,
        "from '$1.js';"
      );
      content = content.replace(
        /import\s+['"](\.\S*?)(?<!\.js)['"];?/g,
        "import '$1.js';"
      );
      
      fs.writeFileSync(filePath, content);
    }
  }
}

// 只修复dist目录下的文件
if (fs.existsSync('./dist')) {
  fixImports('./dist');
  console.log('✅ 导入路径已修复');
} else {
  console.log('⚠️ dist目录不存在，跳过修复');
} 