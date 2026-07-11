const fs = require('fs');

const content = fs.readFileSync('src/app/dashboard/settings/page.tsx', 'utf-8');

// Strip JSX roughly to find the mismatched paren
let parens = [];
const lines = content.split('\n');

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  for (let j = 0; j < line.length; j++) {
    if (line[j] === '(') parens.push(`Line ${i + 1}`);
    if (line[j] === ')') parens.pop();
  }
}

console.log("Unclosed parens at: ", parens);
