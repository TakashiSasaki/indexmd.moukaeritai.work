import fs from 'fs';
import { compileProviderSchema } from './src/lib/visualAnalysis/schemaCompiler.ts';
const code = fs.readFileSync('./src/lib/visualAnalysis/schemaCompiler.ts', 'utf-8');
console.log(code);
