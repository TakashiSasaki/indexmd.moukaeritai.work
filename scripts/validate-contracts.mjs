import fs from 'fs';
import path from 'path';
import Ajv from 'ajv';

const ajv = new Ajv({ allErrors: true, strict: false });

function walkDir(dir, filter) {
  let results = [];
  const list = fs.readdirSync(dir);
  for (const file of list) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat && stat.isDirectory()) {
      results = results.concat(walkDir(filePath, filter));
    } else if (filter(filePath)) {
      results.push(filePath);
    }
  }
  return results;
}

function runValidation() {
  console.log('=== Running Contracts Validation ===\n');

  const contractsDir = path.join(process.cwd(), 'contracts');
  if (!fs.existsSync(contractsDir)) {
    console.error('Error: contracts/ directory not found!');
    process.exit(1);
  }

  // 1. Check all JSON files are valid JSON
  console.log('Checking JSON validity...');
  const jsonFiles = walkDir(contractsDir, (p) => p.endsWith('.json'));
  for (const file of jsonFiles) {
    try {
      JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch (err) {
      console.error(`❌ Invalid JSON: ${file} - ${err.message}`);
      process.exit(1);
    }
  }
  console.log(`[OK] All ${jsonFiles.length} JSON files are syntactically valid.\n`);

  // 1.1. Validate contracts/MANIFEST.json
  console.log('Validating contracts/MANIFEST.json...');
  const manifestPath = path.join(contractsDir, 'MANIFEST.json');
  if (!fs.existsSync(manifestPath)) {
    console.error('❌ Error: contracts/MANIFEST.json not found!');
    process.exit(1);
  }

  let manifest;
  try {
    manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  } catch (err) {
    console.error(`❌ Error parsing contracts/MANIFEST.json: ${err.message}`);
    process.exit(1);
  }

  if (typeof manifest.manifestVersion !== 'string' || !manifest.manifestVersion) {
    console.error('❌ Error: MANIFEST.json "manifestVersion" must be a non-empty string.');
    process.exit(1);
  }

  if (manifest.project !== 'indexmd') {
    console.error(`❌ Error: MANIFEST.json "project" must be "indexmd". Got: ${manifest.project}`);
    process.exit(1);
  }

  if (!Array.isArray(manifest.contracts) || !Array.isArray(manifest.apiContracts) || !Array.isArray(manifest.vocabularies)) {
    console.error('❌ Error: MANIFEST.json "contracts", "apiContracts", and "vocabularies" must be arrays.');
    process.exit(1);
  }

  // Create lookup maps to check nested target exists in the manifest
  const knownContracts = new Map(); // id + '@' + version -> contract entry
  for (const c of manifest.contracts) {
    knownContracts.set(`${c.id}@${c.version}`, c);
  }

  // Helper to verify existence of files
  function assertFileExists(filePath, context) {
    const fullPath = path.join(process.cwd(), filePath);
    if (!fs.existsSync(fullPath)) {
      console.error(`❌ Manifest Error: File "${filePath}" referenced in ${context} does not exist.`);
      process.exit(1);
    }
  }

  // Validate standard contracts
  for (const c of manifest.contracts) {
    const ctx = `contracts[id=${c.id}, version=${c.version}]`;
    if (!c.id || !c.version || !c.status || !c.schema || !c.readme) {
      console.error(`❌ Manifest Error: Missing fields in contract entry: ${JSON.stringify(c)}`);
      process.exit(1);
    }
    assertFileExists(c.schema, `${ctx}.schema`);
    assertFileExists(c.readme, `${ctx}.readme`);

    // Verify schema metadata matching
    const schemaContent = JSON.parse(fs.readFileSync(path.join(process.cwd(), c.schema), 'utf8'));
    if (schemaContent['x-contract-id'] !== c.id) {
      console.error(`❌ Manifest/Schema mismatch: x-contract-id "${schemaContent['x-contract-id']}" in file "${c.schema}" does not match manifest id "${c.id}"`);
      process.exit(1);
    }
    if (schemaContent['x-contract-version'] !== c.version) {
      console.error(`❌ Manifest/Schema mismatch: x-contract-version "${schemaContent['x-contract-version']}" in file "${c.schema}" does not match manifest version "${c.version}"`);
      process.exit(1);
    }
    if (schemaContent['x-contract-status'] !== c.status) {
      console.error(`❌ Manifest/Schema mismatch: x-contract-status "${schemaContent['x-contract-status']}" in file "${c.schema}" does not match manifest status "${c.status}"`);
      process.exit(1);
    }

    if (Array.isArray(c.examples)) {
      for (const ex of c.examples) {
        assertFileExists(ex, `${ctx}.examples`);
      }
    }

    if (Array.isArray(c.nestedContracts)) {
      for (const nest of c.nestedContracts) {
        if (!nest.field || !nest.contractId || !nest.version) {
          console.error(`❌ Manifest Error: Invalid nested contract structure in ${ctx}`);
          process.exit(1);
        }
        const key = `${nest.contractId}@${nest.version}`;
        if (!knownContracts.has(key)) {
          console.error(`❌ Manifest Error: nestedContract refers to unknown contract "${key}" in ${ctx}`);
          process.exit(1);
        }
      }
    }
  }

  // Validate API contracts
  for (const c of manifest.apiContracts) {
    const ctx = `apiContracts[id=${c.id}, version=${c.version}]`;
    if (!c.id || !c.version || !c.status || !c.schema || !c.readme) {
      console.error(`❌ Manifest Error: Missing fields in apiContract entry: ${JSON.stringify(c)}`);
      process.exit(1);
    }
    assertFileExists(c.schema, `${ctx}.schema`);
    assertFileExists(c.readme, `${ctx}.readme`);

    // Verify schema metadata matching
    const schemaContent = JSON.parse(fs.readFileSync(path.join(process.cwd(), c.schema), 'utf8'));
    if (schemaContent['x-contract-id'] !== c.id) {
      console.error(`❌ Manifest/Schema mismatch: x-contract-id "${schemaContent['x-contract-id']}" in file "${c.schema}" does not match manifest id "${c.id}"`);
      process.exit(1);
    }
    if (schemaContent['x-contract-version'] !== c.version) {
      console.error(`❌ Manifest/Schema mismatch: x-contract-version "${schemaContent['x-contract-version']}" in file "${c.schema}" does not match manifest version "${c.version}"`);
      process.exit(1);
    }
    if (schemaContent['x-contract-status'] !== c.status) {
      console.error(`❌ Manifest/Schema mismatch: x-contract-status "${schemaContent['x-contract-status']}" in file "${c.schema}" does not match manifest status "${c.status}"`);
      process.exit(1);
    }

    if (Array.isArray(c.examples)) {
      for (const ex of c.examples) {
        assertFileExists(ex, `${ctx}.examples`);
      }
    }

    if (Array.isArray(c.nestedContracts)) {
      for (const nest of c.nestedContracts) {
        if (!nest.field || !nest.contractId || !nest.version) {
          console.error(`❌ Manifest Error: Invalid nested contract structure in ${ctx}`);
          process.exit(1);
        }
        const key = `${nest.contractId}@${nest.version}`;
        if (!knownContracts.has(key)) {
          console.error(`❌ Manifest Error: nestedContract refers to unknown contract "${key}" in ${ctx}`);
          process.exit(1);
        }
      }
    }
  }

  // Validate vocabularies
  for (const v of manifest.vocabularies) {
    const ctx = `vocabularies[id=${v.id}]`;
    if (!v.id || !v.version || !v.path) {
      console.error(`❌ Manifest Error: Missing fields in vocabulary entry: ${JSON.stringify(v)}`);
      process.exit(1);
    }
    assertFileExists(v.path, `${ctx}.path`);

    // Verify vocabulary content matches
    const vocabContent = JSON.parse(fs.readFileSync(path.join(process.cwd(), v.path), 'utf8'));
    if (vocabContent.vocabularyId !== v.id) {
      console.error(`❌ Manifest/Vocabulary mismatch: vocabularyId "${vocabContent.vocabularyId}" in file "${v.path}" does not match manifest id "${v.id}"`);
      process.exit(1);
    }
    if (vocabContent.version !== v.version) {
      console.error(`❌ Manifest/Vocabulary mismatch: version "${vocabContent.version}" in file "${v.path}" does not match manifest version "${v.version}"`);
      process.exit(1);
    }
  }

  console.log('[OK] MANIFEST.json structure and references are completely valid.\n');

  // 2. Identify schemas and check metadata
  console.log('Checking Schema metadata structures...');
  const schemaFiles = walkDir(contractsDir, (p) => p.endsWith('schema.json'));
  
  const metadataProperties = ['x-contract-id', 'x-contract-version', 'x-contract-status'];
  
  for (const file of schemaFiles) {
    const relativePath = path.relative(process.cwd(), file);
    try {
      const content = JSON.parse(fs.readFileSync(file, 'utf8'));
      
      // Verify metadata properties are present
      for (const prop of metadataProperties) {
        if (!content[prop]) {
          console.error(`❌ Schema missing metadata property "${prop}": ${relativePath}`);
          process.exit(1);
        }
      }
      
      // Verify $id
      if (!content.$id || !content.$id.startsWith('https://indexmd.moukaeritai.work/contracts/')) {
        console.error(`❌ Schema missing or invalid "$id": ${relativePath} (Expected to start with https://indexmd.moukaeritai.work/contracts/)`);
        process.exit(1);
      }
      
      console.log(`[OK] Metadata valid: ${relativePath} (${content['x-contract-id']}@${content['x-contract-version']})`);
    } catch (err) {
      console.error(`❌ Failed to read schema metadata: ${relativePath} - ${err.message}`);
      process.exit(1);
    }
  }
  console.log('');

  // 3. Verify README.md existence in versioned folders
  console.log('Checking for README.md in versioned contract directories...');
  const schemasBaseDir = path.join(contractsDir, 'schemas');
  const schemaSubdirs = fs.readdirSync(schemasBaseDir);
  for (const subdir of schemaSubdirs) {
    const subdirPath = path.join(schemasBaseDir, subdir);
    if (!fs.statSync(subdirPath).isDirectory()) continue;
    
    const versions = fs.readdirSync(subdirPath);
    for (const ver of versions) {
      const verPath = path.join(subdirPath, ver);
      if (!fs.statSync(verPath).isDirectory()) continue;
      
      const readmePath = path.join(verPath, 'README.md');
      if (!fs.existsSync(readmePath)) {
        console.error(`❌ Missing README.md in contract version: contracts/schemas/${subdir}/${ver}`);
        process.exit(1);
      }
      console.log(`[OK] README.md exists for contracts/schemas/${subdir}/${ver}`);
    }
  }
  console.log('');

  // 3.1 Verify README.md existence in versioned API folders
  console.log('Checking for README.md in versioned API contract directories...');
  const apiBaseDir = path.join(contractsDir, 'api');
  if (fs.existsSync(apiBaseDir)) {
    const apiSubdirs = fs.readdirSync(apiBaseDir);
    for (const subdir of apiSubdirs) {
      const subdirPath = path.join(apiBaseDir, subdir);
      if (!fs.statSync(subdirPath).isDirectory()) continue;
      
      const readmePath = path.join(subdirPath, 'README.md');
      if (!fs.existsSync(readmePath)) {
        console.error(`❌ Missing README.md in API contract version: contracts/api/${subdir}`);
        process.exit(1);
      }
      console.log(`[OK] README.md exists for contracts/api/${subdir}`);
    }
  }
  console.log('');

  // 3.2 Verify vocabulary contracts
  console.log('Validating vocabulary contracts...');
  const vocabulariesDir = path.join(contractsDir, 'vocabularies');
  
  // Verify vocabularies/README.md exists
  const vocabReadmePath = path.join(vocabulariesDir, 'README.md');
  if (!fs.existsSync(vocabReadmePath)) {
    console.error(`❌ Missing README.md in vocabularies directory: contracts/vocabularies/README.md`);
    process.exit(1);
  }
  console.log(`[OK] README.md exists for contracts/vocabularies`);

  const vocabFiles = walkDir(vocabulariesDir, (p) => p.endsWith('.json'));
  for (const file of vocabFiles) {
    const relativePath = path.relative(process.cwd(), file);
    const content = JSON.parse(fs.readFileSync(file, 'utf8'));
    
    if (typeof content.vocabularyId !== 'string' || !content.vocabularyId) {
      console.error(`❌ Vocabulary file missing or invalid "vocabularyId": ${relativePath}`);
      process.exit(1);
    }
    
    if (typeof content.version !== 'string' || !content.version) {
      console.error(`❌ Vocabulary file missing or invalid "version": ${relativePath}`);
      process.exit(1);
    }
    
    if (content.vocabularyId === 'extraction-role-categories') {
      const subLists = ['temporalRoleCategories', 'partyKinds', 'partyRoleCategories', 'monetaryRoleCategories'];
      let totalTerms = 0;
      for (const listName of subLists) {
        if (!Array.isArray(content[listName])) {
          console.error(`❌ Vocabulary file "${listName}" must be an array: ${relativePath}`);
          process.exit(1);
        }
        for (let i = 0; i < content[listName].length; i++) {
          const term = content[listName][i];
          if (typeof term !== 'object' || term === null || typeof term.value !== 'string' || !term.value) {
            console.error(`❌ Vocabulary file contains term without valid string value at index ${i} in "${listName}": ${relativePath}`);
            process.exit(1);
          }
        }
        totalTerms += content[listName].length;
      }
      console.log(`[OK] Vocabulary valid: ${relativePath} (${content.vocabularyId}@${content.version}, ${totalTerms} terms across ${subLists.length} groups)`);
    } else {
      if (!Array.isArray(content.terms)) {
        console.error(`❌ Vocabulary file "terms" must be an array: ${relativePath}`);
        process.exit(1);
      }
      
      for (let i = 0; i < content.terms.length; i++) {
        const term = content.terms[i];
        if (typeof term !== 'object' || term === null || typeof term.value !== 'string' || !term.value) {
          console.error(`❌ Vocabulary file contains term without valid string value at index ${i}: ${relativePath}`);
          process.exit(1);
        }
      }
      console.log(`[OK] Vocabulary valid: ${relativePath} (${content.vocabularyId}@${content.version}, ${content.terms.length} terms)`);
    }
  }
  console.log('');

  // 3.3 Verify referenced examples in READMEs actually exist
  console.log('Verifying examples referenced in README.md files actually exist...');
  const allReadmeFiles = walkDir(contractsDir, (p) => p.endsWith('README.md'));
  for (const readmeFile of allReadmeFiles) {
    const relativeReadmePath = path.relative(process.cwd(), readmeFile);
    const readmeContent = fs.readFileSync(readmeFile, 'utf8');
    const folder = path.dirname(readmeFile);
    
    // Find references of the form examples/something.json
    const exampleRegex = /examples\/[a-zA-Z0-9._-]+\.json/g;
    let match;
    const matches = [];
    while ((match = exampleRegex.exec(readmeContent)) !== null) {
      matches.push(match[0]);
    }
    
    for (const ref of matches) {
      const fullPath = path.join(folder, ref);
      if (!fs.existsSync(fullPath)) {
        console.error(`❌ Referenced example does not exist: "${ref}" (found in ${relativeReadmePath})`);
        process.exit(1);
      }
    }
    if (matches.length > 0) {
      console.log(`[OK] Verified ${matches.length} example references in ${relativeReadmePath}`);
    }
  }
  console.log('');

  // 4. Validate Example payloads against their respective schemas
  console.log('Validating example payloads against associated schemas...');
  for (const schemaFile of schemaFiles) {
    const relativePath = path.relative(process.cwd(), schemaFile);
    const folder = path.dirname(schemaFile);
    const examplesDir = path.join(folder, 'examples');
    
    if (!fs.existsSync(examplesDir)) {
      continue;
    }
    
    const schemaContent = JSON.parse(fs.readFileSync(schemaFile, 'utf8'));
    
    // Check if we can compile the schema using Ajv
    let validate;
    try {
      validate = ajv.compile(schemaContent);
    } catch (err) {
      console.warn(`⚠️ [Ajv Compile Warning] Unable to compile schema ${relativePath} natively: ${err.message}`);
      continue;
    }
    
    const schemaBaseName = path.basename(schemaFile);
    const examples = fs.readdirSync(examplesDir).filter(f => f.endsWith('.json')).filter(f => {
      if (schemaBaseName === 'schema.json') {
        return true;
      }
      const prefix = schemaBaseName.replace('.schema.json', '.');
      return f.startsWith(prefix);
    });
    for (const exFile of examples) {
      const exPath = path.join(examplesDir, exFile);
      const exContent = JSON.parse(fs.readFileSync(exPath, 'utf8'));
      
      const isValid = validate(exContent);
      if (!isValid) {
        console.error(`❌ Example validation failed: ${path.relative(process.cwd(), exPath)} against ${relativePath}`);
        console.error(JSON.stringify(validate.errors, null, 2));
        process.exit(1);
      } else {
        console.log(`[OK] Example valid: ${path.relative(process.cwd(), exPath)} successfully validates against schema.`);
      }
    }
  }

  // Helper functions for nested validation
  function loadJson(filePath) {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  }

  const schemaCache = new Map();

  function getValidator(schemaPath) {
    if (schemaCache.has(schemaPath)) {
      return schemaCache.get(schemaPath);
    }
    const schemaContent = loadJson(schemaPath);
    try {
      const localAjv = new Ajv({ allErrors: true, strict: false });
      const validate = localAjv.compile(schemaContent);
      schemaCache.set(schemaPath, validate);
      return validate;
    } catch (err) {
      console.error(`❌ Unable to compile schema: ${schemaPath} - ${err.message}`);
      process.exit(1);
    }
  }

  function validateAgainstSchema(label, payload, schemaPath, relativeExamplePath) {
    const validate = getValidator(schemaPath);
    const isValid = validate(payload);
    if (!isValid) {
      console.error(`❌ Nested validation failed [${label}]: ${relativeExamplePath} at schema ${path.relative(process.cwd(), schemaPath)}`);
      console.error(JSON.stringify(validate.errors, null, 2));
      process.exit(1);
    }
    console.log(`[OK] Nested validation success [${label}]: ${relativeExamplePath} complies with nested schema.`);
  }

  function validateNestedContracts() {
    console.log('Validating nested contract examples...');

    const visualAnalysisSchemaPath = path.join(contractsDir, 'schemas/visual-analysis/v0.2.0-draft.1/schema.json');
    const summaryAnalysisSchemaPath = path.join(contractsDir, 'schemas/summary-analysis/v1.2.0-draft.2/schema.json');
    const imageAnalysisRecordSchemaPath = path.join(contractsDir, 'schemas/image-analysis-record/v0.1.0/schema.json');

    // 1. image-analysis-record examples
    const imageAnalysisRecordExamplesDir = path.join(contractsDir, 'schemas/image-analysis-record/v0.1.0/examples');
    if (fs.existsSync(imageAnalysisRecordExamplesDir)) {
      const examples = fs.readdirSync(imageAnalysisRecordExamplesDir).filter(f => f.endsWith('.json'));
      for (const exFile of examples) {
        const exPath = path.join(imageAnalysisRecordExamplesDir, exFile);
        const relativeExamplePath = path.relative(process.cwd(), exPath);
        const exContent = loadJson(exPath);
        if (exContent.visualAnalysis) {
          validateAgainstSchema(
            'image-analysis-record -> visualAnalysis',
            exContent.visualAnalysis,
            visualAnalysisSchemaPath,
            relativeExamplePath
          );
        }
      }
    }

    // 2. text-analysis-record examples
    const textAnalysisRecordExamplesDir = path.join(contractsDir, 'schemas/text-analysis-record/v0.1.0/examples');
    if (fs.existsSync(textAnalysisRecordExamplesDir)) {
      const examples = fs.readdirSync(textAnalysisRecordExamplesDir).filter(f => f.endsWith('.json'));
      for (const exFile of examples) {
        const exPath = path.join(textAnalysisRecordExamplesDir, exFile);
        const relativeExamplePath = path.relative(process.cwd(), exPath);
        const exContent = loadJson(exPath);
        if (exContent.summaryAnalysis) {
          validateAgainstSchema(
            'text-analysis-record -> summaryAnalysis',
            exContent.summaryAnalysis,
            summaryAnalysisSchemaPath,
            relativeExamplePath
          );
        }
      }
    }

    // 3. API analyze response examples
    const apiAnalyzeExamplesDir = path.join(contractsDir, 'api/v0.1.0/examples');
    if (fs.existsSync(apiAnalyzeExamplesDir)) {
      const examples = fs.readdirSync(apiAnalyzeExamplesDir).filter(f => f.startsWith('visual-public-samples-analyze.response') && f.endsWith('.json'));
      for (const exFile of examples) {
        const exPath = path.join(apiAnalyzeExamplesDir, exFile);
        const relativeExamplePath = path.relative(process.cwd(), exPath);
        const exContent = loadJson(exPath);
        if (exContent.record) {
          validateAgainstSchema(
            'API response -> record',
            exContent.record,
            imageAnalysisRecordSchemaPath,
            relativeExamplePath
          );
          if (exContent.record.visualAnalysis) {
            validateAgainstSchema(
              'API response -> record -> visualAnalysis',
              exContent.record.visualAnalysis,
              visualAnalysisSchemaPath,
              relativeExamplePath
            );
          }
        }
      }
    }
  }

  validateNestedContracts();

  // 5. Validate Conformance vectors
  console.log('Validating conformance test vectors...');
  const conformanceDir = path.join(contractsDir, 'conformance');
  if (fs.existsSync(conformanceDir)) {
    const conformanceSchemas = [
      {
        id: 'visual-analysis',
        schemaPath: path.join(contractsDir, 'schemas/visual-analysis/v0.2.0-draft.1/schema.json'),
        conformancePath: path.join(conformanceDir, 'visual-analysis/v0.2.0-draft.1')
      },
      {
        id: 'image-analysis-record',
        schemaPath: path.join(contractsDir, 'schemas/image-analysis-record/v0.1.0/schema.json'),
        conformancePath: path.join(conformanceDir, 'image-analysis-record/v0.1.0')
      },
      {
        id: 'api-response',
        schemaPath: path.join(contractsDir, 'api/v0.1.0/visual-public-samples-analyze.response.schema.json'),
        conformancePath: path.join(conformanceDir, 'api/v0.1.0')
      }
    ];

    for (const item of conformanceSchemas) {
      if (!fs.existsSync(item.schemaPath) || !fs.existsSync(item.conformancePath)) {
        continue;
      }
      const schemaContent = JSON.parse(fs.readFileSync(item.schemaPath, 'utf8'));
      const localAjv = new Ajv({ allErrors: true, strict: false });
      const validate = localAjv.compile(schemaContent);

      const validDir = path.join(item.conformancePath, 'valid');
      const invalidDir = path.join(item.conformancePath, 'invalid');

      if (fs.existsSync(validDir)) {
        const files = fs.readdirSync(validDir).filter(f => f.endsWith('.json'));
        for (const file of files) {
          const filePath = path.join(validDir, file);
          const payload = JSON.parse(fs.readFileSync(filePath, 'utf8'));
          const isValid = validate(payload);
          if (!isValid) {
            console.error(`❌ Conformance validation failed: ${path.relative(process.cwd(), filePath)} should have PASSED but FAILED.`);
            console.error(JSON.stringify(validate.errors, null, 2));
            process.exit(1);
          } else {
            console.log(`[OK] Conformance pass success: ${path.relative(process.cwd(), filePath)} passed schema validation as expected.`);
          }
        }
      }

      if (fs.existsSync(invalidDir)) {
        const files = fs.readdirSync(invalidDir).filter(f => f.endsWith('.json'));
        for (const file of files) {
          const filePath = path.join(invalidDir, file);
          const payload = JSON.parse(fs.readFileSync(filePath, 'utf8'));
          const isValid = validate(payload);
          if (isValid) {
            console.error(`❌ Conformance validation failed: ${path.relative(process.cwd(), filePath)} should have FAILED but PASSED.`);
            process.exit(1);
          } else {
            console.log(`[OK] Conformance fail success: ${path.relative(process.cwd(), filePath)} failed schema validation as expected.`);
          }
        }
      }
    }
  }

  console.log('\n✨ Contracts Validation Successful! ✨');
}

runValidation();
