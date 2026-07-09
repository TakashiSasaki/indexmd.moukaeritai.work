import { PublicSampleBatchRunSummary, PublicSampleBatchRunItem } from "./batchTypes";

import { summarizeExpectedComparisonCounts, summarizeReviewCounts } from "./compare";

export function normalizeLegacyBatchRunItem(item: any): PublicSampleBatchRunItem {
  if (!item) return item;
  if (item.record && !item.responseRaw) return item;

  const responseRaw = item.responseRaw || {};
  const record = item.record || {};
  const assetMetadata = record.assetMetadata || responseRaw.sampleMetadata || {};
  const evaluation = record.evaluation || {};
  const expectedMetadata = evaluation.expectedMetadata || responseRaw.expectedMetadata || {};
  const analysisRun = record.analysisRun || responseRaw.analysisRun || (item.execution ? { execution: item.execution } : {});
  const diagnostics = record.diagnostics || {};

  const finalRecord = {
    ...record,
    assetMetadata: {
      id: assetMetadata.id || item.sampleId,
      title: assetMetadata.title || item.title,
      category: assetMetadata.category || item.category,
      licenseName: assetMetadata.licenseName || item.licenseName,
      ...assetMetadata
    },
    evaluation: {
      qualityStatus: evaluation.qualityStatus ?? item.qualityStatus ?? responseRaw.qualityStatus,
      qualityScore: evaluation.qualityScore ?? item.qualityScore ?? responseRaw.qualityScore,
      qualityIssues: evaluation.qualityIssues ?? item.qualityIssues ?? responseRaw.qualityIssues ?? [],
      expectedMetadata: {
        ...expectedMetadata
      },
      ...evaluation
    },
    analysisRun: {
      execution: analysisRun.execution || item.execution,
      ...analysisRun,
      metadata: analysisRun.metadata || {
        generationConfig: {
          mediaResolutionRequested: responseRaw.mediaResolutionRequested || analysisRun?.generationConfig?.mediaResolutionRequested || analysisRun?.metadata?.generationConfig?.mediaResolutionRequested,
        }
      }
    },
    visualAnalysis: record.visualAnalysis || responseRaw.visualAnalysis,
    diagnostics: {
      input: diagnostics.input ?? item.inputDiagnostics ?? responseRaw.inputDiagnostics,
      generation: diagnostics.generation ?? item.generationDiagnostics ?? responseRaw.generationDiagnostics,
      parse: diagnostics.parse ?? item.parseDiagnostics ?? responseRaw.parseDiagnostics,
      normalization: diagnostics.normalization ?? item.normalizationDiagnostics ?? responseRaw.normalizationDiagnostics,
      ...diagnostics
    }
  };

  return {
    ...item,
    record: finalRecord
  };
}

export function getItemQualityStatus(item: PublicSampleBatchRunItem) {
  return item.record?.evaluation?.qualityStatus;
}

export function getItemQualityScore(item: PublicSampleBatchRunItem) {
  return item.record?.evaluation?.qualityScore;
}

export function getItemQualityIssues(item: PublicSampleBatchRunItem) {
  return item.record?.evaluation?.qualityIssues ?? [];
}

export function getItemAnalysisRun(item: PublicSampleBatchRunItem) {
  return item.record?.analysisRun;
}

export function getItemInputDiagnostics(item: PublicSampleBatchRunItem) {
  return item.record?.diagnostics?.input;
}

export function getItemGenerationDiagnostics(item: PublicSampleBatchRunItem) {
  return item.record?.diagnostics?.generation;
}

export function getItemParseDiagnostics(item: PublicSampleBatchRunItem) {
  return item.record?.diagnostics?.parse;
}

export function getItemNormalizationDiagnostics(item: PublicSampleBatchRunItem) {
  return item.record?.diagnostics?.normalization;
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

export function buildComparisonCoverage(items: PublicSampleBatchRunItem[]) {
  let itemsWithExpectedMetadata = 0;
  let itemsWithComparison = 0;

  for (const item of items) {
    if (item.success) {
      if (item.record?.evaluation?.expectedMetadata) {
        itemsWithExpectedMetadata++;
      }
      if (item.comparison) {
        itemsWithComparison++;
      }
    }
  }

  const comparisonMissingCount = itemsWithExpectedMetadata - itemsWithComparison;
  const consistent = comparisonMissingCount === 0;

  return {
    itemsWithExpectedMetadata,
    itemsWithComparison,
    comparisonMissingCount,
    consistent
  };
}

export function buildComparisonRecordConsistency(items: PublicSampleBatchRunItem[]) {
  let itemsWithRecordVisualAnalysis = 0;
  let itemsWithImageKindMismatch = 0;
  let itemsWithNoDetectedImageKindDespiteRecordImageKind = 0;
  let itemsWithExpectedCategoryOverlapButNoComparisonMatch = 0;
  let itemsWithExpectedLabelOverlapButNoComparisonMatch = 0;
  let itemsWithExpectedTextOverlapButNoComparisonMatch = 0;

  for (const item of items) {
    if (!item.success) continue;

    const record = item.record;
    const vi = record?.visualAnalysis?.visualInfo;
    const comp = item.comparison;

    if (vi) {
      itemsWithRecordVisualAnalysis++;

      // 1. imageKind consistency
      const recordImageKind = vi.imageKind;
      if (recordImageKind) {
        const detectedImageKind = comp?.imageKind?.detected;
        if (detectedImageKind !== recordImageKind) {
          itemsWithImageKindMismatch++;
        }
        if (!detectedImageKind || comp?.imageKind?.details?.includes("No image kind detected")) {
          itemsWithNoDetectedImageKindDespiteRecordImageKind++;
        }
      }

      const expectedMetadata = record?.evaluation?.expectedMetadata;
      if (expectedMetadata) {
        // 2. category consistency
        const expectedCats: string[] = expectedMetadata.elementCategories || [];
        const recordCats: string[] = vi.visibleElements?.map((el: any) => el.category).filter(Boolean) || [];
        
        const hasCategoryOverlap = expectedCats.some(expected => {
          if (recordCats.includes(expected)) return true;
          if (expected === "landscapeElement") {
            const landscapeEquivalents = ["terrain", "plant", "waterBody", "weatherOrSky", "roadOrPath"];
            if (recordCats.some(c => landscapeEquivalents.includes(c))) return true;
          }
          const alternatives = expectedMetadata.elementCategoryAlternatives?.[expected] || [];
          if (recordCats.some(c => alternatives.includes(c))) return true;
          return false;
        });

        if (hasCategoryOverlap && expectedCats.length > 0) {
          const matchedCats = comp?.categories?.matched || [];
          const acceptableCats = comp?.categories?.acceptable || [];
          if (matchedCats.length === 0 && acceptableCats.length === 0) {
            itemsWithExpectedCategoryOverlapButNoComparisonMatch++;
          }
        }

        // 3. visible text consistency
        const expectedTexts: string[] = expectedMetadata.visibleText || [];
        const recordTexts: string[] = vi.visibleText?.map((txt: any) => typeof txt === 'string' ? txt : txt?.text || "").filter(Boolean) || [];

        const hasTextOverlap = expectedTexts.some(expected => {
          const normExpected = expected.trim().toLowerCase();
          return recordTexts.some(rec => {
            const normRec = rec.trim().toLowerCase();
            return normRec.includes(normExpected) || normExpected.includes(normRec);
          });
        });

        if (hasTextOverlap && expectedTexts.length > 0) {
          const matchedTexts = comp?.visibleText?.matched || [];
          if (matchedTexts.length === 0) {
            itemsWithExpectedTextOverlapButNoComparisonMatch++;
          }
        }

        // 4. label consistency
        const expectedLabels: string[] = expectedMetadata.visibleElementLabels || [];
        const recordLabels: string[] = vi.visibleElements?.map((el: any) => el.label).filter(Boolean) || [];
        const recordAttributes: string[] = vi.visibleElements?.flatMap((el: any) => el.attributes || []).filter(Boolean) || [];
        const recordKeywords: string[] = record?.visualAnalysis?.indexing?.keywords?.map((kw: any) => typeof kw === 'string' ? kw : kw?.value || "").filter(Boolean) || [];

        const hasLabelOverlap = expectedLabels.some(expected => {
          const normExpected = expected.trim().toLowerCase();
          
          const checkMatch = (val: string) => {
            const normVal = val.trim().toLowerCase();
            return normVal.includes(normExpected) || normExpected.includes(normVal);
          };

          if (recordLabels.some(checkMatch)) return true;
          if (recordAttributes.some(checkMatch)) return true;
          if (recordKeywords.some(checkMatch)) return true;

          const aliases = expectedMetadata.visibleElementLabelAliases?.[expected] || [];
          for (const alias of aliases) {
            const normAlias = alias.trim().toLowerCase();
            if (recordLabels.some(l => l.trim().toLowerCase().includes(normAlias))) return true;
          }
          return false;
        });

        if (hasLabelOverlap && expectedLabels.length > 0) {
          const matchedLabels = comp?.labels?.matched || [];
          const acceptableLabels = comp?.labels?.acceptable || [];
          if (matchedLabels.length === 0 && acceptableLabels.length === 0) {
            itemsWithExpectedLabelOverlapButNoComparisonMatch++;
          }
        }
      }
    }
  }

  const successCount = items.filter(it => it.success).length;
  const validCount = items.filter(it => it.record?.evaluation?.qualityStatus === 'valid').length;
  const expectedComparisonFailCount = items.filter(it => !it.success || it.comparison?.overallStatus === 'fail').length;

  const suspiciousAllComparisonFail = 
    successCount > 0 &&
    validCount > 0 &&
    itemsWithRecordVisualAnalysis > 0 &&
    expectedComparisonFailCount === successCount;

  const consistent = 
    itemsWithNoDetectedImageKindDespiteRecordImageKind === 0 &&
    itemsWithExpectedCategoryOverlapButNoComparisonMatch === 0 &&
    itemsWithExpectedTextOverlapButNoComparisonMatch === 0;

  return {
    itemsWithRecordVisualAnalysis,
    itemsWithImageKindMismatch,
    itemsWithNoDetectedImageKindDespiteRecordImageKind,
    itemsWithExpectedCategoryOverlapButNoComparisonMatch,
    itemsWithExpectedLabelOverlapButNoComparisonMatch,
    itemsWithExpectedTextOverlapButNoComparisonMatch,
    suspiciousAllComparisonFail,
    consistent
  };
}

export function buildBatchAnalysisBundleForChat(batchSummary: PublicSampleBatchRunSummary) {
  const normalizedItems = batchSummary.items.map(normalizeLegacyBatchRunItem);
  const reSummary = { ...batchSummary, items: normalizedItems };

  const compactItems = normalizedItems.map(item => buildCompactItem(item));

  // Extract failure items (where success is false or quality status is invalid)
  const failureItems = normalizedItems.filter(item => !item.success || getItemQualityStatus(item) === 'invalid');
  const compactFailureItems = failureItems.map(item => buildCompactItem(item));

  const expectedCounts = summarizeExpectedComparisonCounts(normalizedItems);
  const reviewCounts = summarizeReviewCounts(normalizedItems);

  const expectedConsistent = 
    expectedCounts.expectedComparisonPassCount === batchSummary.expectedComparisonPassCount &&
    expectedCounts.expectedComparisonWarningCount === batchSummary.expectedComparisonWarningCount &&
    expectedCounts.expectedComparisonFailCount === batchSummary.expectedComparisonFailCount;

  const reviewConsistent = 
    reviewCounts.reviewPassCount === batchSummary.reviewPassCount &&
    reviewCounts.reviewNeedsReviewCount === batchSummary.reviewNeedsReviewCount &&
    reviewCounts.reviewFailCount === batchSummary.reviewFailCount;

  const generationFailureCount = normalizedItems.filter(i => !i.success).length;
  const comparisonOnlyFailCount = normalizedItems.filter(i => i.success && i.comparison?.overallStatus === 'fail').length;
  const notComparableCount = normalizedItems.filter(i => i.success && !i.comparison).length;

  const report = {
    reportKind: "visualAnalysisPublicSampleBatchAnalysisBundle" as const,
    generatedAt: new Date().toISOString(),
    modelName: batchSummary.modelName,
    jsonMode: batchSummary.jsonMode,
    total: batchSummary.total,
    successCount: batchSummary.successCount,
    failureCount: batchSummary.failureCount,
    validCount: batchSummary.validCount,
    validLowQualityCount: batchSummary.validLowQualityCount,
    invalidJsonCount: batchSummary.invalidJsonCount,
    generationFailureCount,
    comparisonOnlyFailCount,
    notComparableCount,
    jobStatus: batchSummary.jobStatus,
    isComplete: batchSummary.isComplete,
    completedCount: batchSummary.completedCount,
    pendingCount: batchSummary.pendingCount,
    processedCount: batchSummary.processedCount,
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
    comparisonCoverage: buildComparisonCoverage(normalizedItems),
    comparisonRecordConsistency: buildComparisonRecordConsistency(normalizedItems),
    invariants: validateBatchRunInvariants(reSummary),
    generationFailureSummary: buildGenerationFailureSummary(normalizedItems),
    apiResponseFailureSummary: buildApiResponseFailureSummary(normalizedItems),
    parseFailureSummary: buildParseFailureSummary(normalizedItems),
    networkFailureSummary: buildNetworkFailureSummary(normalizedItems),
    validationFailureSummary: buildValidationFailureSummary(normalizedItems),
    rateLimitSummary: buildRateLimitSummary(normalizedItems),
    providerQuotaSummary: buildProviderQuotaSummary(normalizedItems),
    inputSizeSummary: buildInputSizeSummary(normalizedItems),
    textHeavyEvaluation: buildTextHeavyEvaluationSummary(normalizedItems),
    analysisGuidance: {
      intendedUse: "Primary single-file artifact for ChatGPT-assisted analysis of visual public sample batch regressions.",
      recommendedFirstChecks: [
        "invariants.valid",
        "comparisonCoverage.consistent",
        "comparisonRecordConsistency.consistent",
        "expectedComparisonFailCount",
        "reviewFailCount",
        "textHeavyEvaluation.ratio"
      ],
      fullJsonPolicy: "Use Full JSON only for archival replay or when canonical ImageAnalysisRecord details omitted from this bundle are required.",
      summaryPolicy: "Summary JSON is a lightweight view and is no longer required for normal ChatGPT analysis when this bundle is available.",
      failuresPolicy: "Failures are embedded in this bundle under failures.items."
    },
    failures: {
      totalFailures: compactFailureItems.length,
      items: compactFailureItems
    },
    items: compactItems
  };

  return attachArtifactIntegrity(report, {
    artifactKind: "analysis-bundle" as any,
    items: normalizedItems,
    endSentinel: "END_OF_VISUAL_ANALYSIS_BATCH_ANALYSIS_BUNDLE"
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
  const run = item.record?.analysisRun;
  const modelName = run?.model?.name ?? run?.execution?.modelName ?? "UNKNOWN";
  const providerFamily = run?.model?.providerFamily ?? run?.execution?.providerFamily ?? "UNKNOWN";
  const structuredExecutionMode = run?.execution?.structuredExecutionMode ?? "UNKNOWN";
  const jsonMode = run?.execution?.jsonMode ?? "UNKNOWN";
  const jsonRecovery = run?.execution?.jsonRecovery;
  
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
    const analysisRun = getItemAnalysisRun(item);
    
    const model =
      analysisRun?.model?.name ??
      analysisRun?.execution?.usedModelName ??
      analysisRun?.execution?.modelName ??
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
    
    const parseDiag = getItemParseDiagnostics(item);
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
  
  const byFinalProviderStatus: Record<string, number> = {};
  const byObservedProviderStatus: Record<string, number> = {};
  const byFinalStatusCode: Record<string, number> = {};
  const byObservedStatusCode: Record<string, number> = {};
  const byProviderFailureKind: Record<string, number> = {};
  const byMimeType: Record<string, number> = {};
  let transientFetchFailureCount = 0;
  
  const representativeSamples: Array<{
    sampleId: string;
    finalProviderStatus?: string;
    finalStatusCode?: string;
    providerFailureKind?: string;
    observedAttemptStatuses?: string[];
    causeCode?: string;
    causeSyscall?: string;
    byteLength?: number;
    base64Length?: number;
  }> = [];

  for (const item of failedItems) {
    const diag = getItemGenerationDiagnostics(item);
    const inputDiag = getItemInputDiagnostics(item);

    if (diag) {
      const finalProvStatus = diag.providerStatus || "UNKNOWN";
      byFinalProviderStatus[finalProvStatus] = (byFinalProviderStatus[finalProvStatus] || 0) + 1;
      
      const finalStatusCodeStr = diag.statusCode ? String(diag.statusCode) : "UNKNOWN";
      byFinalStatusCode[finalStatusCodeStr] = (byFinalStatusCode[finalStatusCodeStr] || 0) + 1;

      const failKind = diag.providerFailureKind || "UNKNOWN";
      byProviderFailureKind[failKind] = (byProviderFailureKind[failKind] || 0) + 1;

      if (diag.attempts && diag.attempts.length > 0) {
        let hasTransient = false;
        for (const attempt of diag.attempts) {
           const obsStatus = attempt.providerStatus || "UNKNOWN";
           byObservedProviderStatus[obsStatus] = (byObservedProviderStatus[obsStatus] || 0) + 1;
           const obsCode = attempt.statusCode ? String(attempt.statusCode) : "UNKNOWN";
           byObservedStatusCode[obsCode] = (byObservedStatusCode[obsCode] || 0) + 1;

           if (attempt.errorMessageSummary && attempt.errorMessageSummary.toUpperCase().includes("FETCH FAILED")) {
             hasTransient = true;
           }
        }
        if (hasTransient) transientFetchFailureCount++;
      } else {
        byObservedProviderStatus[finalProvStatus] = (byObservedProviderStatus[finalProvStatus] || 0) + 1;
        byObservedStatusCode[finalStatusCodeStr] = (byObservedStatusCode[finalStatusCodeStr] || 0) + 1;
        if (diag.rawMessageSummary && diag.rawMessageSummary.toUpperCase().includes("FETCH FAILED")) {
          transientFetchFailureCount++;
        }
      }
    } else {
      byFinalProviderStatus["UNKNOWN"] = (byFinalProviderStatus["UNKNOWN"] || 0) + 1;
      byFinalStatusCode["UNKNOWN"] = (byFinalStatusCode["UNKNOWN"] || 0) + 1;
      byObservedProviderStatus["UNKNOWN"] = (byObservedProviderStatus["UNKNOWN"] || 0) + 1;
      byObservedStatusCode["UNKNOWN"] = (byObservedStatusCode["UNKNOWN"] || 0) + 1;
      byProviderFailureKind["UNKNOWN"] = (byProviderFailureKind["UNKNOWN"] || 0) + 1;
    }

    if (inputDiag) {
      const mime = inputDiag.mimeType || "UNKNOWN";
      byMimeType[mime] = (byMimeType[mime] || 0) + 1;
    } else {
      byMimeType["UNKNOWN"] = (byMimeType["UNKNOWN"] || 0) + 1;
    }

    const sampleEntry: any = {
      sampleId: item.sampleId,
      finalProviderStatus: diag?.providerStatus,
      finalStatusCode: diag?.statusCode ? String(diag.statusCode) : undefined,
      providerFailureKind: diag?.providerFailureKind,
      byteLength: inputDiag?.byteLength,
      base64Length: inputDiag?.base64Length,
      causeCode: (diag as any)?.causeCode,
      causeSyscall: (diag as any)?.causeSyscall
    };
    
    if (diag?.attempts) {
       sampleEntry.observedAttemptStatuses = diag.attempts.map((a: any) => a.providerStatus || "UNKNOWN");
       const lastAttempt = diag.attempts[diag.attempts.length - 1];
       if (!sampleEntry.causeCode && lastAttempt?.causeCode) sampleEntry.causeCode = lastAttempt.causeCode;
       if (!sampleEntry.causeSyscall && lastAttempt?.causeSyscall) sampleEntry.causeSyscall = lastAttempt.causeSyscall;
    }

    if (representativeSamples.length < 10) {
       representativeSamples.push(sampleEntry);
    }
  }

  

  return {
    total: failedItems.length,
    byFinalProviderStatus,
    byObservedProviderStatus,
    byFinalStatusCode,
    byObservedStatusCode,
    byProviderFailureKind,
    transientFetchFailureCount,
    byMimeType,
    representativeSamples
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

  const assetMetadata = item.record?.assetMetadata;
  if (assetMetadata) {
     compact.category = assetMetadata.category;
     compact.licenseName = assetMetadata.licenseName;
  }

  const expectedMetadata = item.record?.evaluation?.expectedMetadata;
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

  const visualAnalysis = item.record?.visualAnalysis;
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
  
  const normDiag = getItemNormalizationDiagnostics(item);
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
  artifactKind: "summary" | "diagnostic" | "failures" | "full" | "item" | "analysis-bundle";
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

  const normDiag = getItemNormalizationDiagnostics(item);
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

  let expectedMetadataTextItems = 0;
  let comparisonTextCoverageItems = 0;

  const samples = [];
  
  for (const item of items) {
    const coverage = item.comparison?.coverage?.visibleText;
    
    const visibleTextArray = item.record?.evaluation?.expectedMetadata?.visibleText;
    if (Array.isArray(visibleTextArray) && visibleTextArray.length > 0) {
      expectedMetadataTextItems++;
    }

    if (coverage && coverage.expectedTotal > 0) {
      comparisonTextCoverageItems++;
    }

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
        sampleId: item.record?.assetMetadata?.id || item.sampleId,
        title: item.record?.assetMetadata?.title ?? item.title,
        imageKind: item.record?.evaluation?.expectedMetadata?.imageKind,
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
  const textComparisonMissingCount = Math.max(0, expectedMetadataTextItems - comparisonTextCoverageItems);

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
    expectedMetadataTextItems,
    comparisonTextCoverageItems,
    textComparisonMissingCount,
    samples
  };
}

export interface BatchInvariantResult {
  valid: boolean;
  issues: string[];
}

export function validateBatchRunInvariants(batchSummary: PublicSampleBatchRunSummary): BatchInvariantResult {
  const issues: string[] = [];

  const coverage = buildComparisonCoverage(batchSummary.items);
  if (!coverage.consistent) {
    issues.push(`Comparison coverage is inconsistent: ${coverage.comparisonMissingCount} comparisons missing.`);
  }

  const consistency = buildComparisonRecordConsistency(batchSummary.items);
  if (!consistency.consistent) {
    if (consistency.itemsWithNoDetectedImageKindDespiteRecordImageKind > 0) {
      issues.push(`Record has imageKind but comparison detected no image kind in ${consistency.itemsWithNoDetectedImageKindDespiteRecordImageKind} items.`);
    }
    if (consistency.itemsWithExpectedCategoryOverlapButNoComparisonMatch > 0) {
      issues.push(`Expected categories overlap with record but got no comparison category match in ${consistency.itemsWithExpectedCategoryOverlapButNoComparisonMatch} items.`);
    }
    if (consistency.itemsWithExpectedTextOverlapButNoComparisonMatch > 0) {
      issues.push(`Expected visible text matches record but got no comparison visibleText match in ${consistency.itemsWithExpectedTextOverlapButNoComparisonMatch} items.`);
    }
  }

  if (consistency.itemsWithImageKindMismatch > 0) {
    issues.push(`Comparison imageKind mismatch with record in ${consistency.itemsWithImageKindMismatch} items.`);
  }

  if (consistency.suspiciousAllComparisonFail) {
    issues.push(`Suspicious run: all ${consistency.itemsWithRecordVisualAnalysis} successful items with visual analysis failed in comparison.`);
  }

  let totalProcessedBytesFromInputSize = 0;
  try {
    const inputSizeSummary = buildInputSizeSummary(batchSummary.items);
    totalProcessedBytesFromInputSize = inputSizeSummary.totalProcessedBytes;
  } catch (e) {
    // Ignore if buildInputSizeSummary fails or is not ready
  }

  let hasRecordWithProcessedByteLength = false;

  for (const item of batchSummary.items) {
    if (item.record?.technicalMetadata?.processedByteLength) {
      hasRecordWithProcessedByteLength = true;
    }

    if (item.success) {
      const expectedMetadata = item.record?.evaluation?.expectedMetadata;
      if (expectedMetadata) {
        if (!item.comparison) {
          issues.push(`Item ${item.sampleId} is successful with expectedMetadata but missing comparison object.`);
        }
      }

      if (item.comparison) {
        const comp = item.comparison;
        if (!comp.overallStatus || !['pass', 'warning', 'fail'].includes(comp.overallStatus)) {
          issues.push(`Item ${item.sampleId} comparison overallStatus is invalid: ${comp.overallStatus}`);
        }
        if (!comp.reviewStatus || !['pass', 'needsReview', 'fail'].includes(comp.reviewStatus)) {
          issues.push(`Item ${item.sampleId} comparison reviewStatus is invalid: ${comp.reviewStatus}`);
        }
        if (!comp.coverage) {
          issues.push(`Item ${item.sampleId} comparison missing coverage field.`);
        } else {
          const visibleText = comp.coverage.visibleText;
          if (visibleText) {
            const { expectedTotal, covered, missing } = visibleText;
            if (typeof expectedTotal !== 'number' || typeof covered !== 'number' || typeof missing !== 'number') {
              issues.push(`Item ${item.sampleId} comparison.coverage.visibleText has invalid non-numeric fields.`);
            } else if (expectedTotal !== covered + missing) {
              issues.push(`Item ${item.sampleId} comparison.coverage.visibleText expectedTotal (${expectedTotal}) does not match covered (${covered}) + missing (${missing}).`);
            }
          } else if (expectedMetadata?.visibleText && expectedMetadata.visibleText.length > 0) {
            issues.push(`Item ${item.sampleId} expectedMetadata.visibleText exists but comparison.coverage.visibleText is missing.`);
          }
        }
      }
    }
  }

  if (hasRecordWithProcessedByteLength && totalProcessedBytesFromInputSize === 0) {
    issues.push(`Some records have technicalMetadata.processedByteLength, but batch-level inputSizeSummary.totalProcessedBytes is 0.`);
  }

  const textHeavy = buildTextHeavyEvaluationSummary(batchSummary.items);
  if (textHeavy.textComparisonMissingCount > 0) {
    issues.push(`TextHeavy evaluation has ${textHeavy.textComparisonMissingCount} missing text comparisons.`);
  }

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
