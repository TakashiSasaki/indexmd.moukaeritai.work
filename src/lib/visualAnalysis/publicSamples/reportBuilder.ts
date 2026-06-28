import { PublicSampleBatchRunSummary, PublicSampleBatchRunItem } from "./batchTypes";

export function buildBatchReportForChat(batchSummary: PublicSampleBatchRunSummary) {
  const compactItems = batchSummary.items.map(item => buildCompactItem(item));

  return {
    reportKind: "visualAnalysisPublicSampleBatchReport",
    generatedAt: new Date().toISOString(),
    modelName: batchSummary.modelName,
    jsonMode: batchSummary.jsonMode,
    retryOnInvalidJson: batchSummary.retryOnInvalidJson,
    total: batchSummary.total,
    successCount: batchSummary.successCount,
    failureCount: batchSummary.failureCount,
    validCount: batchSummary.validCount,
    validLowQualityCount: batchSummary.validLowQualityCount,
    invalidJsonCount: batchSummary.invalidJsonCount,
    expectedComparisonPassCount: batchSummary.expectedComparisonPassCount,
    expectedComparisonWarningCount: batchSummary.expectedComparisonWarningCount,
    expectedComparisonFailCount: batchSummary.expectedComparisonFailCount,
    reviewPassCount: batchSummary.reviewPassCount,
    reviewNeedsReviewCount: batchSummary.reviewNeedsReviewCount,
    reviewFailCount: batchSummary.reviewFailCount,
    items: compactItems
  };
}

export function buildFailuresOnlyReport(batchSummary: PublicSampleBatchRunSummary) {
  const failures = batchSummary.items.filter(item => !item.success || item.qualityStatus === 'invalid');
  const compactItems = failures.map(item => buildCompactItem(item));

  return {
    reportKind: "visualAnalysisPublicSampleFailuresReport",
    generatedAt: new Date().toISOString(),
    modelName: batchSummary.modelName,
    jsonMode: batchSummary.jsonMode,
    retryOnInvalidJson: batchSummary.retryOnInvalidJson,
    totalFailures: failures.length,
    items: compactItems
  };
}

function buildCompactItem(item: PublicSampleBatchRunItem) {
  const compact: any = {
    sampleId: item.sampleId,
    title: item.title,
    success: item.success
  };

  if (item.error) compact.error = item.error;
  if (item.failureKind) compact.failureKind = item.failureKind;
  if (item.qualityStatus) compact.qualityStatus = item.qualityStatus;
  if (item.qualityScore !== undefined) compact.qualityScore = item.qualityScore;
  if (item.qualityIssues && item.qualityIssues.length > 0) compact.qualityIssues = item.qualityIssues;

  if (item.responseRaw && item.responseRaw.sampleMetadata) {
     compact.category = item.responseRaw.sampleMetadata.category;
     compact.licenseName = item.responseRaw.sampleMetadata.licenseName;
  }

  if (item.responseRaw && item.responseRaw.expectedMetadata) {
     compact.expected = item.responseRaw.expectedMetadata;
  }
  
  if (item.comparison) {
     compact.comparisonSummary = {
        imageKind: item.comparison.imageKind,
        categories: item.comparison.categories,
        labels: item.comparison.labels,
        visibleText: item.comparison.visibleText,
        overallStatus: item.comparison.overallStatus,
        reasons: item.comparison.reasons,
        reviewStatus: item.comparison.reviewStatus,
        reviewReasons: item.comparison.reviewReasons
     };
  }

  const run = item.analysisRun?.metadata ?? item.analysisRun;
  if (run) {
    compact.execution = {
      modelName: run.model?.name || run.execution?.modelName,
      providerFamily: run.model?.providerFamily || run.execution?.providerFamily,
      structuredExecutionMode: run.execution?.structuredExecutionMode,
      jsonMode: run.execution?.jsonMode,
      jsonRecovery: run.execution?.jsonRecovery
    };
  }

  const visualAnalysis = item.responseRaw?.visualAnalysis;
  const vi = visualAnalysis?.visualInfo;
  const indexing = visualAnalysis?.indexing;
  const normalized = item.analysisRun?.result?.normalized;

  if (vi || normalized) {
    const imageKind = vi?.imageKind ?? normalized?.imageKind;
    const imageKindConfidence = vi?.imageKindConfidence ?? normalized?.imageKindConfidence;
    const visibleElements = vi?.visibleElements ?? normalized?.visibleElements;
    const visibleText = vi?.visibleText ?? normalized?.visibleText;
    const keywords = indexing?.keywords ?? normalized?.indexing?.keywords ?? normalized?.keywords;

    compact.detected = {
      imageKind,
      imageKindConfidence,
      visibleElements: visibleElements?.map((el: any) => ({
        label: el.label,
        category: el.category,
        confidence: el.confidence,
        attributes: el.attributes
      })),
      visibleText: visibleText?.map((txt: any) => ({
        text: typeof txt === 'string' ? txt : txt?.text,
        confidence: typeof txt === 'string' ? undefined : txt?.confidence,
        locationHint: typeof txt === 'string' ? undefined : txt?.locationHint,
        language: typeof txt === 'string' ? undefined : txt?.language
      })),
      keywords: keywords?.map((kw: any) => ({
        value: typeof kw === 'string' ? kw : kw?.value,
        confidence: typeof kw === 'string' ? undefined : kw?.confidence,
        importance: typeof kw === 'string' ? undefined : kw?.importance
      }))
    };
  }

  if (item.generationDiagnostics) {
    compact.generationDiagnostics = { ...item.generationDiagnostics };
  }

  if (item.inputDiagnostics) {
    compact.inputDiagnostics = item.inputDiagnostics;
  }

  if (item.parseDiagnostics) {
    compact.parseDiagnostics = { ...item.parseDiagnostics };
    delete compact.parseDiagnostics.rawOutputPreview;
    delete compact.parseDiagnostics.requestPreview;
  }

  return compact;
}
