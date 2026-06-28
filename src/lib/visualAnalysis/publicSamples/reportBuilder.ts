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
    generationFailureSummary: buildGenerationFailureSummary(batchSummary.items),
    apiResponseFailureSummary: buildApiResponseFailureSummary(batchSummary.items),
    items: compactItems
  };
}

function buildApiResponseFailureSummary(items: PublicSampleBatchRunItem[]) {
  const failedItems = items.filter(item => !item.success && item.responseDiagnostics);
  const byStatus: Record<string, number> = {};
  const byContentType: Record<string, number> = {};
  const byHtmlTitle: Record<string, number> = {};
  const samples: Array<{
    sampleId: string;
    status?: number;
    contentType?: string;
    htmlTitle?: string;
    bodyLength?: number;
    bodyPreview?: string;
  }> = [];

  for (const item of items) {
    if (!item.success && item.responseDiagnostics) {
      const diag = item.responseDiagnostics;
      
      const statusStr = String(diag.status || "UNKNOWN");
      byStatus[statusStr] = (byStatus[statusStr] || 0) + 1;

      const ct = diag.contentType || "UNKNOWN";
      byContentType[ct] = (byContentType[ct] || 0) + 1;

      const title = diag.htmlTitle || "NONE";
      byHtmlTitle[title] = (byHtmlTitle[title] || 0) + 1;

      let preview = diag.bodyPreview;
      if (preview && preview.length > 1500) {
        preview = preview.slice(0, 750) + "\n... [TRUNCATED FOR REPORT] ...\n" + preview.slice(-750);
      }

      samples.push({
        sampleId: item.sampleId,
        status: diag.status,
        contentType: diag.contentType,
        htmlTitle: diag.htmlTitle,
        bodyLength: diag.bodyLength,
        bodyPreview: preview,
      });
    }
  }

  return {
    total: failedItems.length,
    byStatus,
    byContentType,
    byHtmlTitle,
    samples,
  };
}

function buildGenerationFailureSummary(items: PublicSampleBatchRunItem[]) {
  const failedItems = items.filter(item => !item.success);
  const byProviderStatus: Record<string, number> = {};
  const byStatusCode: Record<string, number> = {};
  const byMimeType: Record<string, number> = {};
  
  const inputsInfo: Array<{
    sampleId: string;
    byteLength?: number;
    base64Length?: number;
    providerStatus?: string;
  }> = [];

  for (const item of items) {
    const isFailed = !item.success;
    const diag = item.generationDiagnostics;
    const inputDiag = item.inputDiagnostics;

    if (isFailed) {
      if (diag) {
        const provStatus = diag.providerStatus || "UNKNOWN";
        byProviderStatus[provStatus] = (byProviderStatus[provStatus] || 0) + 1;
        
        const statusCodeStr = diag.statusCode ? String(diag.statusCode) : "UNKNOWN";
        byStatusCode[statusCodeStr] = (byStatusCode[statusCodeStr] || 0) + 1;
      } else {
        byProviderStatus["UNKNOWN"] = (byProviderStatus["UNKNOWN"] || 0) + 1;
        byStatusCode["UNKNOWN"] = (byStatusCode["UNKNOWN"] || 0) + 1;
      }

      if (inputDiag) {
        const mime = inputDiag.mimeType || "UNKNOWN";
        byMimeType[mime] = (byMimeType[mime] || 0) + 1;
      } else {
        byMimeType["UNKNOWN"] = (byMimeType["UNKNOWN"] || 0) + 1;
      }
    }

    if (inputDiag) {
      inputsInfo.push({
        sampleId: item.sampleId,
        byteLength: inputDiag.byteLength,
        base64Length: inputDiag.base64Length,
        providerStatus: diag?.providerStatus
      });
    }
  }

  const largestInputs = inputsInfo
    .filter(i => i.byteLength !== undefined)
    .sort((a, b) => (b.byteLength || 0) - (a.byteLength || 0))
    .slice(0, 5);

  return {
    total: failedItems.length,
    byProviderStatus,
    byStatusCode,
    byMimeType,
    largestInputs
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

  if (item.responseDiagnostics) {
    compact.responseDiagnostics = { ...item.responseDiagnostics };
  }

  return compact;
}
