import { SummaryAnalysisResultV12 } from "./types";

export type StructuredQualityStatus = "valid" | "validWithRepair" | "validLowQuality" | "invalid";

export type StructuredQualityIssueSeverity = "info" | "warning" | "blocking";

export interface StructuredQualityIssue {
  severity: StructuredQualityIssueSeverity;
  message: string;
  code: string;
}

export interface StructuredQualityReport {
  status: StructuredQualityStatus;
  issues: StructuredQualityIssue[];
  score: number; // 0 to 100
  recommendedForPersistence: boolean;
  recommendedForIndexMdCandidate: boolean;
  experimentalModel: boolean;
}

export interface ModelCapabilityContext {
  modelName: string;
  providerFamily?: string;
  effectiveStructuredExecutionMode?: string;
  supportsNativeResponseSchema?: boolean;
  responseSchemaEnabled?: boolean;
  repairApplied?: boolean;
  repairFallbackUsed?: boolean;
  warnings?: string[];
}

/**
 * Evaluates the quality of a validated and normalized draft.2 structured summary.
 * Returns a report highlighting issues, a numerical score, and persistence recommendations.
 */
export function evaluateStructuredSummaryQuality(
  result: SummaryAnalysisResultV12 | null,
  context?: ModelCapabilityContext
): StructuredQualityReport {
  const issues: StructuredQualityIssue[] = [];
  let score = 100;

  // 1. Check blocking issues
  if (!result) {
    return {
      status: "invalid",
      issues: [{ severity: "blocking", message: "構造化データが存在しません。", code: "MISSING_DATA" }],
      score: 0,
      recommendedForPersistence: false,
      recommendedForIndexMdCandidate: false,
      experimentalModel: false,
    };
  }

  // Blocking check: summary.oneLine and summary.detailed are both empty
  const oneLineEmpty = !result.summary?.oneLine || !result.summary.oneLine.trim();
  const detailedEmpty = !result.summary?.detailed || !result.summary.detailed.trim();
  if (oneLineEmpty && detailedEmpty) {
    issues.push({
      severity: "blocking",
      message: "要約の1行サマリーと詳細サマリーが両方とも空です。",
      code: "EMPTY_SUMMARIES",
    });
  }

  // Blocking check: titleInfo.displayTitle.value and titleInfo.inferredTitle are both empty
  const displayTitleEmpty = !result.titleInfo?.displayTitle?.value || !result.titleInfo.displayTitle.value.trim();
  const inferredTitleEmpty = !result.titleInfo?.inferredTitle || !result.titleInfo.inferredTitle.trim();
  if (displayTitleEmpty && inferredTitleEmpty) {
    issues.push({
      severity: "blocking",
      message: "表示タイトルと推測タイトルが両方とも空です。",
      code: "EMPTY_TITLES",
    });
  }

  // 2. Check non-blocking quality warnings
  
  // Model check
  const modelName = context?.modelName || "";
  const isGemma = modelName.toLowerCase().includes("gemma");
  const isUnknownModel = context?.providerFamily && context.providerFamily !== "gemini";
  const isExperimental = isGemma || !!isUnknownModel;

  if (isExperimental) {
    issues.push({
      severity: "info",
      message: `使用されたモデル (${modelName}) は、このタスクに推奨されるモデルではありません。`,
      code: "EXPERIMENTAL_MODEL",
    });
    score -= 10;
  }

  // Execution mode
  const executionMode = context?.effectiveStructuredExecutionMode;
  if (executionMode === "promptedJson") {
    issues.push({
      severity: "info",
      message: "ネイティブスキーマ制約が無効化され、プロンプトベースのJSON生成が使用されました。",
      code: "PROMPTED_JSON_MODE",
    });
    score -= 10;
  }

  // Document kind fallbacks
  const kinds = result.documentKindInfo?.kinds || [];
  const onlyUnknownKind = kinds.length === 1 && kinds[0].kind === "unknown";
  const hasUnknownKind = kinds.some(k => k.kind === "unknown");
  if (onlyUnknownKind) {
    issues.push({
      severity: "warning",
      message: "文書の種類が特定できず、フォールバックの 'unknown' になっています。",
      code: "UNKNOWN_DOCUMENT_KIND",
    });
    score -= 15;
  } else if (hasUnknownKind) {
    issues.push({
      severity: "info",
      message: "特定された文書の種類にフォールバックの 'unknown' が含まれています。",
      code: "PARTIAL_UNKNOWN_DOCUMENT_KIND",
    });
    score -= 5;
  }

  // Check if document kind was repaired/added by fallback repair
  const repairApplied = !!context?.repairApplied || !!context?.repairFallbackUsed;
  if (repairApplied) {
    issues.push({
      severity: "info",
      message: "検証エラーの修正処理（修復またはLLMフォールバック）が実行されました。",
      code: "REPAIR_APPLIED",
    });
    score -= 10;
  }

  // Subject areas
  const domains = result.subjectAreas?.domains || [];
  const onlyUnknownOrOtherDomains = domains.length > 0 && domains.every(d => d.domain === "unknown" || d.domain === "other");
  if (domains.length === 0) {
    issues.push({
      severity: "warning",
      message: "主題領域 (subjectAreas) が空です。",
      code: "EMPTY_SUBJECT_AREAS",
    });
    score -= 15;
  } else if (onlyUnknownOrOtherDomains) {
    issues.push({
      severity: "warning",
      message: "主題領域 (subjectAreas) に 'unknown' または 'other' しか設定されていません。",
      code: "UNKNOWN_SUBJECT_AREAS",
    });
    score -= 10;
  }

  // Keywords importance values
  const keywords = result.indexing?.keywords || [];
  const hasKeywords = keywords.length > 0;
  const allKeywordImportanceZeroOrMissing = hasKeywords && keywords.every(kw => kw.importance === undefined || kw.importance === 0);
  if (!hasKeywords) {
    issues.push({
      severity: "warning",
      message: "キーワード (indexing.keywords) が空です。",
      code: "EMPTY_KEYWORDS",
    });
    score -= 10;
  } else if (allKeywordImportanceZeroOrMissing) {
    issues.push({
      severity: "warning",
      message: "キーワードの重要度 (importance) がすべて 0 または未設定です。",
      code: "ZERO_KEYWORD_IMPORTANCE",
    });
    score -= 10;
  }

  // Generic summary.oneLine
  const oneLine = result.summary?.oneLine || "";
  const isGenericOneLine = oneLine.length > 0 && (
    oneLine.length < 15 ||
    /この(文書|ファイル|スプレッドシート|データ|要約)/i.test(oneLine) ||
    /the (provided )?(document|file|spreadsheet|data)/i.test(oneLine)
  );
  if (oneLineEmpty) {
    issues.push({
      severity: "warning",
      message: "1行サマリーが生成されていません。",
      code: "MISSING_ONE_LINE_SUMMARY",
    });
    score -= 15;
  } else if (isGenericOneLine) {
    issues.push({
      severity: "warning",
      message: `1行サマリーが一般的すぎます (${oneLine})。`,
      code: "GENERIC_ONE_LINE_SUMMARY",
    });
    score -= 15;
  }

  // Title source inferredTitle while filename title is good
  const source = result.titleInfo?.displayTitle?.source;
  const fileNameTitle = result.titleInfo?.fileNameTitle;
  const hasUsableFileNameTitle = fileNameTitle && !fileNameTitle.isGeneric && fileNameTitle.value.trim().length > 0;
  if (source === "inferredTitle" && hasUsableFileNameTitle) {
    issues.push({
      severity: "warning",
      message: "有効なファイル名タイトルが存在するにも関わらず、推測タイトルが選ばれました。",
      code: "INFERRED_TITLE_OVERRIDE",
    });
    score -= 10;
  }

  // Quality confidence
  const confidence = result.quality?.confidence ?? 1.0;
  if (confidence < 0.6) {
    issues.push({
      severity: "warning",
      message: `モデルの自己申告抽出信頼度 (${confidence}) が 0.6 を下回っています。`,
      code: "LOW_CONFIDENCE",
    });
    score -= 15;
  }

  // 3. Finalize Status
  let status: StructuredQualityStatus = "valid";
  
  const hasBlocking = issues.some(iss => iss.severity === "blocking");
  const hasWarnings = issues.some(iss => iss.severity === "warning");

  if (hasBlocking) {
    status = "invalid";
  } else if (hasWarnings) {
    status = "validLowQuality";
  } else if (repairApplied) {
    status = "validWithRepair";
  }

  // Bound score
  score = Math.max(0, Math.min(100, score));

  // Determine recommendations
  const recommendedForPersistence = status !== "invalid";
  const recommendedForIndexMdCandidate = status === "valid" || status === "validWithRepair";

  return {
    status,
    issues,
    score,
    recommendedForPersistence,
    recommendedForIndexMdCandidate,
    experimentalModel: isExperimental,
  };
}

/**
 * Translates report to legacy status for UI compatibility
 */
export function getStructuredQualityStatus(report: StructuredQualityReport): StructuredQualityStatus {
  return report.status;
}
