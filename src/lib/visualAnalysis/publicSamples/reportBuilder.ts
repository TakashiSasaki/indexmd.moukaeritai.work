import { PublicSampleBatchRunSummary, PublicSampleBatchRunItem } from "./batchTypes";

export function isNetworkFailure(item: PublicSampleBatchRunItem): boolean {
  return !item.success && item.failureKind === 'networkError';
}

export function isRateLimitFailure(item: PublicSampleBatchRunItem): boolean {
  return !item.success && item.failureKind === 'rateLimited';
}

export function isTransportOrResponseFailure(item: PublicSampleBatchRunItem): boolean {
  return !item.success && 
         !isNetworkFailure(item) &&
         !isRateLimitFailure(item) &&
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
         !isSchemaValidationFailure(item) &&
         !isModelParseFailure(item) &&
         !isTransportOrResponseFailure(item);
}

export function buildBatchReportForChat(batchSummary: PublicSampleBatchRunSummary) {
  return buildBatchDiagnosticReportForChat(batchSummary);
}

export function buildBatchDiagnosticReportForChat(batchSummary: PublicSampleBatchRunSummary) {
  const compactItems = batchSummary.items.map(item => buildCompactItem(item));

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
    generationFailureSummary: buildGenerationFailureSummary(batchSummary.items),
    apiResponseFailureSummary: buildApiResponseFailureSummary(batchSummary.items),
    parseFailureSummary: buildParseFailureSummary(batchSummary.items),
    networkFailureSummary: buildNetworkFailureSummary(batchSummary.items),
    validationFailureSummary: buildValidationFailureSummary(batchSummary.items),
    rateLimitSummary: buildRateLimitSummary(batchSummary.items),
    inputSizeSummary: buildInputSizeSummary(batchSummary.items),
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
    generationFailureSummary: buildGenerationFailureSummary(batchSummary.items),
    apiResponseFailureSummary: buildApiResponseFailureSummary(batchSummary.items),
    parseFailureSummary: buildParseFailureSummary(batchSummary.items),
    networkFailureSummary: buildNetworkFailureSummary(batchSummary.items),
    validationFailureSummary: buildValidationFailureSummary(batchSummary.items),
    rateLimitSummary: buildRateLimitSummary(batchSummary.items),
    inputSizeSummary: buildInputSizeSummary(batchSummary.items),
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
  const analysisRun = item.analysisRun ?? item.responseRaw?.analysisRun;
  const run = analysisRun?.metadata ?? analysisRun;
  
  const modelName = run?.model?.name || run?.execution?.usedModelName || run?.execution?.modelName || item.responseRaw?.usedModelName || "UNKNOWN";
  const providerFamily = run?.model?.providerFamily || run?.execution?.providerFamily || item.responseRaw?.providerFamily || "UNKNOWN";
  const structuredExecutionMode = run?.execution?.structuredExecutionMode || item.responseRaw?.effectiveStructuredExecutionMode || "UNKNOWN";
  const jsonMode = run?.execution?.jsonMode || item.responseRaw?.jsonMode || "UNKNOWN";
  const jsonRecovery = run?.execution?.jsonRecovery || item.responseRaw?.jsonRecovery;
  
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
    const issues = item.qualityIssues || [];
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
    const analysisRun = item.analysisRun || item.responseRaw?.analysisRun;
    
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
    
    const parseDiag = item.parseDiagnostics || item.responseRaw?.parseDiagnostics;
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

    const diag = item.generationDiagnostics;
    const inputDiag = item.inputDiagnostics;

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
    const run = item.analysisRun?.metadata ?? item.analysisRun;
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

    const inputDiag = item.inputDiagnostics as any;
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

      if (inputDiag.cacheSharedInFlight) {
        sharedInFlight++;
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
      writeErrors
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
  const failures = batchSummary.items.filter(item => !item.success || item.qualityStatus === 'invalid');
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
  
  const normDiag = item.normalizationDiagnostics ?? item.responseRaw?.normalizationDiagnostics ?? item.analysisRun?.normalizationDiagnostics;
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
  const report = {
    reportKind: "visualAnalysisPublicSampleItemReport",
    generatedAt: new Date().toISOString(),
    item
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
  if (item.qualityStatus) summary.qualityStatus = item.qualityStatus;
  if (item.qualityScore !== undefined) summary.qualityScore = item.qualityScore;
  
  if (item.qualityIssues && item.qualityIssues.length > 0) {
    summary.issues = item.qualityIssues.map((issue: any) => typeof issue === 'string' ? issue : issue.code || issue.type).filter(Boolean);
  }

  if (item.comparison) {
    summary.reviewStatus = item.comparison.reviewStatus;
    summary.expectedImageKind = item.responseRaw?.expectedMetadata?.imageKind || item.comparison.imageKind?.expected;
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

  const normDiag = item.normalizationDiagnostics ?? item.responseRaw?.normalizationDiagnostics ?? item.analysisRun?.normalizationDiagnostics;
  if (normDiag?.schemaVersionCorrected) {
    summary.schemaVersionCorrected = true;
    summary.canonicalSchemaVersionApplied = true;
    if (normDiag.originalSchemaVersion) summary.originalSchemaVersion = normDiag.originalSchemaVersion;
    if (normDiag.correctedSchemaVersion) summary.correctedSchemaVersion = normDiag.correctedSchemaVersion;
  }
  
  return summary;
}
