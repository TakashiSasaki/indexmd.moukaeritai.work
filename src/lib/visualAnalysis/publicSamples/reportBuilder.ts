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
        reasons: item.comparison.reasons
     };
  }

  if (item.analysisRun) {
    compact.execution = {
      modelName: item.analysisRun.model?.name || item.analysisRun.execution?.modelName,
      providerFamily: item.analysisRun.model?.providerFamily || item.analysisRun.execution?.providerFamily,
      structuredExecutionMode: item.analysisRun.execution?.structuredExecutionMode,
      jsonMode: item.analysisRun.execution?.jsonMode,
      jsonRecovery: item.analysisRun.execution?.jsonRecovery
    };
  }

  const normalized = item.analysisRun?.result?.normalized;
  if (normalized) {
    compact.detected = {
      imageKind: normalized.imageKind,
      imageKindConfidence: normalized.imageKindConfidence,
      visibleElements: normalized.visibleElements?.map((el: any) => ({
        label: el.label,
        category: el.category,
        confidence: el.confidence,
        attributes: el.attributes
      })),
      visibleText: normalized.visibleText?.map((txt: any) => ({
        text: typeof txt === 'string' ? txt : txt.text,
        confidence: typeof txt === 'string' ? undefined : txt.confidence,
        locationHint: typeof txt === 'string' ? undefined : txt.locationHint,
        language: typeof txt === 'string' ? undefined : txt.language
      })),
      keywords: normalized.indexing?.keywords || normalized.keywords?.map((kw: any) => ({
        value: typeof kw === 'string' ? kw : kw.value,
        confidence: typeof kw === 'string' ? undefined : kw.confidence,
        importance: typeof kw === 'string' ? undefined : kw.importance
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
