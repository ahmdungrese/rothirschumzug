const fs = require('fs');

const lines = fs.readFileSync('src/app/dashboard/settings/page.tsx', 'utf-8').split('\n');
let openParens = 0;
let openBraces = 0;

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  // Simple heuristic: ignore comments, strings (will be messy, but let's try)
  // Actually, just simple count
  for (let j = 0; j < line.length; j++) {
    if (line[j] === '(') openParens++;
    if (line[j] === ')') openParens--;
    if (line[j] === '{') openBraces++;
    if (line[j] === '}') openBraces--;
  }
  
  if (i % 100 === 0) {
    console.log(`Line ${i}: Parens=${openParens}, Braces=${openBraces}`);
  }
}
console.log(`End: Parens=${openParens}, Braces=${openBraces}`);
