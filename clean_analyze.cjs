const fs = require('fs');
let code = fs.readFileSync('temp_analyze.ts', 'utf8');

// remove `app.post("/api/visual/public-samples/analyze", async (req, res) => {` and closing `});`
code = code.replace(/app\.post\("\/api\/visual\/public-samples\/analyze", async \(req, res\) => \{\n/, '');
code = code.replace(/\}\);\n?$/, '}');

code = code.replace(
    /const \{ sampleId, modelName = "gemini-3\.5-flash", includeRequestPreview = false, jsonMode, customInstruction \} = req\.body;/,
    `const { sampleId, modelName = "gemini-3.5-flash", includeRequestPreview = false, jsonMode, customInstruction } = options;`
);

// We need to return an object instead of calling `res.status().json()`.
// Since we only do `return res.status(...).json(...)`, `return res.json(...)`, `res.json(...)`, we can replace them using regex safely.
// Be careful: some are `res.status(200).json(failRes);` with `return`.
// Let's replace `return res.status(xxx).json(yyy)` -> `return { status: xxx, body: yyy }`
code = code.replace(/return res\.status\((\d+)\)\.json\(([\s\S]*?)\);/g, 'return { status: $1, body: $2 };');

// `return res.json(...)` -> `return { status: 200, body: ... }`
code = code.replace(/return res\.json\(([\s\S]*?)\);/g, 'return { status: 200, body: $1 };');

// `res.status(500).json(...)` without return at the end of catch block
code = code.replace(/res\.status\((\d+)\)\.json\(([\s\S]*?)\);/g, 'return { status: $1, body: $2 };');

// `res.json(...)` without return at the end
code = code.replace(/res\.json\(([\s\S]*?)\);/g, 'return { status: 200, body: $1 };');

const finalCode = `
export async function analyzePublicSample(options: {
  sampleId: string;
  modelName?: string;
  includeRequestPreview?: boolean;
  jsonMode?: string;
  customInstruction?: string;
}): Promise<{status: number, body: any}> {
${code}

app.post("/api/visual/public-samples/analyze", async (req, res) => {
  try {
    const result = await analyzePublicSample(req.body);
    return res.status(result.status).json(result.body);
  } catch (e: any) {
    console.error(e);
    return res.status(500).json({ error: e.message || "Internal server error" });
  }
});
`;

fs.writeFileSync('temp_analyze_clean.ts', finalCode);
