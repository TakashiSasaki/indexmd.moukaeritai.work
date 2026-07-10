#!/bin/bash
sed -i 's/const bRes = await fetch(\/api\/visual\/batch-jobs\/${targetJobId}\/reports\/analysis-bundle`);/const validated = await fetchAndValidateAnalysisBundle(targetJobId);\n               if (validated.bundle) {\n                 saveLocalJobBackup(data.job, validated.bundle);\n                 reloadLocalBackups();\n               }/g' src/components/ImageExperiment.tsx
