import fs from 'fs';
import path from 'path';

function ensureDir(dirPath: string) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function processSchema(sourceFile: string, destDir: string, destFileName: string, metadata: Record<string, any>) {
  const sourcePath = path.join(process.cwd(), 'schemas', sourceFile);
  const destPath = path.join(process.cwd(), 'contracts', 'schemas', destDir, destFileName);

  if (!fs.existsSync(sourcePath)) {
    console.error(`Source schema not found: ${sourcePath}`);
    return;
  }

  ensureDir(path.dirname(destPath));

  const schema = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));
  
  // Inject/Update metadata
  const updatedSchema = {
    ...schema,
    $schema: schema.$schema || "http://json-schema.org/draft-07/schema#",
    $id: metadata.$id,
    title: metadata.title || schema.title,
    description: schema.description,
    "x-contract-id": metadata["x-contract-id"],
    "x-contract-version": metadata["x-contract-version"],
    "x-contract-status": metadata["x-contract-status"]
  };

  // Re-force order of fields at the top
  const orderedSchema: Record<string, any> = {};
  orderedSchema["$schema"] = updatedSchema.$schema;
  orderedSchema["$id"] = updatedSchema.$id;
  orderedSchema["title"] = updatedSchema.title;
  if (updatedSchema.description) {
    orderedSchema["description"] = updatedSchema.description;
  }
  orderedSchema["x-contract-id"] = updatedSchema["x-contract-id"];
  orderedSchema["x-contract-version"] = updatedSchema["x-contract-version"];
  orderedSchema["x-contract-status"] = updatedSchema["x-contract-status"];

  // Copy all other fields
  for (const [key, value] of Object.entries(updatedSchema)) {
    if (!["$schema", "$id", "title", "description", "x-contract-id", "x-contract-version", "x-contract-status"].includes(key)) {
      orderedSchema[key] = value;
    }
  }

  fs.writeFileSync(destPath, JSON.stringify(orderedSchema, null, 2), 'utf8');
  console.log(`[Copied Schema] ${sourceFile} -> contracts/schemas/${destDir}/${destFileName}`);
}

function copyVocabularies() {
  const vocabSourceDir = path.join(process.cwd(), 'schemas', 'vocabularies');
  const vocabDestDir = path.join(process.cwd(), 'contracts', 'vocabularies');

  if (!fs.existsSync(vocabSourceDir)) {
    console.log('No vocabularies source directory found');
    return;
  }

  ensureDir(vocabDestDir);
  const files = fs.readdirSync(vocabSourceDir);
  for (const file of files) {
    const src = path.join(vocabSourceDir, file);
    const dest = path.join(vocabDestDir, file);
    fs.copyFileSync(src, dest);
    console.log(`[Copied Vocabulary] schemas/vocabularies/${file} -> contracts/vocabularies/${file}`);
  }
}

function copyExamples() {
  const exampleSourceDir = path.join(process.cwd(), 'schemas', 'examples');
  const exampleDestDirs: Record<string, string> = {
    'summary-analysis.v1.2.0-draft.2. japonés-mixed.json': 'summary-analysis/v1.2.0-draft.2/examples/japanese-mixed.json', // handle spacing/encoding if needed, let's copy by files manually or search
  };

  if (!fs.existsSync(exampleSourceDir)) {
    return;
  }

  const files = fs.readdirSync(exampleSourceDir);
  for (const file of files) {
    const src = path.join(exampleSourceDir, file);
    if (file.includes('v1.2.0-draft.2.minimal.json')) {
      const dest = path.join(process.cwd(), 'contracts', 'schemas', 'summary-analysis', 'v1.2.0-draft.2', 'examples', 'minimal.json');
      ensureDir(path.dirname(dest));
      fs.copyFileSync(src, dest);
      console.log(`[Copied Example] ${file} -> summary-analysis minimal.json`);
    } else if (file.includes('japanese-mixed.json')) {
      const dest = path.join(process.cwd(), 'contracts', 'schemas', 'summary-analysis', 'v1.2.0-draft.2', 'examples', 'japanese-mixed.json');
      ensureDir(path.dirname(dest));
      fs.copyFileSync(src, dest);
      console.log(`[Copied Example] ${file} -> summary-analysis japanese-mixed.json`);
    }
  }
}

function main() {
  // 1. Process main schemas
  processSchema(
    'summary-analysis.v1.2.0-draft.2.schema.json',
    'summary-analysis/v1.2.0-draft.2',
    'schema.json',
    {
      $id: 'https://indexmd.moukaeritai.work/contracts/schemas/summary-analysis/v1.2.0-draft.2/schema.json',
      title: 'Summary Analysis Schema v1.2.0-draft.2',
      'x-contract-id': 'summary-analysis',
      'x-contract-version': 'v1.2.0-draft.2',
      'x-contract-status': 'draft'
    }
  );

  processSchema(
    'text-analysis-record.v0.1.0.schema.json',
    'text-analysis-record/v0.1.0',
    'schema.json',
    {
      $id: 'https://indexmd.moukaeritai.work/contracts/schemas/text-analysis-record/v0.1.0/schema.json',
      title: 'Text Analysis Record Schema v0.1.0',
      'x-contract-id': 'text-analysis-record',
      'x-contract-version': 'v0.1.0',
      'x-contract-status': 'stable'
    }
  );

  processSchema(
    'visual-analysis.v0.2.0-draft.1.schema.json',
    'visual-analysis/v0.2.0-draft.1',
    'schema.json',
    {
      $id: 'https://indexmd.moukaeritai.work/contracts/schemas/visual-analysis/v0.2.0-draft.1/schema.json',
      title: 'Visual Analysis Schema v0.2.0-draft.1',
      'x-contract-id': 'visual-analysis',
      'x-contract-version': 'v0.2.0-draft.1',
      'x-contract-status': 'draft'
    }
  );

  processSchema(
    'image-analysis-record.v0.1.0.schema.json',
    'image-analysis-record/v0.1.0',
    'schema.json',
    {
      $id: 'https://indexmd.moukaeritai.work/contracts/schemas/image-analysis-record/v0.1.0/schema.json',
      title: 'Image Analysis Record Schema v0.1.0',
      'x-contract-id': 'image-analysis-record',
      'x-contract-version': 'v0.1.0',
      'x-contract-status': 'stable'
    }
  );

  // 2. Copy vocabularies and examples
  copyVocabularies();
  copyExamples();

  console.log('Finished copying contracts.');
}

main();
