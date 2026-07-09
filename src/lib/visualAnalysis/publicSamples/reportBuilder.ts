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
  const success = item.record?.status?.success ?? item.success;
  const failureKind = item.record?.status?.failureKind ?? item.failureKind;
  return !success && failureKind === 'networkError';
}

export function isRateLimitFailure(item: PublicSampleBatchRunItem): boolean {
  const success = item.record?.status?.success ?? item.success;
  const failureKind = item.record?.status?.failureKind ?? item.failureKind;
  return !success && failureKind === 'rateLimited';
}

export function isProviderRateLimitFailure(item: PublicSampleBatchRunItem): boolean {
  const success = item.record?.status?.success ?? item.success;
  const failureKind = item.record?.status?.failureKind ?? item.failureKind;
  const genDiag = item.record?.diagnostics?.generation || item.generationDiagnostics;
  if (success) return false;
  return (
    failureKind === 'providerRateLimited' ||
    genDiag?.providerFailureKind === 'providerRateLimited' ||
    genDiag?.statusCode === 429 ||
    (genDiag as any)?.rateLimited === true
  );
}

export function isProviderQuotaFailure(item: PublicSampleBatchRunItem): boolean {
  const success = item.record?.status?.success ?? item.success;
  const failureKind = item.record?.status?.failureKind ?? item.failureKind;
  const genDiag = item.record?.diagnostics?.generation || item.generationDiagnostics;
  if (success) return false;
  return (
    failureKind === 'providerQuotaExceeded' ||
    genDiag?.providerFailureKind === 'providerQuotaExceeded' ||
    genDiag?.providerStatus === 'RESOURCE_EXHAUSTED' ||
    genDiag?.providerStatus === 'QUOTA_EXCEEDED' ||
    (genDiag as any)?.quotaExceeded === true
  );
}

export function isProviderQuotaOrRateLimitFailure(item: PublicSampleBatchRunItem): boolean {
  return isProviderRateLimitFailure(item) || isProviderQuotaFailure(item);
}

export function isTransportOrResponseFailure(item: PublicSampleBatchRunItem): boolean {
  const success = item.record?.status?.success ?? item.success;
  const failureKind = item.record?.status?.failureKind ?? item.failureKind;
  return !success && 
         !isNetworkFailure(item) &&
         !isRateLimitFailure(item) &&
         !isProviderRateLimitFailure(item) &&
         !isProviderQuotaFailure(item) &&
         (failureKind === 'nonJsonResponse' || 
          failureKind === 'invalidJsonResponse' || 
          failureKind === 'apiError' || 
          failureKind === 'startupHtml');
}

export function isModelParseFailure(item: PublicSampleBatchRunItem): boolean {
  const success = item.record?.status?.success ?? item.success;
  const failureKind = item.record?.status?.failureKind ?? item.failureKind;
  return !success && failureKind === 'jsonParseError';
}

export function isSchemaValidationFailure(item: PublicSampleBatchRunItem): boolean {
  const success = item.record?.status?.success ?? item.success;
  const failureKind = item.record?.status?.failureKind ?? item.failureKind;
  return !success && failureKind === 'schemaValidationError';
}

export function isProviderGenerationFailure(item: PublicSampleBatchRunItem): boolean {
  const success = item.record?.status?.success ?? item.success;
  return !success && 
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
  const record = item.record;
  const analysisRun = record?.analysisRun;
  const execution = analysisRun?.execution || record?.diagnostics?.execution;
  
  if (execution) {
    return {
      modelName: execution.modelName || "UNKNOWN",
      providerFamily: execution.providerFamily || "UNKNOWN",
      structuredExecutionMode: execution.structuredExecutionMode || "UNKNOWN",
      jsonMode: execution.jsonMode || "UNKNOWN",
      jsonRecovery: execution.jsonRecovery
    };
  }
  
  const run = analysisRun?.metadata ?? analysisRun;
  
  const modelName = run?.model?.name || run?.execution?.usedModelName || run?.execution?.modelName || "UNKNOWN";
  const providerFamily = run?.model?.providerFamily || run?.execution?.providerFamily || "UNKNOWN";
  const structuredExecutionMode = run?.execution?.structuredExecutionMode || "UNKNOWN";
  const jsonMode = run?.execution?.jsonMode || "UNKNOWN";
  const jsonRecovery = run?.execution?.jsonRecovery;
  
  return {
    modelName,
    providerFamily,
    structuredExecutionMode,
    jsonMode,
    jsonRecovery
  };
}

export function getItemFailureTaxonomy(item: PublicSampleBatchRunItem): string {
  if (item.record?.status?.success ?? item.success) return "success";
  
  if (isNetworkFailure(item)) return "networkError";
  if (isRateLimitFailure(item)) return "rateLimited";
  if (isProviderRateLimitFailure(item)) return "providerRateLimited";
  if (isProviderQuotaFailure(item)) return "providerQuotaExceeded";
  if (isTransportOrResponseFailure(item)) return "apiError";
  if (isModelParseFailure(item)) return "jsonParseError";
  if (isSchemaValidationFailure(item)) return "schemaValidationError";
  
  return item.record?.status?.failureKind || item.failureKind || "unknown";
}

function buildValidationFailureSummary(items: PublicSampleBatchRunItem[]) {
  const valFailures = items.filter(isSchemaValidationFailure);
  const byErrorCode: Record<string, number> = {};
  const byMessage: Record<string, number> = {};
  const samples: any[] = [];

  for (const item of valFailures) {
    const issues = item.record?.evaluation?.qualityIssues || [];
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
    const analysisRun = item.record?.analysisRun;
    
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
    
    const parseDiag = item.record?.diagnostics?.parse;
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
    const run = item.record?.analysisRun;
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
  const failures = batchSummary.items.filter(item => {
    const isSuccess = item.record?.status?.success ?? item.success;
    const isInvalid = item.record?.evaluation?.qualityStatus === 'invalid';
    return !isSuccess || isInvalid;
  });
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
  const record = item.record;
  const evaluation = record?.evaluation;
  const diagnostics = record?.diagnostics;
  const status = record?.status;

  const compact: any = {
    sampleId: item.sampleId,
    title: item.title,
    success: status?.success ?? item.success
  };

  if (record) {
    compact.record = {
      ...record,
      visualAnalysis: undefined // Omit for compact view
    };
  }

  if (status?.error || item.error) compact.error = status?.error || item.error;
  if (status?.failureKind || item.failureKind) compact.failureKind = status?.failureKind || item.failureKind;
  if (evaluation?.qualityStatus) compact.qualityStatus = evaluation.qualityStatus;
  if (evaluation?.qualityScore !== undefined) compact.qualityScore = evaluation.qualityScore;
  if (evaluation?.qualityIssues && evaluation.qualityIssues.length > 0) compact.qualityIssues = evaluation.qualityIssues;

  if (record?.assetMetadata) {
     compact.category = record.assetMetadata.category;
  }

  if (evaluation?.expectedMetadata) {
     compact.expected = evaluation.expectedMetadata;
  }
  
  const comparison = evaluation?.comparison;
  if (comparison) {
     compact.comparisonSummary = {
        imageKind: comparison.imageKind,
        categories: comparison.categories,
        labels: comparison.labels,
        visibleText: comparison.visibleText,
        overallStatus: comparison.overallStatus,
        reasons: comparison.reasons,
        reviewStatus: comparison.reviewStatus,
        reviewReasons: comparison.reviewReasons,
        reviewNotes: comparison.reviewNotes || [],
        coverage: comparison.coverage,
        optional: comparison.optional
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

  const visualAnalysis = record?.visualAnalysis;
  const vi = visualAnalysis?.visualInfo;
  const indexing = visualAnalysis?.indexing;
  const normalized = record?.analysisRun?.result?.normalized;

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

  if (diagnostics?.generation) {
    compact.generationDiagnostics = { ...diagnostics.generation };
  }

  if (diagnostics?.input) {
    compact.inputDiagnostics = diagnostics.input;
  }

  if (diagnostics?.parse) {
    compact.parseDiagnostics = { ...diagnostics.parse };
    delete compact.parseDiagnostics.rawOutputPreview;
    delete compact.parseDiagnostics.requestPreview;
  }
  
  const normDiag = diagnostics?.normalization;
  if (normDiag) {
    compact.normalizationDiagnostics = {
      schemaVersionCorrected: normDiag.schemaVersionCorrected,
      originalSchemaVersion: normDiag.originalSchemaVersion,
      correctedSchemaVersion: normDiag.correctedSchemaVersion,
      providerSchemaName: normDiag.providerSchemaName,
      providerSchemaVersion: normDiag.providerSchemaVersion,
      // Include all diagnostics if it's a failure
      ...(status?.success ? {} : normDiag)
    };
  }

  if (item.responseDiagnostics) {
    const includeBodyPreview = !(status?.success ?? item.success) && (
      (status?.failureKind ?? item.failureKind) === "nonJsonResponse" || 
      (status?.failureKind ?? item.failureKind) === "invalidJsonResponse" || 
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
  const record = item.record;
  const evaluation = record?.evaluation;
  const status = record?.status;
  const diagnostics = record?.diagnostics;

  const summary: any = {
    sampleId: item.sampleId,
    title: item.title,
    success: status?.success ?? item.success
  };

  if (status?.error || item.error) summary.error = status?.error || item.error;
  if (status?.failureKind || item.failureKind) summary.failureKind = status?.failureKind || item.failureKind;
  if (evaluation?.qualityStatus) summary.qualityStatus = evaluation.qualityStatus;
  if (evaluation?.qualityScore !== undefined) summary.qualityScore = evaluation.qualityScore;
  
  if (evaluation?.qualityIssues && evaluation.qualityIssues.length > 0) {
    summary.issues = evaluation.qualityIssues.map((issue: any) => typeof issue === 'string' ? issue : issue.code || issue.type).filter(Boolean);
  }

  const comparison = evaluation?.comparison;
  if (comparison) {
    summary.reviewStatus = comparison.reviewStatus;
    summary.expectedImageKind = evaluation.expectedMetadata?.imageKind || comparison.imageKind?.expected;
    summary.detectedImageKind = comparison.imageKind?.detected;
    summary.imageKindStatus = comparison.imageKind?.status;
    
    // Use the complete, structured comparison coverage
    summary.coverage = comparison.coverage;
    summary.coverageOverall = comparison.coverage?.overall?.ratio ?? 1.0;

    summary.missing = {
      categories: comparison.categories?.missing || [],
      labels: comparison.labels?.missing || [],
      visibleText: comparison.visibleText?.missing || []
    };

    if (comparison.reviewNotes && comparison.reviewNotes.length > 0) {
      summary.reviewNotes = comparison.reviewNotes;
    }
  }

  if (item.retryDiagnostics) {
    summary.retries = item.retryDiagnostics.attempts - 1;
    summary.retried = item.retryDiagnostics.retried;
  }

  const normDiag = diagnostics?.normalization;
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
    const record = item.record;
    const evaluation = record?.evaluation;
    const comparison = evaluation?.comparison;
    const coverage = comparison?.visibleTextCoverage || comparison?.coverage?.visibleText;
    
    // Attempt to read requested resolution
    const execution = record?.analysisRun?.execution || record?.diagnostics?.execution;
    const mediaResolutionRequested = execution?.mediaResolutionRequested || "unknown";

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
        sampleId: record?.assetMetadata?.sampleId || item.sampleId,
        title: record?.assetMetadata?.title || item.title,
        imageKind: evaluation?.expectedMetadata?.imageKind,
        expectedVisibleTextTotal: coverage.expectedTotal,
        visibleTextCovered: coverage.covered,
        visibleTextMissing: coverage.missing,
        visibleTextCoverageRatio: coverage.ratio,

        mediaResolutionRequested,
        mediaResolutionApplied: execution?.mediaResolutionApplied,
        mediaResolutionReason: execution?.mediaResolutionReason,

        processedDimensions: record?.technicalMetadata?.processedDimensions,
        processedByteLength: record?.technicalMetadata?.processedByteLength,
        analysisTargetLongEdge: record?.technicalMetadata?.analysisTargetLongEdge,

        possibleResolutionLimited,
        reasons: evaluation?.reviewReasons || []
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
