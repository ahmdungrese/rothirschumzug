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
  let originalContent = content;

  // Split into lines to evaluate safely
  let lines = content.split('\n');
  let changed = false;

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];
    
    // Check if line has 'text-white'
    if (line.includes('text-white')) {
      // Check if line also has background colors that require white text
      if (
        line.includes('bg-primary') ||
        line.includes('bg-blue-') ||
        line.includes('bg-green-') ||
        line.includes('bg-red-') ||
        line.includes('bg-orange-') ||
        line.includes('bg-black') ||
        line.includes('bg-gray-800') ||
        line.includes('bg-gray-900') ||
        line.includes('bg-zinc-800') ||
        line.includes('bg-zinc-900') ||
        line.includes('bg-rose-500') ||
        line.includes('bg-indigo-500') ||
        line.includes('bg-purple-500') ||
        line.includes('text-white hover:bg-') // special cases where we want text-white
      ) {
        // Leave it as text-white
        continue;
      } else {
        // Replace it
        lines[i] = line.replace(/text-white/g, 'text-text-main');
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
console.log('Replacement complete.');
