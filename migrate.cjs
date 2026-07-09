const fs = require('fs');
const path = require('path');
const dir = 'src/lib/__fixtures__/summary-schema';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.txt'));
for (const file of files) {
  const content = fs.readFileSync(path.join(dir, file), 'utf8');
  const escaped = content.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$/g, '\\$');
  fs.writeFileSync(path.join(dir, file.replace('.txt', '.ts')), 'export default `' + escaped + '`;\n');
  fs.unlinkSync(path.join(dir, file));
}
