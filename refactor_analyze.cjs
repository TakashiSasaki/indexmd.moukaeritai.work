const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const match = code.match(/app\.post\("\/api\/visual\/public-samples\/analyze", async \(req, res\) => \{([\s\S]*?)\}\);/);
if (match) {
  let body = match[1];
  
  // replace req.body.xx with options.xx
  body = body.replace(
    /const \{ sampleId, modelName = "gemini-3\.5-flash", includeRequestPreview = false, jsonMode, customInstruction \} = req\.body;/,
    `const { sampleId, modelName = "gemini-3.5-flash", includeRequestPreview = false, jsonMode, customInstruction } = options;`
  );

  // replace res.status(xx).json(yy) with return { status: xx, body: yy }
  body = body.replace(/return res\.status\((\d+)\)\.json\(([\s\S]*?)\);/g, 'return { status: $1, body: $2 };');
  
  // there might be res.status(200).json(xx) without return? No, usually return res.status...
  // wait, the success path at the end is probably `res.json(...)` or `res.status(200).json(...)`.
  body = body.replace(/res\.json\(([\s\S]*?)\);/g, 'return { status: 200, body: $1 };');
  
  const newFunc = `
export async function analyzePublicSample(options: {
  sampleId: string;
  modelName?: string;
  includeRequestPreview?: boolean;
  jsonMode?: string;
  customInstruction?: string;
}): Promise<{status: number, body: any}> {
${body}
}

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

  code = code.replace(match[0], newFunc);
  fs.writeFileSync('server.ts', code);
  console.log("Refactored successfully.");
} else {
  console.log("Could not find the endpoint.");
}

