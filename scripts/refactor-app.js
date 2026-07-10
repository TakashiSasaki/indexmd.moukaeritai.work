const fs = require('fs');
const content = fs.readFileSync('src/app.ts', 'utf-8');

// The strategy:
// 1. Find `export const app = express();`
// 2. Remove it, and `const PORT = 3000;` and `app.use(express.json());`
// 3. Find all `app.get(`, `app.post(`, `app.delete(`, `app.use(` and move them to a new createApp function.
// 4. Remove `getInjectedJobStore` etc.
// 5. Replace their usage with `dependencies.X` inside the routes.

let newContent = content;

newContent = newContent.replace(/export const app = express\(\);\nconst PORT = 3000;\n\n\/\/ Apply JSON parsing middleware\napp\.use\(express\.json\(\)\);\n/g, "");

newContent = newContent.replace(/export interface AppDependencies \{[\s\S]*?\}\n\nexport function createApp\(dependencies: AppDependencies = \{\}\) \{[\s\S]*?return \{ app \};\n\}\n/g, "");

newContent = newContent.replace(/function getInjectedJobStore[\s\S]*?\}\n\n/g, "");
newContent = newContent.replace(/function getInjectedProviderTransport[\s\S]*?\}\n\n/g, "");
newContent = newContent.replace(/function getInjectedSampleResolver[\s\S]*?\}\n\n/g, "");
newContent = newContent.replace(/function getInjectedImageFetcher[\s\S]*?\}\n\n/g, "");

// We need to move all top level statements that start with `app.` inside `createApp`
const lines = newContent.split('\n');
const topLevelLines = [];
const routeLines = [];
const initLines = [];

// Let's identify the side effects
// e.g., if (!fs.existsSync(HISTORY_DIR))
let inAppBlock = false;

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  if (line.startsWith('app.')) {
    routeLines.push(line);
    // Continue gathering if it's a multi-line block... Wait, the easiest way is to use a brace-counting parser.
  }
}
