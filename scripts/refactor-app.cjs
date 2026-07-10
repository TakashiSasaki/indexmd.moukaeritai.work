const fs = require('fs');
const ts = require('typescript');

const sourceCode = fs.readFileSync('src/app.ts', 'utf-8');
const sourceFile = ts.createSourceFile('app.ts', sourceCode, ts.ScriptTarget.Latest, true);

let topLevelStmts = [];
let createAppBodyStmts = [];

sourceFile.statements.forEach(stmt => {
  const text = stmt.getText(sourceFile);
  
  if (text.startsWith('app.')) {
    createAppBodyStmts.push(text);
  } else if (text.startsWith('export const app = express();')) {
    // skip
  } else if (text.startsWith('const PORT = 3000;')) {
    // skip
  } else if (text.includes('export function createApp')) {
    // skip old createApp
  } else if (text.includes('export interface AppDependencies')) {
    // skip old AppDependencies
  } else if (text.startsWith('function getInjected')) {
    // skip
  } else if (text.includes('const store = getInjectedJobStore(req)')) {
    // we'll do string replacements on createAppBodyStmts later
    topLevelStmts.push(text); // wait, if it's inside a function it's not a top-level statement!
  } else {
    topLevelStmts.push(text);
  }
});

let out = topLevelStmts.join('\n\n');

// Replace injected getters in out
out = out.replace(/const store = getInjectedJobStore\(req\);/g, "const store = dependencies.jobStore;");
out = out.replace(/const transport = getInjectedProviderTransport\(req\);/g, "const transport = dependencies.providerTransport;");
out = out.replace(/const resolver = getInjectedSampleResolver\(req\);/g, "const resolver = dependencies.sampleResolver;");
out = out.replace(/const imageFetcher = getInjectedImageFetcher\(req\);/g, "const imageFetcher = dependencies.imageFetcher;");


out += `

export interface AppDependencies {
  jobStore?: any;
  providerTransport?: any;
  sampleResolver?: SampleResolver;
  idGenerator?: () => string;
  clock?: { now: () => Date };
  imageFetcher?: any;
}

export function createApp(dependencies: AppDependencies = {}) {
  const app = express();
  
  // Apply JSON parsing middleware
  app.use(express.json());

`;

let body = createAppBodyStmts.join('\n\n');
body = body.replace(/const store = getInjectedJobStore\(req\);/g, "const store = dependencies.jobStore;");
body = body.replace(/const transport = getInjectedProviderTransport\(req\);/g, "const transport = dependencies.providerTransport;");
body = body.replace(/const resolver = getInjectedSampleResolver\(req\);/g, "const resolver = dependencies.sampleResolver;");
body = body.replace(/const imageFetcher = getInjectedImageFetcher\(req\);/g, "const imageFetcher = dependencies.imageFetcher;");

out += body;
out += `\n\n  return { app, initializeApp: () => { /* init side effects */ } };\n}\n`;

fs.writeFileSync('src/app.ts.tmp2', out);
