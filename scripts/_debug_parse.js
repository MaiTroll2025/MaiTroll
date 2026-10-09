// Direct TypeScript parser test
const ts = require('typescript');
const fs = require('fs');
const _path = require('path');

const filePath = 'src/components/broadcast/StagePassRequestsPanel.tsx';
const c = fs.readFileSync(filePath, 'utf8');
const lines = c.split('\n');

console.log(`File length: ${c.length} chars, ${lines.length} lines`);
for (let i = 21; i <= 32; i++) {
  const byteOfs = lines.slice(0, i).join('\n').length;
  console.log(`Line ${i+1} [byte ${byteOfs}]: ${JSON.stringify(lines[i])}`);
}

// Try to create a source file
try {
  const sf = ts.createSourceFile(filePath, c, ts.ScriptTarget.ESNext, true, ts.ScriptKind.TSX);
  
  // Walk AST
  let foundProblem = false;
  ts.forEachChild(sf, (node) => {
    if (!foundProblem && node.kind === ts.SyntaxKind.VariableStatement) {
      const child = node.getFirstToken();
      console.log('\nVariableStatement found, first token:', ts.SyntaxKind[child.kind], JSON.stringify(child.getText(sf)));
    }
    if (!foundProblem && node.kind === ts.SyntaxKind.ExportAssignment) {
      console.log('\nExportAssignment at line', node.getStart(sf));
    }
    // Find return statement
    if (!foundProblem) ts.forEachChild(node, (n) => {
      if (!foundProblem && n.kind === ts.SyntaxKind.ReturnStatement) {
        const retText = n.getText(sf).substring(0, 150);
        console.log('\nReturnStatement:', retText);
      }
    });
  });
  
  console.log('\nParse result: OK (no error thrown)');
} catch(e) {
  console.log('\nParse error:', e.message);
  if (e.line) console.log(`  at line ${e.line} col ${e.column}`);
}
