export const ANALYSIS_BUNDLE_V01 = {
  reportKind: "visualAnalysisPublicSampleBatchAnalysisBundle",
  bundleSchemaVersion: "0.1.0",
  createdAt: new Date().toISOString(),
  job: {
    jobId: "test-job-v0.1",
    modelName: "gemini-1.5-pro",
    jsonMode: "json_object",
    targetSampleIds: ["landscape-1"],
    status: "completed",
    createdAt: new Date().toISOString()
  },
  total: 1,
  successCount: 1,
  failureCount: 0,
  items: [
    {
      sampleId: "landscape-1",
      status: "succeeded",
      modelName: "gemini-1.5-pro",
      analysis: {
        schemaVersion: "visual-analysis.v0.1.0-draft.1",
        summary: { caption: "A valley", description: "Yosemite valley" },
        visualInfo: {
          imageKind: "landscapePhoto",
          imageKindConfidence: 0.99,
          sceneDescription: "A beautiful valley with mountains and trees",
          visibleElements: [],
          visibleText: [],
          uncertainties: []
        },
        indexing: { keywords: [] },
        quality: { confidence: 0.9, issues: [] }
      }
    }
  ]
};
