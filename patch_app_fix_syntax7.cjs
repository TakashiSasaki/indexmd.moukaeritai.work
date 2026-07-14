const fs = require('fs');
const path = 'src/app.ts';
let content = fs.readFileSync(path, 'utf8');

// I see: runnerRegistry: resolvedDependencies.runnerRegistry, resolvedDependencies.runnerRegistry,
content = content.replace(
  `runnerRegistry: resolvedDependencies.runnerRegistry, resolvedDependencies.runnerRegistry,`,
  `runnerRegistry: resolvedDependencies.runnerRegistry,`
);

fs.writeFileSync(path, content);
