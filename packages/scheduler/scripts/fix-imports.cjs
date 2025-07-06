const fs = require('fs');
const path = require('path');

function fixImports(dir) {
  const files = fs.readdirSync(dir);
  
  files.forEach(file => {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    
    if (stat.isDirectory()) {
      fixImports(fullPath);
    } else if (file.endsWith('.js')) {
      let content = fs.readFileSync(fullPath, 'utf8');
      
      // 修复相对路径导入
      content = content.replace(/from\s+['"](\.[^'"]+)['"];/g, (match, importPath) => {
        if (!importPath.endsWith('.js')) {
          return match.replace(importPath, importPath + '.js');
        }
        return match;
      });
      
      // 修复动态导入
      content = content.replace(/import\s*\(\s*['"]([^'"]+)['"]\s*\)/g, (match, importPath) => {
        if (importPath.startsWith('./') || importPath.startsWith('../')) {
          if (!importPath.endsWith('.js')) {
            return match.replace(importPath, importPath + '.js');
          }
        }
        return match;
      });
      
      fs.writeFileSync(fullPath, content, 'utf8');
    }
  });
}

// 只修复dist目录下的文件
if (fs.existsSync('./dist')) {
  fixImports('./dist');
  console.log('✅ 导入路径已修复');
} else {
  console.log('⚠️ dist目录不存在，跳过修复');
} 