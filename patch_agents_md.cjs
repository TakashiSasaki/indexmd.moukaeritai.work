const fs = require('fs');
const path = 'AGENTS.md';

let content = fs.readFileSync(path, 'utf8');

content = content.replace(
  `- For repository health maintenance, see \`skills/repository-health-maintenance/SKILL.md\` and the canonical instructions in \`docs/maintenance/repository-health.md\`.`,
  `- For repository health maintenance, see \`skills/repository-health-maintenance/SKILL.md\` and the canonical instructions in \`docs/maintenance/repository-health.md\`.
- For stride verification and preventing false-green CI, see \`skills/stride-verification/SKILL.md\`.`
);

fs.writeFileSync(path, content);
