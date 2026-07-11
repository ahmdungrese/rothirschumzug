const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src', 'app', 'dashboard', 'page.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// Replace Text Colors
content = content.replace(/text-white\/90/g, 'text-text-main/90');
content = content.replace(/text-white\/80/g, 'text-text-main/80');
content = content.replace(/text-white\/70/g, 'text-text-muted');
content = content.replace(/text-white\/60/g, 'text-text-muted/80');
content = content.replace(/text-white\/50/g, 'text-text-muted/70');
content = content.replace(/text-white\/40/g, 'text-text-muted/60');
content = content.replace(/text-white\/30/g, 'text-text-muted/50');
content = content.replace(/text-white/g, 'text-text-main');

// Replace Border Colors
content = content.replace(/border-white\/\d+/g, 'border-structure');
content = content.replace(/border-white\/\[[0-9.]+\]/g, 'border-structure');
content = content.replace(/border-black\/\d+/g, 'border-structure');
content = content.replace(/border-black\/\[[0-9.]+\]/g, 'border-structure');

// Replace Backgrounds
// Kanban card backgrounds
content = content.replace(/bg-\[#161722\]\/85/g, 'bg-bg-panel');
content = content.replace(/bg-\[#171821\]\/80/g, 'bg-bg-panel');
content = content.replace(/bg-\[#1a1c24\]\/80/g, 'bg-bg-panel');
// Kanban col backgrounds
content = content.replace(/bg-\[#161722\]\/55/g, 'bg-structure/50');
// Dashboard widgets backgrounds
content = content.replace(/bg-\[#1a1c24\]\/50/g, 'bg-bg-panel');

// Semi-transparent black/white backgrounds that break light mode
content = content.replace(/bg-white\/5/g, 'bg-structure/30');
content = content.replace(/bg-white\/10/g, 'bg-structure/50');
content = content.replace(/bg-white\/20/g, 'bg-structure/80');
content = content.replace(/bg-white\/\[[0-9.]+\]/g, 'bg-structure/30');

content = content.replace(/bg-black\/5/g, 'bg-structure/30');
content = content.replace(/bg-black\/10/g, 'bg-structure/50');
content = content.replace(/bg-black\/20/g, 'bg-structure/60');
content = content.replace(/bg-black\/25/g, 'bg-structure/70');
content = content.replace(/bg-black\/30/g, 'bg-structure/80');
content = content.replace(/bg-black\/40/g, 'bg-structure');

// Fix primary button text that might have been changed
content = content.replace(/text-text-main bg-gradient-to-r/g, 'text-text-main bg-gradient-to-r'); // Header h1
content = content.replace(/text-text-main text-\[10px\] font-black w-5 h-5 rounded-full/g, 'text-white text-[10px] font-black w-5 h-5 rounded-full'); // Notification badge on buttons

// Special case: text-white in badge 'Alle Aufgaben'
content = content.replace(/text-text-main shadow-lg shadow-primary\/20/g, 'text-white shadow-lg shadow-primary/20');
// And primary text in buttons
content = content.replace(/bg-primary text-text-main/g, 'bg-primary text-white');
content = content.replace(/hover:text-text-main hover:bg-primary/g, 'hover:text-white hover:bg-primary');

fs.writeFileSync(filePath, content, 'utf8');
console.log('Done!');
