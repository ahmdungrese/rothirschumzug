const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src', 'app', 'dashboard', 'page.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// Fix H1 gradient which forces white text
content = content.replace(/text-text-main bg-gradient-to-r from-white via-white\/90 to-white\/50 bg-clip-text text-transparent/g, 'text-text-main');
content = content.replace(/text-white bg-gradient-to-r from-white via-white\/90 to-white\/50 bg-clip-text text-transparent/g, 'text-text-main');

// Fix Pill Buttons hardcoded dark mode colors
content = content.replace(/bg-\[#171821\]\/50/g, 'bg-structure/30');
content = content.replace(/hover:bg-\[#1c1d29\]/g, 'hover:bg-structure/50');
content = content.replace(/bg-\[#161722\]\/55/g, 'bg-structure/30');

// Fix any remaining text-white outside of buttons/badges
content = content.replace(/text-white\/([0-9]+|\[[0-9.]+\])/g, 'text-text-muted');
content = content.replace(/text-white/g, 'text-text-main');

// Restore white text for primary buttons and badges where contrast requires it
content = content.replace(/bg-primary border-primary-hover text-text-main/g, 'bg-primary border-primary-hover text-white');
content = content.replace(/bg-primary text-text-main/g, 'bg-primary text-white');
content = content.replace(/bg-red-500 text-text-main/g, 'bg-red-500 text-white');

// Ensure Desktop Table has a clean background
content = content.replace(/bg-structure\/30 text-\[10px\]/g, 'bg-structure/30 text-[10px]');
// The table was somehow getting a huge dark grey block. Let's make sure the table container has no weird background.
content = content.replace(/<table className="w-full text-left border-collapse">/g, '<table className="w-full text-left border-collapse bg-bg-dark rounded-xl overflow-hidden">');

fs.writeFileSync(filePath, content, 'utf8');
console.log('Fixed additional hardcoded classes!');
