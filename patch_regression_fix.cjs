const fs = require('fs');

const path = 'src/components/DriveDashboard.tsx';
let content = fs.readFileSync(path, 'utf8');

content = content.replace(
  `// ... [Waiting for the function implementation to show up]`,
  `// ...`
);

fs.writeFileSync(path, content);
