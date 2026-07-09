import { PublicSampleBatchRunSummary, PublicSampleBatchRunItem } from "./batchTypes";

import { summarizeExpectedComparisonCounts, summarizeReviewCounts } from "./compare";


export function getItemQualityStatus(item: PublicSampleBatchRunItem) {
  return item.record?.evaluation?.qualityStatus ?? (item as any).qualityStatus;
}

export function getItemQualityScore(item: PublicSampleBatchRunItem) {
  return item.record?.evaluation?.qualityScore ?? (item as any).qualityScore;
}

export function getItemQualityIssues(item: PublicSampleBatchRunItem) {
  return item.record?.evaluation?.qualityIssues ?? (item as any).qualityIssues ?? [];
}

export function getItemAnalysisRun(item: PublicSampleBatchRunItem) {
  return item.record?.analysisRun ?? (item as any).analysisRun;
}

export function getItemInputDiagnostics(item: PublicSampleBatchRunItem) {
  return item.record?.diagnostics?.input ?? (item as any).inputDiagnostics;
}

export function getItemGenerationDiagnostics(item: PublicSampleBatchRunItem) {
  return item.record?.diagnostics?.generation ?? (item as any).generationDiagnostics;
}

export function getItemParseDiagnostics(item: PublicSampleBatchRunItem) {
  return item.record?.diagnostics?.parse ?? (item as any).parseDiagnostics;
}

export function getItemNormalizationDiagnostics(item: PublicSampleBatchRunItem) {
  return item.record?.diagnostics?.normalization ?? (item as any).normalizationDiagnostics;
}

export function isNetworkFailure(item: PublicSampleBatchRunItem): boolean {
  return !item.success && item.failureKind === 'networkError';
}

export function isRateLimitFailure(item: PublicSampleBatchRunItem): boolean {
  return !item.success && item.failureKind === 'rateLimited';
}

export function isProviderRateLimitFailure(item: PublicSampleBatchRunItem): boolean {
  if (item.success) return false;
  return (
    item.failureKind === 'providerRateLimited' ||
    getItemGenerationDiagnostics(item)?.providerFailureKind === 'providerRateLimited' ||
    getItemGenerationDiagnostics(item)?.statusCode === 429 ||
    (getItemGenerationDiagnostics(item) as any)?.rateLimited === true
  );
}

export function isProviderQuotaFailure(item: PublicSampleBatchRunItem): boolean {
  if (item.success) return false;
  return (
    item.failureKind === 'providerQuotaExceeded' ||
    getItemGenerationDiagnostics(item)?.providerFailureKind === 'providerQuotaExceeded' ||
    getItemGenerationDiagnostics(item)?.providerStatus === 'RESOURCE_EXHAUSTED' ||
    getItemGenerationDiagnostics(item)?.providerStatus === 'QUOTA_EXCEEDED' ||
    (getItemGenerationDiagnostics(item) as any)?.quotaExceeded === true
  );
}

export function isProviderQuotaOrRateLimitFailure(item: PublicSampleBatchRunItem): boolean {
  return isProviderRateLimitFailure(item) || isProviderQuotaFailure(item);
}

export function isTransportOrResponseFailure(item: PublicSampleBatchRunItem): boolean {
  return !item.success &&
         !isNetworkFailure(item) &&
         !isRateLimitFailure(item) &&
         !isProviderRateLimitFailure(item) &&
         !isProviderQuotaFailure(item) &&
         (item.failureKind === 'nonJsonResponse' ||
          item.failureKind === 'invalidJsonResponse' ||
          item.failureKind === 'apiError' ||
          item.failureKind === 'startupHtml');
}

export function isModelParseFailure(item: PublicSampleBatchRunItem): boolean {
  return !item.success && item.failureKind === 'jsonParseError';
}

export function isSchemaValidationFailure(item: PublicSampleBatchRunItem): boolean {
  return !item.success && item.failureKind === 'schemaValidationError';
}

export function isProviderGenerationFailure(item: PublicSampleBatchRunItem): boolean {
  return !item.success &&
         !isNetworkFailure(item) &&
         !isRateLimitFailure(item) &&
         !isProviderRateLimitFailure(item) &&
         !isProviderQuotaFailure(item) &&
         !isSchemaValidationFailure(item) &&
         !isModelParseFailure(item) &&
         !isTransportOrResponseFailure(item);
}

export function buildBatchReportForChat(batchSummary: PublicSampleBatchRunSummary) {
  return buildBatchDiagnosticReportForChat(batchSummary);
}

export function buildBatchDiagnosticReportForChat(batchSummary: PublicSampleBatchRunSummary) {
  const compactItems = batchSummary.items.map(item => buildCompactItem(item));

  const expectedCounts = summarizeExpectedComparisonCounts(batchSummary.items);
  const reviewCounts = summarizeReviewCounts(batchSummary.items);

  const expectedConsistent = 
    expectedCounts.expectedComparisonPassCount === batchSummary.expectedComparisonPassCount &&
    expectedCounts.expectedComparisonWarningCount === batchSummary.expectedComparisonWarningCount &&
    expectedCounts.expectedComparisonFailCount === batchSummary.expectedComparisonFailCount;

  const reviewConsistent = 
    reviewCounts.reviewPassCount === batchSummary.reviewPassCount &&
    reviewCounts.reviewNeedsReviewCount === batchSummary.reviewNeedsReviewCount &&
    reviewCounts.reviewFailCount === batchSummary.reviewFailCount;

  const report = {
    reportKind: "visualAnalysisPublicSampleBatchDiagnostic",
    generatedAt: new Date().toISOString(),
    modelName: batchSummary.modelName,
    jsonMode: batchSummary.jsonMode,
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
    counterConsistency: {
      expectedComparison: {
        declared: {
          pass: batchSummary.expectedComparisonPassCount || 0,
          warning: batchSummary.expectedComparisonWarningCount || 0,
          fail: batchSummary.expectedComparisonFailCount || 0
        },
        recomputed: {
          pass: expectedCounts.expectedComparisonPassCount,
          warning: expectedCounts.expectedComparisonWarningCount,
          fail: expectedCounts.expectedComparisonFailCount
        },
        consistent: expectedConsistent
      },
      review: {
        declared: {
          pass: batchSummary.reviewPassCount || 0,
          needsReview: batchSummary.reviewNeedsReviewCount || 0,
          fail: batchSummary.reviewFailCount || 0
        },
        recomputed: {
          pass: reviewCounts.reviewPassCount,
          needsReview: reviewCounts.reviewNeedsReviewCount,
          fail: reviewCounts.reviewFailCount
        },
        consistent: reviewConsistent
      }
    },
    generationFailureSummary: buildGenerationFailureSummary(batchSummary.items),
    apiResponseFailureSummary: buildApiResponseFailureSummary(batchSummary.items),
    parseFailureSummary: buildParseFailureSummary(batchSummary.items),
    networkFailureSummary: buildNetworkFailureSummary(batchSummary.items),
    validationFailureSummary: buildValidationFailureSummary(batchSummary.items),
    rateLimitSummary: buildRateLimitSummary(batchSummary.items),
    providerQuotaSummary: buildProviderQuotaSummary(batchSummary.items),
    inputSizeSummary: buildInputSizeSummary(batchSummary.items),
    textHeavyEvaluation: buildTextHeavyEvaluationSummary(batchSummary.items),
    items: compactItems
  };

  return attachArtifactIntegrity(report, {
    artifactKind: "diagnostic",
    items: batchSummary.items,
    endSentinel: "END_OF_VISUAL_ANALYSIS_BATCH_DIAGNOSTIC"
  });
}

export function buildBatchSummaryReportForChat(batchSummary: PublicSampleBatchRunSummary) {
  const summaryItems = batchSummary.items.map(item => buildSummaryItem(item));

  const expectedCounts = summarizeExpectedComparisonCounts(batchSummary.items);
  const reviewCounts = summarizeReviewCounts(batchSummary.items);

  const expectedConsistent = 
    expectedCounts.expectedComparisonPassCount === batchSummary.expectedComparisonPassCount &&
    expectedCounts.expectedComparisonWarningCount === batchSummary.expectedComparisonWarningCount &&
    expectedCounts.expectedComparisonFailCount === batchSummary.expectedComparisonFailCount;

  const reviewConsistent = 
    reviewCounts.reviewPassCount === batchSummary.reviewPassCount &&
    reviewCounts.reviewNeedsReviewCount === batchSummary.reviewNeedsReviewCount &&
    reviewCounts.reviewFailCount === batchSummary.reviewFailCount;

  const report = {
    reportKind: "visualAnalysisPublicSampleBatchSummary",
    generatedAt: new Date().toISOString(),
    modelName: batchSummary.modelName,
    jsonMode: batchSummary.jsonMode,
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
    counterConsistency: {
      expectedComparison: {
        declared: {
          pass: batchSummary.expectedComparisonPassCount || 0,
          warning: batchSummary.expectedComparisonWarningCount || 0,
          fail: batchSummary.expectedComparisonFailCount || 0
        },
        recomputed: {
          pass: expectedCounts.expectedComparisonPassCount,
          warning: expectedCounts.expectedComparisonWarningCount,
          fail: expectedCounts.expectedComparisonFailCount
        },
        consistent: expectedConsistent
      },
      review: {
        declared: {
          pass: batchSummary.reviewPassCount || 0,
          needsReview: batchSummary.reviewNeedsReviewCount || 0,
          fail: batchSummary.reviewFailCount || 0
        },
        recomputed: {
          pass: reviewCounts.reviewPassCount,
          needsReview: reviewCounts.reviewNeedsReviewCount,
          fail: reviewCounts.reviewFailCount
        },
        consistent: reviewConsistent
      }
    },
    generationFailureSummary: buildGenerationFailureSummary(batchSummary.items),
    apiResponseFailureSummary: buildApiResponseFailureSummary(batchSummary.items),
    parseFailureSummary: buildParseFailureSummary(batchSummary.items),
    networkFailureSummary: buildNetworkFailureSummary(batchSummary.items),
    validationFailureSummary: buildValidationFailureSummary(batchSummary.items),
    rateLimitSummary: buildRateLimitSummary(batchSummary.items),
    providerQuotaSummary: buildProviderQuotaSummary(batchSummary.items),
    inputSizeSummary: buildInputSizeSummary(batchSummary.items),
    textHeavyEvaluation: buildTextHeavyEvaluationSummary(batchSummary.items),
    items: summaryItems
  };

  return attachArtifactIntegrity(report, {
    artifactKind: "summary",
    items: batchSummary.items,
    endSentinel: "END_OF_VISUAL_ANALYSIS_BATCH_SUMMARY"
  });
}

function buildApiResponseFailureSummary(items: PublicSampleBatchRunItem[]) {
  const failedItems = items.filter(isTransportOrResponseFailure);
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

  for (const item of failedItems) {
    const diag = item.responseDiagnostics!;
    
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

  return {
    total: failedItems.length,
    byStatus,
    byContentType,
    byHtmlTitle,
    samples,
  };
}

function buildNetworkFailureSummary(items: PublicSampleBatchRunItem[]) {
  const networkFailures = items.filter(isNetworkFailure);
  const samples = networkFailures.map(item => ({
    sampleId: item.sampleId,
    error: item.error || "Unknown network error",
    attempts: item.retryDiagnostics?.attempts ?? 1,
    retried: item.retryDiagnostics?.retried ?? false,
    finalFailureKind: item.retryDiagnostics?.finalFailureKind || item.failureKind
  }));
  let totalAttempts = 0;
  let totalRetried = 0;
  for (const item of networkFailures) {
    totalAttempts += item.retryDiagnostics?.attempts ?? 1;
    if (item.retryDiagnostics?.retried) totalRetried++;
  }
  return {
    total: networkFailures.length,
    attempts: totalAttempts,
    retried: totalRetried,
    samples
  };
}

export function getItemExecutionMetadata(item: any) {
  if (item.execution) {
    return {
      modelName: item.execution.modelName || "UNKNOWN",
      providerFamily: item.execution.providerFamily || "UNKNOWN",
      structuredExecutionMode: item.execution.structuredExecutionMode || "UNKNOWN",
      jsonMode: item.execution.jsonMode || "UNKNOWN",
      jsonRecovery: item.execution.jsonRecovery
    };
  }
  const analysisRun = getItemAnalysisRun(item) ?? item.record?.analysisRun ?? (item as any).responseRaw?.analysisRun;
  const run = analysisRun?.metadata ?? analysisRun;
  
  const modelName = run?.model?.name || run?.execution?.usedModelName || run?.execution?.modelName || item.record?.analysisRun?.execution?.modelName || (item as any).responseRaw?.usedModelName || "UNKNOWN";
  const providerFamily = run?.model?.providerFamily || run?.execution?.providerFamily || item.record?.analysisRun?.execution?.providerFamily || (item as any).responseRaw?.providerFamily || "UNKNOWN";
  const structuredExecutionMode = run?.execution?.structuredExecutionMode || item.record?.analysisRun?.execution?.structuredExecutionMode || (item as any).responseRaw?.effectiveStructuredExecutionMode || "UNKNOWN";
  const jsonMode = run?.execution?.jsonMode || item.record?.analysisRun?.execution?.jsonMode || (item as any).responseRaw?.jsonMode || "UNKNOWN";
  const jsonRecovery = run?.execution?.jsonRecovery || item.record?.analysisRun?.execution?.jsonRecovery || (item as any).responseRaw?.jsonRecovery;
  
  return {
    modelName,
    providerFamily,
    structuredExecutionMode,
    jsonMode,
    jsonRecovery
  };
}

function buildValidationFailureSummary(items: PublicSampleBatchRunItem[]) {
  const valFailures = items.filter(isSchemaValidationFailure);
  const byErrorCode: Record<string, number> = {};
  const byMessage: Record<string, number> = {};
  const samples: any[] = [];

  for (const item of valFailures) {
    const issues = getItemQualityIssues(item) || [];
    for (const issue of issues) {
      const code = issue.code || "SCHEMA_ERROR";
      byErrorCode[code] = (byErrorCode[code] || 0) + 1;
      const msg = issue.message || "Schema mismatch";
      byMessage[msg] = (byMessage[msg] || 0) + 1;
    }

    const exec = getItemExecutionMetadata(item);

    samples.push({
      sampleId: item.sampleId,
      modelName: exec.modelName,
      jsonMode: exec.jsonMode,
      providerFamily: exec.providerFamily,
      issues: issues.map((i: any) => i.message),
      jsonRecovery: exec.jsonRecovery
    });
  }

  return {
    total: valFailures.length,
    byErrorCode,
    byMessage,
    samples
  };
}

function buildRateLimitSummary(items: PublicSampleBatchRunItem[]) {
  const rateLimitedItems = items.filter(isRateLimitFailure);
  const samples = rateLimitedItems.map(item => ({
    sampleId: item.sampleId,
    attempts: item.retryDiagnostics?.attempts ?? 1,
    retried: item.retryDiagnostics?.retried ?? false,
    retryEvents: item.retryDiagnostics?.events || []
  }));
  let totalAttempts = 0;
  for (const item of rateLimitedItems) {
    totalAttempts += item.retryDiagnostics?.attempts ?? 1;
  }
  return {
    total429: rateLimitedItems.length,
    totalAttempts,
    samples
  };
}

function buildProviderQuotaSummary(items: PublicSampleBatchRunItem[]) {
  const quotaFailures = items.filter(isProviderQuotaOrRateLimitFailure);
  const byProviderStatus: Record<string, number> = {};
  const byStatusCode: Record<string, number> = {};
  const byModelName: Record<string, number> = {};
  const samples: Array<{
    sampleId: string;
    modelName: string;
    failureKind: string;
    statusCode?: number;
    providerStatus?: string;
    rawMessageSummary?: string;
    apiRetryCount?: number;
    retryAfterMs?: number;
    retryAfterReason?: string;
    attemptsCount: number;
  }> = [];

  let totalAttempts = 0;
  for (const item of quotaFailures) {
    const diag = getItemGenerationDiagnostics(item);
    const exec = getItemExecutionMetadata(item);
    
    const provStatus = diag?.providerStatus || "UNKNOWN";
    byProviderStatus[provStatus] = (byProviderStatus[provStatus] || 0) + 1;
    
    const statusCodeStr = diag?.statusCode ? String(diag.statusCode) : "UNKNOWN";
    byStatusCode[statusCodeStr] = (byStatusCode[statusCodeStr] || 0) + 1;

    const modelName = exec.modelName || diag?.modelName || "UNKNOWN";
    byModelName[modelName] = (byModelName[modelName] || 0) + 1;

    const attemptsCount = diag?.attempts?.length || 1;
    totalAttempts += attemptsCount;

    samples.push({
      sampleId: item.sampleId,
      modelName,
      failureKind: item.failureKind || "providerRateLimited",
      statusCode: diag?.statusCode,
      providerStatus: diag?.providerStatus,
      rawMessageSummary: diag?.rawMessageSummary,
      apiRetryCount: diag?.apiRetryCount,
      retryAfterMs: diag?.retryAfterMs,
      retryAfterReason: diag?.retryAfterReason,
      attemptsCount
    });
  }

  return {
    total: quotaFailures.length,
    totalAttempts,
    byProviderStatus,
    byStatusCode,
    byModelName,
    samples
  };
}

function buildParseFailureSummary(items: PublicSampleBatchRunItem[]) {
  const parseFailures = items.filter(isModelParseFailure);
  
  const byModelName: Record<string, number> = {};
  const byProviderFamily: Record<string, number> = {};
  const byStructuredExecutionMode: Record<string, number> = {};
  const byJsonMode: Record<string, number> = {};
  const samples: Array<{
    sampleId: string;
    parseErrorMessage?: string;
    rawOutputLength?: number;
    recovery?: {
      localRepairAttempted: boolean;
      localRepairSucceeded: boolean;
      modelRetryAttempted: boolean;
      modelRetrySucceeded: boolean;
      retryCount: number;
      finalParseMode?: string;
    };
  }> = [];
  
  for (const item of parseFailures) {
    const analysisRun = getItemAnalysisRun(item) || (item as any).responseRaw?.analysisRun;
    
    const model =
      analysisRun?.model?.name ??
      analysisRun?.execution?.usedModelName ??
      "UNKNOWN";

    const family =
      analysisRun?.model?.providerFamily ??
      analysisRun?.execution?.providerFamily ??
      "UNKNOWN";

    const execMode =
      analysisRun?.execution?.structuredExecutionMode ??
      analysisRun?.execution?.effectiveStructuredExecutionMode ??
      "UNKNOWN";
      
    const jsonMode =
      analysisRun?.execution?.jsonMode ??
      "UNKNOWN";
    
    byModelName[model] = (byModelName[model] || 0) + 1;
    byProviderFamily[family] = (byProviderFamily[family] || 0) + 1;
    byStructuredExecutionMode[execMode] = (byStructuredExecutionMode[execMode] || 0) + 1;
    byJsonMode[jsonMode] = (byJsonMode[jsonMode] || 0) + 1;
    
    const parseDiag = getItemParseDiagnostics(item) || (item as any).responseRaw?.parseDiagnostics;
    const lastAttempt = parseDiag?.attempts?.[parseDiag.attempts.length - 1];
    
    const jsonRecovery = analysisRun?.execution?.jsonRecovery;
    const localRepairAttempted = jsonRecovery?.localRepairAttempted ?? false;
    const localRepairSucceeded = jsonRecovery?.localRepairSucceeded ?? false;
    const modelRetryAttempted = jsonRecovery?.modelRetryAttempted ?? false;
    const modelRetrySucceeded = jsonRecovery?.modelRetrySucceeded ?? false;
    const retryCount = jsonRecovery?.retryCount ?? 0;
    const finalParseMode = jsonRecovery?.finalParseMode;
    
    samples.push({
      sampleId: item.sampleId,
      parseErrorMessage: lastAttempt?.errorMessage || "Unknown parse error",
      rawOutputLength: parseDiag?.rawOutputLength,
      recovery: {
        localRepairAttempted,
        localRepairSucceeded,
        modelRetryAttempted,
        modelRetrySucceeded,
        retryCount,
        finalParseMode
      }
    });
  }
  
  return {
    total: parseFailures.length,
    byModelName,
    byProviderFamily,
    byStructuredExecutionMode,
    byJsonMode,
    samples
  };
}

function buildGenerationFailureSummary(items: PublicSampleBatchRunItem[]) {
  const failedItems = items.filter(isProviderGenerationFailure);
  const byProviderStatus: Record<string, number> = {};
  const byStatusCode: Record<string, number> = {};
  const byMimeType: Record<string, number> = {};
  
  const inputsInfo: Array<{
    sampleId: string;
    byteLength?: number;
    base64Length?: number;
    providerStatus?: string;
  }> = [];

  for (const item of failedItems) {

    const diag = getItemGenerationDiagnostics(item);
    const inputDiag = getItemInputDiagnostics(item);

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

      inputsInfo.push({
        sampleId: item.sampleId,
        byteLength: inputDiag.byteLength,
        base64Length: inputDiag.base64Length,
        providerStatus: diag?.providerStatus
      });
    } else {
      byMimeType["UNKNOWN"] = (byMimeType["UNKNOWN"] || 0) + 1;
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

function buildInputSizeSummary(items: PublicSampleBatchRunItem[]) {
  const inputsInfo: Array<any> = [];

  let overTargetInputs = 0;
  let overHardCapInputs = 0;
  let resizedInputs = 0;
  let recompressedInputs = 0;
  let reencodedInputs = 0;
  let imageUrlFallbackInputs = 0;
  let totalOriginalBytes = 0;
  let totalProcessedBytes = 0;
  let totalBase64Bytes = 0;
  let maxOriginalBytes = 0;
  let maxProcessedBytes = 0;
  let inputsWithOriginalBytes = 0;
  
  let mediaResolutionHighRequested = 0;
  let mediaResolutionMediumRequested = 0;
  let mediaResolutionConfigured = 0;
  let mediaResolutionProviderAccepted = 0;
  let mediaResolutionApplied = 0;
  let mediaResolutionUnsupported = 0;
  let mediaResolutionFallbackUsed = 0;

  let memoryHits = 0;
  let diskHits = 0;
  let misses = 0;
  let stored = 0;
  let sharedInFlight = 0;
  let readErrors = 0;
  let writeErrors = 0;

  for (const item of items) {
    const run = getItemAnalysisRun(item)?.metadata ?? getItemAnalysisRun(item);
    if (run && run.generationConfig) {
      const requested = run.generationConfig.mediaResolutionRequested;
      if (requested === 'HIGH') mediaResolutionHighRequested++;
      if (requested === 'MEDIUM') mediaResolutionMediumRequested++;
      
      if (run.generationConfig.mediaResolutionConfigured) {
        mediaResolutionConfigured++;
      }
      if (run.generationConfig.mediaResolutionProviderAccepted) {
        mediaResolutionProviderAccepted++;
      }
      
      const applied = run.generationConfig.mediaResolutionApplied !== undefined
        ? run.generationConfig.mediaResolutionApplied
        : (requested ? true : false);
      if (applied) mediaResolutionApplied++;

      if (run.generationConfig.mediaResolutionUnsupportedReason && run.generationConfig.mediaResolutionUnsupportedReason !== "") {
        mediaResolutionUnsupported++;
      }
      if (run.generationConfig.mediaResolutionFallbackUsed) {
        mediaResolutionFallbackUsed++;
      }
    }

    const inputDiag = getItemInputDiagnostics(item) as any;
    if (inputDiag) {
      inputsInfo.push({
        sampleId: item.sampleId,
        originalByteLength: inputDiag.originalByteLength || inputDiag.byteLength,
        processedByteLength: inputDiag.processedByteLength || inputDiag.byteLength,
        base64Length: inputDiag.base64Length,
        success: item.success,
        failureKind: item.failureKind
      });

      if (inputDiag.analysisSourceUrlKind === "imageUrlFallback") {
        imageUrlFallbackInputs++;
      }

      if (inputDiag.resized) resizedInputs++;
      if (inputDiag.recompressed) recompressedInputs++;
      if (inputDiag.reencoded) reencodedInputs++;

      if (inputDiag.originalByteLength) {
        totalOriginalBytes += inputDiag.originalByteLength;
        if (inputDiag.originalByteLength > maxOriginalBytes) {
          maxOriginalBytes = inputDiag.originalByteLength;
        }
        inputsWithOriginalBytes++;
      }

      const effectiveProcessedBytes = inputDiag.processedByteLength || inputDiag.byteLength;
      if (effectiveProcessedBytes) {
        totalProcessedBytes += effectiveProcessedBytes;
        if (effectiveProcessedBytes > maxProcessedBytes) {
          maxProcessedBytes = effectiveProcessedBytes;
        }
      }

      if (inputDiag.base64Length) {
        totalBase64Bytes += inputDiag.base64Length;
      }

      const checkBytes = inputDiag.processedByteLength || inputDiag.byteLength;
      if (inputDiag.analysisHardCapBytes && checkBytes > inputDiag.analysisHardCapBytes) {
        overHardCapInputs++;
      } else if (inputDiag.analysisTargetBytes && checkBytes > inputDiag.analysisTargetBytes) {
        overTargetInputs++;
      }

      // Aggregate Cache Diagnostics
      if (inputDiag.cacheSharedInFlight) {
        sharedInFlight++;
      } else {
        if (inputDiag.cacheLayer === "memory") {
          memoryHits++;
        } else if (inputDiag.cacheLayer === "disk") {
          diskHits++;
        } else if (inputDiag.cacheLayer === "miss") {
          misses++;
        }

        if (inputDiag.cacheStored) {
          stored++;
        }
      }

      if (inputDiag.cacheReadError) {
        readErrors++;
      }

      if (inputDiag.cacheWriteError) {
        writeErrors++;
      }
    }
  }

  const largestProcessedInputs = [...inputsInfo]
    .filter(i => i.processedByteLength !== undefined)
    .sort((a, b) => (b.processedByteLength || 0) - (a.processedByteLength || 0))
    .slice(0, 5);
    
  const largestOriginalInputs = [...inputsInfo]
    .filter(i => i.originalByteLength !== undefined)
    .sort((a, b) => (b.originalByteLength || 0) - (a.originalByteLength || 0))
    .slice(0, 5);

  const totalBytesSaved = totalOriginalBytes > 0 ? (totalOriginalBytes - totalProcessedBytes) : 0;
  const averageReductionRatio = inputsWithOriginalBytes > 0 && totalOriginalBytes > 0 
    ? totalProcessedBytes / totalOriginalBytes 
    : 1;

  return {
    largestProcessedInputs,
    largestOriginalInputs,
    overTargetInputs,
    overHardCapInputs,
    resizedInputs,
    recompressedInputs,
    reencodedInputs,
    imageUrlFallbackInputs,
    totalOriginalBytes,
    totalProcessedBytes,
    totalBase64Bytes,
    maxOriginalBytes,
    maxProcessedBytes,
    totalBytesSaved,
    averageReductionRatio,
    inputsWithOriginalBytes,
    cache: {
      memoryHits,
      diskHits,
      misses,
      stored,
      sharedInFlight,
      readErrors,
      writeErrors,
      note: "sharedInFlight means the request reused an in-progress fetch/optimization for the same cache key."
    },
    mediaResolution: {
      highRequested: mediaResolutionHighRequested,
      mediumRequested: mediaResolutionMediumRequested,
      configured: mediaResolutionConfigured,
      providerAccepted: mediaResolutionProviderAccepted,
      applied: mediaResolutionApplied,
      unsupported: mediaResolutionUnsupported,
      fallbackUsed: mediaResolutionFallbackUsed
    }
  };
}

export function buildFailuresOnlyReport(batchSummary: PublicSampleBatchRunSummary) {
  const failures = batchSummary.items.filter(item => !item.success || getItemQualityStatus(item) === 'invalid');
  const compactItems = failures.map(item => buildCompactItem(item));

  const report = {
    reportKind: "visualAnalysisPublicSampleFailuresReport",
    generatedAt: new Date().toISOString(),
    modelName: batchSummary.modelName,
    jsonMode: batchSummary.jsonMode,
    totalFailures: failures.length,
    items: compactItems
  };

  return attachArtifactIntegrity(report, {
    artifactKind: "failures",
    items: failures,
    endSentinel: "END_OF_VISUAL_ANALYSIS_FAILURES_ONLY"
  });
}

function buildCompactItem(item: PublicSampleBatchRunItem) {
  const compact: any = {
    sampleId: item.sampleId,
    title: item.title,
    success: item.success
  };


  if (item.record) {
    compact.record = {
      ...item.record,
      visualAnalysis: undefined // Omit for compact view
    };
  }

  if (item.error) compact.error = item.error;
  if (item.failureKind) compact.failureKind = item.failureKind;
  if (getItemQualityStatus(item)) compact.qualityStatus = getItemQualityStatus(item);
  if (getItemQualityScore(item) !== undefined) compact.qualityScore = getItemQualityScore(item);
  if (getItemQualityIssues(item) && getItemQualityIssues(item).length > 0) compact.qualityIssues = getItemQualityIssues(item);

  const assetMetadata = item.record?.assetMetadata || (item as any).responseRaw?.sampleMetadata;
  if (assetMetadata) {
     compact.category = assetMetadata.category;
     compact.licenseName = assetMetadata.licenseName;
  }

  const expectedMetadata = item.record?.evaluation?.expectedMetadata || (item as any).responseRaw?.expectedMetadata;
  if (expectedMetadata) {
     compact.expected = expectedMetadata;
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
        reviewReasons: item.comparison.reviewReasons,
        reviewNotes: item.comparison.reviewNotes || [],
        coverage: item.comparison.coverage,
        optional: item.comparison.optional
     };
  }

  const exec = getItemExecutionMetadata(item);
  compact.execution = {
    modelName: exec.modelName,
    providerFamily: exec.providerFamily,
    structuredExecutionMode: exec.structuredExecutionMode,
    jsonMode: exec.jsonMode,
    jsonRecovery: exec.jsonRecovery
  };

  const visualAnalysis = item.record?.visualAnalysis || (item as any).responseRaw?.visualAnalysis;
  const vi = visualAnalysis?.visualInfo;
  const indexing = visualAnalysis?.indexing;
  const normalized = getItemAnalysisRun(item)?.result?.normalized;

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

  if (getItemGenerationDiagnostics(item)) {
    compact.generationDiagnostics = { ...getItemGenerationDiagnostics(item) };
  }

  if (getItemInputDiagnostics(item)) {
    compact.inputDiagnostics = getItemInputDiagnostics(item);
  }

  if (getItemParseDiagnostics(item)) {
    compact.parseDiagnostics = { ...getItemParseDiagnostics(item) };
    delete compact.parseDiagnostics.rawOutputPreview;
    delete compact.parseDiagnostics.requestPreview;
  }
  
  const normDiag = getItemNormalizationDiagnostics(item) ?? item.record?.diagnostics?.normalization ?? (item as any).responseRaw?.normalizationDiagnostics ?? getItemAnalysisRun(item)?.normalizationDiagnostics;
  if (normDiag) {
    compact.normalizationDiagnostics = {
      schemaVersionCorrected: normDiag.schemaVersionCorrected,
      originalSchemaVersion: normDiag.originalSchemaVersion,
      correctedSchemaVersion: normDiag.correctedSchemaVersion,
      providerSchemaName: normDiag.providerSchemaName,
      providerSchemaVersion: normDiag.providerSchemaVersion,
      // Include all diagnostics if it's a failure
      ...(item.success ? {} : normDiag)
    };
  }

  if (item.responseDiagnostics) {
    const includeBodyPreview = !item.success && (
      item.failureKind === "nonJsonResponse" ||
      item.failureKind === "invalidJsonResponse" ||
      item.responseDiagnostics.looksLikeHtml === true
    );
    
    compact.responseDiagnostics = {
      ...item.responseDiagnostics,
      bodyPreview: includeBodyPreview ? item.responseDiagnostics.bodyPreview : undefined
    };
    
    if (compact.responseDiagnostics.bodyPreview === undefined) {
      delete compact.responseDiagnostics.bodyPreview;
    }
  }

  if (item.retryDiagnostics) {
    compact.retryDiagnostics = item.retryDiagnostics;
  }

  return compact;
}

export function buildFullItemReport(item: PublicSampleBatchRunItem) {
  // Strip responseRaw from the full report
  const { responseRaw, ...cleanItem } = item as any;
  const report = {
    reportKind: "visualAnalysisPublicSampleItemReport",
    generatedAt: new Date().toISOString(),
    item: cleanItem as PublicSampleBatchRunItem
  };

  return attachArtifactIntegrity(report, {
    artifactKind: "item",
    items: [item],
    endSentinel: "END_OF_VISUAL_ANALYSIS_ITEM_REPORT"
  });
}

function attachArtifactIntegrity(report: any, options: {
  artifactKind: "summary" | "diagnostic" | "failures" | "full" | "item";
  items: PublicSampleBatchRunItem[];
  endSentinel: string;
}) {
  const itemCount = options.items.length;
  const firstSampleId = options.items[0]?.sampleId || "NONE";
  const lastSampleId = options.items[itemCount - 1]?.sampleId || "NONE";

  report.artifactIntegrity = {
    artifactKind: options.artifactKind,
    itemCount,
    firstSampleId,
    lastSampleId,
    endSentinel: options.endSentinel
  };
  return report;
}

function buildSummaryItem(item: PublicSampleBatchRunItem) {
  const summary: any = {
    sampleId: item.sampleId,
    title: item.title,
    success: item.success
  };

  if (item.error) summary.error = item.error;
  if (item.failureKind) summary.failureKind = item.failureKind;
  if (getItemQualityStatus(item)) summary.qualityStatus = getItemQualityStatus(item);
  if (getItemQualityScore(item) !== undefined) summary.qualityScore = getItemQualityScore(item);
  
  if (getItemQualityIssues(item) && getItemQualityIssues(item).length > 0) {
    summary.issues = getItemQualityIssues(item).map((issue: any) => typeof issue === 'string' ? issue : issue.code || issue.type).filter(Boolean);
  }

  if (item.comparison) {
    summary.reviewStatus = item.comparison.reviewStatus;
    summary.expectedImageKind = item.record?.evaluation?.expectedMetadata?.imageKind || item.comparison.imageKind?.expected;
    summary.detectedImageKind = item.comparison.imageKind?.detected;
    summary.imageKindStatus = item.comparison.imageKind?.status;
    
    // Use the complete, structured comparison coverage
    summary.coverage = item.comparison.coverage;
    summary.coverageOverall = item.comparison.coverage?.overall?.ratio ?? 1.0;

    summary.missing = {
      categories: item.comparison.categories?.missing || [],
      labels: item.comparison.labels?.missing || [],
      visibleText: item.comparison.visibleText?.missing || []
    };

    if (item.comparison.reviewNotes && item.comparison.reviewNotes.length > 0) {
      summary.reviewNotes = item.comparison.reviewNotes;
    }
  }

  if (item.retryDiagnostics) {
    summary.retries = item.retryDiagnostics.attempts - 1;
    summary.retried = item.retryDiagnostics.retried;
  }

  const normDiag = getItemNormalizationDiagnostics(item) ?? item.record?.diagnostics?.normalization ?? (item as any).responseRaw?.normalizationDiagnostics ?? getItemAnalysisRun(item)?.normalizationDiagnostics;
  if (normDiag?.schemaVersionCorrected) {
    summary.schemaVersionCorrected = true;
    summary.canonicalSchemaVersionApplied = true;
    if (normDiag.originalSchemaVersion) summary.originalSchemaVersion = normDiag.originalSchemaVersion;
    if (normDiag.correctedSchemaVersion) summary.correctedSchemaVersion = normDiag.correctedSchemaVersion;
  }
  
  return summary;
}
export function buildTextHeavyEvaluationSummary(items: any[]) {
  let expectedVisibleTextTotal = 0;
  let visibleTextCovered = 0;
  let textMissing = 0;
  let itemsWithTextExpectation = 0;
  let possibleResolutionLimitedCount = 0;
  
  let highRequested = 0;
  let mediumRequested = 0;
  let unknown = 0;

  const samples = [];
  
  for (const item of items) {
    const coverage = item.comparison?.coverage?.visibleText;
    
    // Attempt to read requested resolution
    const mediaResolutionRequested =
      item.record?.analysisRun?.metadata?.generationConfig?.mediaResolutionRequested ||
      item.record?.analysisRun?.generationConfig?.mediaResolutionRequested ||
      getItemAnalysisRun(item)?.metadata?.generationConfig?.mediaResolutionRequested ||
      getItemAnalysisRun(item)?.generationConfig?.mediaResolutionRequested ||
      "unknown";

    if (mediaResolutionRequested === "HIGH") highRequested++;
    else if (mediaResolutionRequested === "MEDIUM") mediumRequested++;
    else unknown++;
    
    if (coverage && coverage.expectedTotal > 0) {
      itemsWithTextExpectation++;
      expectedVisibleTextTotal += coverage.expectedTotal;
      visibleTextCovered += coverage.covered;
      textMissing += coverage.missing;

      const possibleResolutionLimited = coverage.missing > 0 && mediaResolutionRequested !== "HIGH";
      if (possibleResolutionLimited) {
        possibleResolutionLimitedCount++;
      }

      samples.push({
        sampleId: item.sampleMetadata?.id || item.sampleId,
        title: item.sampleMetadata?.title,
        imageKind: item.expectedMetadata?.imageKind || item.sampleMetadata?.expectedImageKind,
        expectedVisibleTextTotal: coverage.expectedTotal,
        visibleTextCovered: coverage.covered,
        visibleTextMissing: coverage.missing,
        visibleTextCoverageRatio: coverage.ratio,

        mediaResolutionRequested,
        mediaResolutionApplied: getItemGenerationDiagnostics(item)?.mediaResolutionApplied,
        mediaResolutionReason: getItemGenerationDiagnostics(item)?.mediaResolutionReason,

        processedDimensions: getItemInputDiagnostics(item)?.processedDimensions || getItemInputDiagnostics(item)?.dimensions,
        processedByteLength: getItemInputDiagnostics(item)?.processedByteLength || getItemInputDiagnostics(item)?.byteLength,
        analysisTargetLongEdge: getItemInputDiagnostics(item)?.analysisTargetLongEdge,

        possibleResolutionLimited,
        reasons: item.comparison?.reviewReasons || []
      });
    }
  }

  const ratio = expectedVisibleTextTotal > 0 ? parseFloat((visibleTextCovered / expectedVisibleTextTotal).toFixed(2)) : 1.0;

  return {
    itemsWithTextExpectation,
    expectedVisibleTextTotal,
    visibleTextCovered,
    textMissing,
    ratio,
    mediaResolution: {
      highRequested,
      mediumRequested,
      unknown
    },
    possibleResolutionLimitedCount,
    samples
  };
}

export interface BatchInvariantResult {
  valid: boolean;
  issues: string[];
}

export function validateBatchRunInvariants(batchSummary: PublicSampleBatchRunSummary): BatchInvariantResult {
  const issues: string[] = [];

  for (const item of batchSummary.items) {
    if (item.success) {
      if (!item.comparison) {
        issues.push(`Item ${item.sampleId} is successful but missing a comparison object.`);
      } else {
        const comp = item.comparison;
        if (!comp.overallStatus || !['pass', 'warning', 'fail'].includes(comp.overallStatus)) {
          issues.push(`Item ${item.sampleId} comparison overallStatus is invalid: ${comp.overallStatus}`);
        }
        if (!comp.coverage) {
          issues.push(`Item ${item.sampleId} comparison missing coverage field.`);
        } else {
          const visibleText = comp.coverage.visibleText;
          if (visibleText) {
            const { expectedTotal, covered, missing, ratio } = visibleText;
            if (typeof expectedTotal !== 'number' || typeof covered !== 'number' || typeof missing !== 'number') {
              issues.push(`Item ${item.sampleId} comparison.coverage.visibleText has invalid non-numeric fields.`);
            } else if (expectedTotal !== covered + missing) {
              issues.push(`Item ${item.sampleId} comparison.coverage.visibleText expectedTotal (${expectedTotal}) does not match covered (${covered}) + missing (${missing}).`);
            }
          }
        }
      }
    }
  }

  const textHeavy = buildTextHeavyEvaluationSummary(batchSummary.items);
  let recomputedExpectedTotal = 0;
  let recomputedCovered = 0;
  let recomputedMissing = 0;
  let recomputedItemsWithText = 0;

  for (const item of batchSummary.items) {
    const visibleText = item.comparison?.coverage?.visibleText;
    if (visibleText && visibleText.expectedTotal > 0) {
      recomputedItemsWithText++;
      recomputedExpectedTotal += visibleText.expectedTotal;
      recomputedCovered += visibleText.covered;
      recomputedMissing += visibleText.missing;
    }
  }

  if (textHeavy.itemsWithTextExpectation !== recomputedItemsWithText) {
    issues.push(`TextHeavy items count mismatch: expected ${recomputedItemsWithText}, got ${textHeavy.itemsWithTextExpectation}`);
  }
  if (textHeavy.expectedVisibleTextTotal !== recomputedExpectedTotal) {
    issues.push(`TextHeavy expected visible text total mismatch: expected ${recomputedExpectedTotal}, got ${textHeavy.expectedVisibleTextTotal}`);
  }
  if (textHeavy.visibleTextCovered !== recomputedCovered) {
    issues.push(`TextHeavy visible text covered mismatch: expected ${recomputedCovered}, got ${textHeavy.visibleTextCovered}`);
  }
  if (textHeavy.textMissing !== recomputedMissing) {
    issues.push(`TextHeavy visible text missing mismatch: expected ${recomputedMissing}, got ${textHeavy.textMissing}`);
  }

  const recomputedRatio = recomputedExpectedTotal > 0 ? parseFloat((recomputedCovered / recomputedExpectedTotal).toFixed(2)) : 1.0;
  if (Math.abs(textHeavy.ratio - recomputedRatio) > 0.001) {
    issues.push(`TextHeavy ratio mismatch: expected ${recomputedRatio}, got ${textHeavy.ratio}`);
  }

  return {
    valid: issues.length === 0,
    issues
  };
}
