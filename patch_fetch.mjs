const fs = await import('fs');
let content = fs.readFileSync('src/components/ImageExperiment.tsx', 'utf-8');
content = content.replace(
  "const bRes = await fetch(`/api/visual/batch-jobs/${targetJobId}/reports/analysis-bundle`);\n               if (bRes.ok) {\n                 const bundle = await bRes.json();\n                 saveLocalJobBackup(data.job, bundle);\n                 reloadLocalBackups();\n               }",
  "const validated = await fetchAndValidateAnalysisBundle(targetJobId);\n               saveLocalJobBackup(data.job, validated.bundle);\n               reloadLocalBackups();"
);
fs.writeFileSync('src/components/ImageExperiment.tsx', content);
