const fs = require('fs');
const code = fs.readFileSync('src/components/broadcast/ModActionsPopup.tsx', 'utf8');
const lines = code.split('\n');
for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  const openParens = (line.match(/\(/g) || []).length;
  const closeParens = (line.match(/\)/g) || []).length;
  const openBraces = (line.match(/{/g) || []).length;
  const closeBraces = (line.match(/}/g) || []).length;
  const openBrackets = (line.match(/\[/g) || []).length;
  const closeBrackets = (line.match(/\]/g) || []).length;
  
  if (openParens !== closeParens || openBraces !== closeBraces || openBrackets !== closeBrackets) {
    console.log('Line ' + (i+1) + ': parens=' + openParens + '/' + closeParens + ' braces=' + openBraces + '/' + closeBraces + ' brackets=' + openBrackets + '/' + closeBrackets + ' -> ' + line.substring(0, 60));
  }
}
