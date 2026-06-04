import fs from 'fs';
import path from 'path';

function walkDir(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    let dirPath = path.join(dir, f);
    let isDirectory = fs.statSync(dirPath).isDirectory();
    isDirectory ? walkDir(dirPath, callback) : callback(path.join(dir, f));
  });
}

walkDir('./src', (filePath) => {
  if (filePath.endsWith('.tsx') || filePath.endsWith('.ts')) {
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Only modify files that use getCol but don't import it (except demoMode.ts itself)
    if (content.includes('getCol') && !content.includes('import { getCol }') && !filePath.includes('demoMode.ts') && !filePath.includes('route.ts')) {
      const lines = content.split('\n');
      let lastImportIndex = 0;
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].startsWith('import ')) {
          lastImportIndex = i;
        }
      }
      lines.splice(lastImportIndex + 1, 0, "import { getCol } from '@/lib/demoMode';");
      fs.writeFileSync(filePath, lines.join('\n'), 'utf8');
      console.log('Added missing import to', filePath);
    }
  }
});
