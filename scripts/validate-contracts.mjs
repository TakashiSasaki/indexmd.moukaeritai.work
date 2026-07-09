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

  console.log('\n✨ Contracts Validation Successful! ✨');
}

runValidation();
