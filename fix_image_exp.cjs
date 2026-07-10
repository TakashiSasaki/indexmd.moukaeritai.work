const fs = require('fs');
let text = fs.readFileSync('src/components/ImageExperiment.tsx', 'utf8');
text = text.replace(/const rev = meta\.sourceRevision \|\| '';/g, "const rev = String(meta.jobRevision || 0);");
text = text.replace(/existing\.sourceRevision === rev/g, "String(existing.jobRevision) === rev");
fs.writeFileSync('src/components/ImageExperiment.tsx', text);
