const fs = require('fs');
const path = require('path');

function walkDir(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    let dirPath = path.join(dir, f);
    let isDirectory = fs.statSync(dirPath).isDirectory();
    isDirectory ? walkDir(dirPath, callback) : callback(dirPath);
  });
}

function processFile(filePath) {
  if (!filePath.endsWith('.tsx') && !filePath.endsWith('.ts')) return;
  
  let content = fs.readFileSync(filePath, 'utf8');
  let lines = content.split('\n');
  let changed = false;

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];
    
    if (line.includes('hover:text-white')) {
      // Check if line also has solid hover background colors that require white text
      if (
        line.includes('hover:bg-red-500 ') ||
        line.includes('hover:bg-blue-500 ') ||
        line.includes('hover:bg-green-500 ') ||
        line.includes('hover:bg-primary ') ||
        line.includes('hover:bg-orange-500')
      ) {
        // Leave it
        continue;
      } else {
        // Replace it
        lines[i] = line.replace(/hover:text-white/g, 'hover:text-text-main');
        changed = true;
      }
    }
  }

  if (changed) {
    fs.writeFileSync(filePath, lines.join('\n'), 'utf8');
    console.log('Updated:', filePath);
  }
}

walkDir(path.join(__dirname, 'src'), processFile);
console.log('Hover text replacement complete.');
