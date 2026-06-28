import fetch from 'node-fetch';
async function run() {
  const res = await fetch('http://localhost:3000/api/visual/public-samples/analyze', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer test'
    },
    body: JSON.stringify({
      sampleId: "sample-landscape-1",
      targetModel: "gemini-2.5-flash",
      mode: "nativeSchema",
      jsonMode: "standard",
      mediaResolutionRequested: "medium",
      includeRequestPreview: true
    })
  });
  console.log("Status:", res.status);
  const text = await res.text();
  try {
    const data = JSON.parse(text);
    console.log(JSON.stringify({
      success: data.success,
      qualityStatus: data.qualityStatus,
      normalizationDiagnostics: !!data.normalizationDiagnostics,
      inputDiagnostics: !!data.inputDiagnostics,
      mediaResolutionRequested: data.requestPreview?.generationConfig?.mediaResolutionRequested,
      mediaResolutionApplied: data.analysisRun?.input?.mediaResolutionApplied
    }, null, 2));
  } catch(e) {
    console.error("Parse Error. Body was:");
    console.error(text);
  }
}
run();
