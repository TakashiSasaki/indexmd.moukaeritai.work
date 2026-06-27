import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  Settings,
  Play,
  FileText,
  Code,
  Loader2,
  FileDigit,
  Link as LinkIcon,
  FileSearch,
  RefreshCw,
  Clipboard,
  Check,
  XCircle,
  History as HistoryIcon,
  Trash2,
  FolderPlus,
  HelpCircle,
  Activity,
  ChevronDown,
  ChevronUp,
  LayoutGrid,
  Braces,
} from "lucide-react";
import { getDriveAuthHeaders } from "../lib/driveToken";
import { CompatibilityMatrix } from "./CompatibilityMatrix";
import { ModelInfo, ValidationRecord, ExperimentHistoryRecord } from "../types";
import MODELS_INFO from "../data/models_info.json";
// @ts-ignore - TS test runner fails on ?raw imports, but vite handles it correctly in prod
import { SUMMARY_FIXTURES } from "../lib/__fixtures__/summary-schema";
import {
  db,
  doc,
  getDoc,
  setDoc,
  auth,
  handleFirestoreError,
  OperationType,
  collection,
  getDocs,
  query,
  orderBy,
  limit,
} from "../lib/firebase";
import {
  buildFileSummaryMetadata,
  sanitizeSummaryMetadataForFirestore,
  getFileSummaryDocPath,
  isPersistableStructuredSummary,
  getSummaryMetadataStatus,
  shouldSkipFirestoreSummaryWrite,
} from "../lib/summaryMetadata";
import {
  SUMMARY_ANALYSIS_PROMPT_VERSION,
  SUMMARY_DEBUG_SYSTEM_INSTRUCTION_VERSION,
} from "../lib/promptSpecs";
import {
  SCHEMA_VERSION_V12,
} from "../lib/summaryAnalysis/schema";
import { canGenerateSummary } from "../lib/summaryDebuggerUtils";
import { AppConfig } from "../types";

interface SummaryDebuggerProps {
  token: string | null;
  onSessionExpiry?: () => void;
  userId?: string | null;
  setActiveTab?: (tabId: string) => void;
  config: AppConfig;
}

const CACHE_KEY = "gemini_sample_files_cache";
const SELECTED_FILE_ID_KEY = "gemini_selected_file_id";
const SELECTED_MODEL_KEY = "gemini_selected_model";

const MODELS = MODELS_INFO as ModelInfo[];

const RenderStructuredSummary: React.FC<{
  structured: any;
  rawText?: string;
  repairWarnings?: string[];
  validationErrors?: string[];
  repairFallbackUsed?: boolean;
  qualityStatus?: string;
  qualityIssues?: any[];
  qualityScore?: number;
  experimentalModel?: boolean;
  effectiveStructuredExecutionMode?: string;
  providerFamily?: string;
  usedModelName?: string;
}> = ({
  structured,
  rawText,
  repairWarnings = [],
  validationErrors = [],
  repairFallbackUsed = false,
  qualityStatus,
  qualityIssues = [],
  qualityScore,
  experimentalModel,
  effectiveStructuredExecutionMode,
  providerFamily,
  usedModelName,
}) => {
  const oneLine = structured.summary?.oneLine;
  const detailed = structured.summary?.detailed;

  const displayTitle = structured.titleInfo?.displayTitle?.value;
  const displayTitleSource = structured.titleInfo?.displayTitle?.source;
  const displayTitleReason = structured.titleInfo?.displayTitle?.reason;

  const inferredTitle = structured.titleInfo?.inferredTitle;

  const docKindText = structured.documentKindInfo?.kinds
    ?.map((k: any) => `${k.kind} (${Math.round(k.confidence * 100)}%)`)
    .join(", ");
  const primaryLang = structured.languageInfo?.primary;
  const languagesList = structured.languageInfo?.detected?.join(", ");
  const confidence = structured.quality?.confidence;

  const topics = (structured.subjectAreas?.domains || [])
    .flatMap((d: any) => d.labels || [])
    .filter((l: any) => l.kind === "topic")
    .map((l: any) => l.label);
  const keywords = (structured.indexing?.keywords || []).map(
    (k: any) => `${k.value} (${k.source})`,
  );

  const saDomains = (structured.subjectAreas?.domains || []).map((d: any) => ({
    domain: d.domain,
    confidence: d.confidence,
    labels: (d.labels || []).map((l: any) => l.label).join(", "),
  }));

  const nEntities = structured.indexing?.namedEntities;
  const rReferences = structured.indexing?.resourceReferences;
  const tempRefs = structured.extractedFacts?.temporalReferences;
  const parties = structured.extractedFacts?.parties;
  const mAmounts = structured.extractedFacts?.monetaryAmounts;
  const warnings = structured.quality?.warnings || [];

  const hasIssues = repairWarnings.length > 0 || validationErrors.length > 0 || qualityIssues.length > 0;

  let schemaBadge = { label: "VALID", color: "emerald" };
  if (validationErrors.length > 0) {
    schemaBadge = { label: "INVALID", color: "rose" };
  }

  let qualityBadge = { label: "GOOD", color: "emerald" };
  if (qualityStatus === "validLowQuality") {
    qualityBadge = { label: "LOW QUALITY", color: "amber" };
  } else if (qualityStatus === "validWithRepair") {
    qualityBadge = { label: "REPAIRED", color: "blue" };
  } else if (qualityStatus === "invalid") {
    qualityBadge = { label: "INVALID", color: "rose" };
  }

  const execBadgeLabel = effectiveStructuredExecutionMode === "promptedJson" ? "Prompted JSON" : "Native Schema";
  const execBadgeColor = effectiveStructuredExecutionMode === "promptedJson" ? "amber" : "emerald";

  let modelBadgeLabel = "Unknown Model";
  let modelBadgeColor = "slate";
  if (providerFamily === "gemini" && !experimentalModel) {
    modelBadgeLabel = "Gemini";
    modelBadgeColor = "emerald";
  } else if (providerFamily === "gemma" || experimentalModel) {
    modelBadgeLabel = providerFamily === "gemma" ? "Gemma" : "Experimental";
    modelBadgeColor = "amber";
  }

  return (
    <div className="space-y-6">
      {hasIssues && (
        <div className="bg-slate-900/50 border border-slate-700 rounded-lg overflow-hidden">
          <div className="px-4 py-2 bg-slate-800 border-b border-slate-700 flex items-center justify-between">
            <div className="flex flex-col gap-1">
              <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                <Activity className="w-3 h-3 text-amber-400" />
                品質・バリデーション状況
              </h4>
              <div className="flex flex-wrap items-center gap-2 mt-1">
                <span className={`text-[9px] px-1.5 py-0.5 bg-${schemaBadge.color}-500/20 text-${schemaBadge.color}-400 rounded border border-${schemaBadge.color}-500/30 font-bold uppercase`}>
                  Schema: {schemaBadge.label}
                </span>
                {qualityStatus && (
                  <span className={`text-[9px] px-1.5 py-0.5 bg-${qualityBadge.color}-500/20 text-${qualityBadge.color}-400 rounded border border-${qualityBadge.color}-500/30 font-bold uppercase`}>
                    Quality: {qualityBadge.label}
                  </span>
                )}
                {effectiveStructuredExecutionMode && (
                  <span className={`text-[9px] px-1.5 py-0.5 bg-${execBadgeColor}-500/20 text-${execBadgeColor}-400 rounded border border-${execBadgeColor}-500/30 font-bold uppercase`}>
                    Exec: {execBadgeLabel}
                  </span>
                )}
                {providerFamily && (
                  <span className={`text-[9px] px-1.5 py-0.5 bg-${modelBadgeColor}-500/20 text-${modelBadgeColor}-400 rounded border border-${modelBadgeColor}-500/30 font-bold uppercase`}>
                    Model: {modelBadgeLabel}
                  </span>
                )}
              </div>
            </div>
            {validationErrors.length === 0 ? (
              <div className="flex flex-col items-end gap-1">
                <button
                  onClick={() => navigator.clipboard.writeText(JSON.stringify(structured, null, 2))}
                  className="px-2 py-0.5 text-[9px] text-emerald-400 hover:text-white transition-colors uppercase font-bold border border-emerald-800 rounded bg-emerald-900/40"
                >
                  JSONをコピー
                </button>
              </div>
            ) : (
              <div className="flex flex-col items-end gap-1">
                <button
                  onClick={() => navigator.clipboard.writeText(rawText || "")}
                  className="px-2 py-0.5 text-[9px] text-rose-400 hover:text-white transition-colors uppercase font-bold border border-rose-800 rounded bg-rose-900/40"
                >
                  Rawをコピー
                </button>
              </div>
            )}
          </div>
          <div className="p-4 space-y-3">
            {qualityStatus === "validLowQuality" && (
              <div className="text-[11px] text-amber-400 font-medium flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <Activity className="w-3 h-3" />
                  生成結果はスキーマ要件を満たしていますが、抽出品質が低いと判定されました。
                </div>
                {effectiveStructuredExecutionMode === "promptedJson" && (
                  <div className="text-slate-400 ml-5 text-[10px]">
                    ヒント: より強力な構造化抽出には Gemini Flash モデル（Native Schemaモード）の使用を推奨します。
                  </div>
                )}
              </div>
            )}
            
            {repairFallbackUsed && (
              <div className="text-[11px] text-blue-400 font-medium flex items-center gap-2">
                <RefreshCw className="w-3 h-3 animate-spin" />
                決定論的修復に失敗したため、LLMによる修復フォールバックを適用しました。
              </div>
            )}

            {qualityIssues.length > 0 && (
              <div className="space-y-1 pt-1">
                <p className="text-[10px] text-amber-300 font-bold uppercase">
                  品質警告 ({qualityScore}点):
                </p>
                <ul className="text-[11px] text-amber-200/80 space-y-1 list-disc pl-4">
                  {qualityIssues.map((w: any, i: number) => (
                    <li key={i}>{w.message}</li>
                  ))}
                </ul>
              </div>
            )}

            {repairWarnings.length > 0 && (
              <div className="space-y-1">
                <p className="text-[10px] text-slate-500 font-bold uppercase">
                  自動修復・正規化警告:
                </p>
                <ul className="text-[11px] text-amber-200/80 space-y-1 list-disc pl-4">
                  {repairWarnings.map((w, i) => (
                    <li key={i}>{w}</li>
                  ))}
                </ul>
              </div>
            )}

            {(() => {
              const vocabErrors = validationErrors.filter(e => 
                e.toLowerCase().includes("vocabulary") || 
                e.toLowerCase().includes("invalid document kind") || 
                e.toLowerCase().includes("invalid subject domain") || 
                e.toLowerCase().includes("invalid subject label kind") || 
                e.toLowerCase().includes("invalid temporal rolecategory") || 
                e.toLowerCase().includes("invalid party rolecategory") || 
                e.toLowerCase().includes("invalid monetary rolecategory") || 
                e.toLowerCase().includes("invalid keyword source")
              );
              const schemaErrors = validationErrors.filter(e => !vocabErrors.includes(e));

              return (
                <>
                  {vocabErrors.length > 0 && (
                    <div className="space-y-1">
                      <p className="text-[10px] text-amber-400 font-bold uppercase">
                        制御語彙バリデーションエラー:
                      </p>
                      <ul className="text-[11px] text-amber-300 space-y-1 list-disc pl-4 font-mono">
                        {vocabErrors.map((e, i) => (
                          <li key={i}>{e}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {schemaErrors.length > 0 && (
                    <div className="space-y-1 pt-2">
                      <p className="text-[10px] text-rose-400 font-bold uppercase">
                        スキーマ構造バリデーションエラー:
                      </p>
                      <ul className="text-[11px] text-rose-300 space-y-1 list-disc pl-4 font-mono">
                        {schemaErrors.map((e, i) => (
                          <li key={i}>{e}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </>
              );
            })()}
          </div>
        </div>
      )}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
            <FileText className="w-4 h-4 text-emerald-400" />
            index.md候補 (1行要約) -{" "}
            <span className="text-[10px] text-blue-400 font-mono">
              {SCHEMA_VERSION_V12}
            </span>
          </h4>
          <button
            onClick={() => navigator.clipboard.writeText(oneLine || "")}
            className="px-2 py-1 text-[9px] text-slate-400 hover:text-white transition-colors uppercase font-bold flex items-center gap-1 border border-slate-700 rounded bg-slate-800"
          >
            コピー
          </button>
        </div>
        <div className="bg-slate-800/50 rounded-md p-4 border border-slate-700/50">
          <p className="whitespace-pre-wrap text-emerald-50 leading-relaxed text-sm font-bold">
            {oneLine || "要約がありません"}
          </p>
        </div>
      </div>

      <div className="space-y-2">
        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
          詳細な要約
        </h4>
        <div className="bg-slate-800/50 rounded-md p-4 border border-slate-700/50">
          <p className="whitespace-pre-wrap text-slate-200 leading-relaxed text-sm">
            {detailed || "詳細がありません"}
          </p>
        </div>
      </div>

      {displayTitle && (
        <div className="space-y-2">
          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
            表示タイトル{" "}
            {displayTitleSource && (
              <span className="text-[10px] text-slate-500 font-mono">
                ({displayTitleSource})
              </span>
            )}
          </h4>
          <div className="bg-slate-800/50 rounded-md p-3 border border-slate-700/50 text-sm text-white">
            {displayTitle}
            {displayTitleReason && (
              <div className="text-[10px] text-slate-400 mt-1">
                選定理由: {displayTitleReason}
              </div>
            )}
            {inferredTitle && (
              <span className="ml-2 text-xs text-slate-400">
                (推論: {inferredTitle})
              </span>
            )}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
            分類情報
          </h4>
          <div className="bg-slate-800/50 rounded-md p-3 border border-slate-700/50 text-xs text-slate-300 grid grid-cols-2 gap-2">
            <div>
              種類:{" "}
              <span className="text-white font-medium">
                {docKindText || "-"}
              </span>
            </div>
            <div>
              主言語:{" "}
              <span className="text-white font-medium">
                {primaryLang || "-"}
              </span>
            </div>
            <div>
              言語リスト:{" "}
              <span className="text-white font-medium">
                {languagesList || "-"}
              </span>
            </div>
            <div className="col-span-2">
              信頼度:{" "}
              <span className="text-white font-medium">
                {confidence ? (confidence * 100).toFixed(1) : "-"}%
              </span>
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
            トピック & キーワード
          </h4>
          <div className="bg-slate-800/50 rounded-md p-3 border border-slate-700/50">
            <div className="mb-2">
              <div className="text-[10px] text-slate-500 mb-1">
                トピック (分類ラベル):
              </div>
              <div className="flex flex-wrap gap-1">
                {topics?.length > 0 ? (
                  topics.map((t: string, i: number) => (
                    <span
                      key={i}
                      className="px-2 py-0.5 bg-indigo-900/50 border border-indigo-700/50 text-indigo-300 rounded text-[10px]"
                    >
                      {t}
                    </span>
                  ))
                ) : (
                  <span className="text-xs text-slate-500">なし</span>
                )}
              </div>
            </div>
            <div>
              <div className="text-[10px] text-slate-500 mb-1">キーワード:</div>
              <div className="flex flex-wrap gap-1">
                {keywords?.length > 0 ? (
                  keywords.map((kw: string, i: number) => (
                    <span
                      key={i}
                      className="px-2 py-0.5 bg-slate-700/50 border border-slate-600/50 text-slate-300 rounded text-[10px]"
                    >
                      {kw}
                    </span>
                  ))
                ) : (
                  <span className="text-xs text-slate-500">なし</span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
          ドメイン分類 (Subject Areas)
        </h4>
        <div className="bg-slate-800/50 rounded-md p-3 border border-slate-700/50 text-xs">
          {saDomains && saDomains.length > 0 ? (
            saDomains.map((d: any, idx: number) => (
              <div key={idx} className="mb-1 flex items-start">
                <span className="text-slate-400 w-32 shrink-0">
                  {d.domain}
                  {d.confidence !== null &&
                    ` (${Math.round(d.confidence * 100)}%)`}
                  :
                </span>
                <span className="text-white">{d.labels || "該当なし"}</span>
              </div>
            ))
          ) : (
            <span className="text-slate-500">該当なし</span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
            固有表現
          </h4>
          <div className="bg-slate-800/50 rounded-md p-3 border border-slate-700/50 text-xs">
            {nEntities?.length > 0 ? (
              <ul className="space-y-1">
                {nEntities.map((ne: any, i: number) => (
                  <li key={i} className="flex">
                    <span className="text-slate-500 w-24 shrink-0">
                      {ne.type}:
                    </span>{" "}
                    <span className="text-slate-200">{ne.name}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <span className="text-slate-500">なし</span>
            )}
          </div>
        </div>

        <div className="space-y-2">
          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
            関係者 (Parties)
          </h4>
          <div className="bg-slate-800/50 rounded-md p-3 border border-slate-700/50 text-xs">
            {parties?.length > 0 ? (
              <ul className="space-y-1">
                {parties.map((pt: any, i: number) => (
                  <li key={i} className="flex">
                    <span className="text-slate-500 w-20 shrink-0">
                      {pt.role}:
                    </span>
                    <span className="text-slate-200">
                      {pt.name}{" "}
                      {pt.kind && (
                        <span className="text-[10px] text-slate-500">
                          ({pt.kind})
                        </span>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <span className="text-slate-500">なし</span>
            )}
          </div>
        </div>
      </div>

      {(tempRefs?.length > 0 ||
        mAmounts?.length > 0 ||
        rReferences?.length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {tempRefs && tempRefs.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                時間参照 (V1.2)
              </h4>
              <div className="bg-slate-800/50 rounded-md p-3 border border-slate-700/50 text-xs">
                <ul className="space-y-1">
                  {tempRefs.map((tr: any, i: number) => (
                    <li key={i} className="flex">
                      <span className="text-slate-500 w-24 shrink-0">
                        {tr.role}:
                      </span>{" "}
                      <span className="text-slate-200">
                        {tr.date || "-"}{" "}
                        <span className="text-[10px] text-slate-500">
                          ({tr.raw})
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {mAmounts && mAmounts.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                金額 (V1.2)
              </h4>
              <div className="bg-slate-800/50 rounded-md p-3 border border-slate-700/50 text-xs">
                <ul className="space-y-1">
                  {mAmounts.map((ma: any, i: number) => (
                    <li key={i} className="flex">
                      <span className="text-slate-500 w-24 shrink-0">
                        {ma.role}:
                      </span>{" "}
                      <span className="text-slate-200">
                        {ma.amount} {ma.currency}{" "}
                        <span className="text-[10px] text-slate-500">
                          ({ma.raw})
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {rReferences && rReferences.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                リソース参照 (V1.2)
              </h4>
              <div className="bg-slate-800/50 rounded-md p-3 border border-slate-700/50 text-xs">
                <ul className="list-disc pl-5 text-blue-400 space-y-1">
                  {rReferences.map((rr: any, i: number) => (
                    <li key={i}>
                      <a
                        href={rr.uri}
                        target="_blank"
                        rel="noreferrer"
                        className="hover:underline break-all"
                      >
                        {rr.uri}
                      </a>
                      {rr.raw && rr.raw !== rr.uri && (
                        <span className="text-slate-500 ml-2">({rr.raw})</span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>
      )}

      {repairWarnings?.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-bold text-sky-400 uppercase tracking-wider">
            修復ノート (Repair Warnings)
          </h4>
          <ul className="list-disc pl-5 text-xs text-sky-200 space-y-1 bg-sky-900/30 rounded-md p-3 border border-sky-800/50">
            {repairWarnings.map((w: string, i: number) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      {warnings?.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-bold text-amber-500 uppercase tracking-wider">
            警告
          </h4>
          <ul className="list-disc pl-5 text-xs text-amber-200 space-y-1 bg-amber-950/30 rounded-md p-3 border border-amber-900/50">
            {warnings.map((w: string, i: number) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider font-mono">
            Raw JSON
          </h4>
          <div className="flex gap-2">
            <button
              onClick={() => navigator.clipboard.writeText(rawText || "")}
              className="px-2 py-1 text-[9px] text-slate-400 hover:text-white transition-colors uppercase font-bold flex items-center gap-1 border border-slate-700 rounded bg-slate-800"
            >
              生テキスト(Raw)コピー
            </button>
            <button
              onClick={() =>
                navigator.clipboard.writeText(
                  JSON.stringify(structured, null, 2),
                )
              }
              className="px-2 py-1 text-[9px] text-slate-400 hover:text-white transition-colors uppercase font-bold flex items-center gap-1 border border-slate-700 rounded bg-slate-800"
            >
              JSONコピー
            </button>
          </div>
        </div>
        <pre className="bg-black/50 p-3 rounded-md border border-slate-800 text-[10px] text-emerald-300 font-mono overflow-x-auto">
          {JSON.stringify(structured, null, 2)}
        </pre>
      </div>
    </div>
  );
};

const RequestPreviewPanel: React.FC<{ preview: any }> = ({ preview }) => {
  const [expanded, setExpanded] = useState(false);

  if (!preview) return null;

  return (
    <div className="mt-8 border border-slate-700/50 rounded-lg overflow-hidden bg-slate-900/50">
      <div 
        className="px-4 py-3 bg-slate-800 flex items-center justify-between cursor-pointer hover:bg-slate-700 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2">
          <Code className="w-4 h-4 text-indigo-400" />
          <h3 className="text-sm font-semibold text-slate-200">Request Preview & Debug Info</h3>
        </div>
        {expanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
      </div>
      
      {expanded && (
        <div className="p-4 space-y-4 text-sm">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-[10px] text-slate-500 uppercase font-bold">Model</p>
              <p className="text-slate-300 font-mono">{preview.model}</p>
            </div>
            <div>
              <p className="text-[10px] text-slate-500 uppercase font-bold">Effective Execution Mode</p>
              <p className="text-indigo-400 font-mono">{preview.effectiveStructuredExecutionMode || preview.requestedOutputMode}</p>
            </div>
            <div>
              <p className="text-[10px] text-slate-500 uppercase font-bold">Response Schema</p>
              <p className="text-slate-300 font-mono">{preview.responseSchemaEnabled ? "Sent" : "Omitted"}</p>
            </div>
            <div>
              <p className="text-[10px] text-slate-500 uppercase font-bold">Native Schema Support</p>
              <p className="text-slate-300 font-mono">{preview.supportsNativeResponseSchema ? "Yes" : "No"}</p>
            </div>
          </div>
          
          <div className="flex gap-2">
            <button
              onClick={(e) => {
                e.stopPropagation();
                navigator.clipboard.writeText(JSON.stringify(preview, null, 2));
              }}
              className="px-3 py-1.5 text-xs text-indigo-300 hover:text-white border border-indigo-900 hover:border-indigo-500 rounded bg-indigo-950/50 transition-colors flex items-center gap-1"
            >
              <Clipboard className="w-3 h-3" />
              Copy Request Preview
            </button>
            
            {preview.taskPrompt && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  navigator.clipboard.writeText(preview.taskPrompt);
                }}
                className="px-3 py-1.5 text-xs text-slate-300 hover:text-white border border-slate-700 hover:border-slate-500 rounded bg-slate-800 transition-colors flex items-center gap-1"
              >
                <Clipboard className="w-3 h-3" />
                Copy Effective Prompt
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export const SummaryDebugger: React.FC<SummaryDebuggerProps> = ({
  token,
  onSessionExpiry,
  userId,
  setActiveTab,
  config
}) => {
  const [inputMode, setInputMode] = useState<"drive" | "manual">("drive");
  const [manualText, setManualText] = useState("");
  const [manualInputLabel, setManualInputLabel] = useState<string | null>(null);
  const [fileId, setFileId] = useState("");
  const [outputMode, setOutputMode] = useState<"text" | "structured">("text");
  const [modelName, setModelName] = useState(() => {
    try {
      return localStorage.getItem(SELECTED_MODEL_KEY) || "gemini-3.5-flash";
    } catch (e) {
      return "gemini-3.5-flash";
    }
  });
  const [loading, setLoading] = useState(false);
  const [fetchingSamples, setFetchingSamples] = useState(false);
  const [samples, setSamples] = useState<any[]>([]);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [rawErrorResponse, setRawErrorResponse] = useState<string | null>(null);
  const [providerError, setProviderError] = useState<any>(null);
  const [refinedErrorText, setRefinedErrorText] = useState<string | null>(null);
  const [fullErrorText, setFullErrorText] = useState<string | null>(null);
  const [responseTitle, setResponseTitle] = useState<string | null>(null);
  const [errorViewTab, setErrorViewTab] = useState<"raw" | "text">("raw");
  const [usedModel, setUsedModel] = useState<string | null>(null);
  const [validationHistory, setValidationHistory] = useState<
    ValidationRecord[]
  >([]);
  const [experimentHistory, setExperimentHistory] = useState<
    ExperimentHistoryRecord[]
  >([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [loadingExperimentHistory, setLoadingExperimentHistory] =
    useState(false);
  const [customPrompt, setCustomPrompt] = useState("");
  const [firestorePersisted, setFirestorePersisted] = useState<
    "persisted" | "not_persisted" | "checking" | "failed"
  >("checking");
  const [savingToFirestore, setSavingToFirestore] = useState(false);
  const [saveStatus, setSaveStatus] = useState<{
    type: "success" | "error" | null;
    message: string | null;
  }>({ type: null, message: null });
  const [savedMetadata, setSavedMetadata] = useState<any>(null);
  const [selectedParentId, setSelectedParentId] = useState<string>("");
  const [dirs, setDirs] = useState<any[]>([]);
  const [loadingDirs, setLoadingDirs] = useState(false);
  const [showMatrix, setShowMatrix] = useState(false);

  const currentFileModifiedTime = useMemo(() => {
    if (result?.metadata?.modifiedTime) {
      return result.metadata.modifiedTime;
    }
    const selectedFile = samples.find((s) => s.file.id === fileId);
    return selectedFile?.file?.modifiedTime;
  }, [result, samples, fileId]);

  const fetchDirs = useCallback(async () => {
    const currentUid = userId || auth.currentUser?.uid;
    if (!currentUid) return;
    setLoadingDirs(true);
    try {
      const q = collection(db, "users", currentUid, "directories");
      const snap = await getDocs(q);
      const fetchedDirs = snap.docs.map((doc) => ({
        drive_id: doc.id,
        ...doc.data(),
      }));
      setDirs(fetchedDirs);
    } catch (err) {
      console.error("Failed to fetch directories from Firestore:", err);
    } finally {
      setLoadingDirs(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchDirs();
  }, [fetchDirs]);

  const checkFirestorePersistence = useCallback(
    async (selectedFileId: string) => {
      const currentUid = userId || auth.currentUser?.uid;
      if (!currentUid || !selectedFileId.trim() || inputMode !== "drive") {
        setFirestorePersisted("not_persisted");
        setSavedMetadata(null);
        return;
      }
      setFirestorePersisted("checking");
      try {
        const docPath = getFileSummaryDocPath(currentUid, selectedFileId);
        const docRef = doc(db, docPath);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          setSavedMetadata(data);
          setFirestorePersisted("persisted");
          if (data.parentId) {
            setSelectedParentId(data.parentId);
          }
        } else {
          setSavedMetadata(null);
          setFirestorePersisted("not_persisted");
        }
      } catch (err) {
        console.error("Failed to check Firestore persistence:", err);
        setFirestorePersisted("failed");
        setSavedMetadata(null);
      }
    },
    [userId, inputMode],
  );

  useEffect(() => {
    if (inputMode === "drive" && fileId) {
      checkFirestorePersistence(fileId);
    } else {
      setFirestorePersisted("not_persisted");
      setSavedMetadata(null);
    }
  }, [fileId, inputMode, checkFirestorePersistence]);

  const handleSaveToFirestore = async () => {
    if (!result || result.outputMode !== "structured" || !result.structured)
      return;
    const currentUid = userId || auth.currentUser?.uid;
    if (!currentUid) {
      setSaveStatus({
        type: "error",
        message: "ユーザーが認証されていません。ログインしてください。",
      });
      return;
    }

    const selectedFileId = fileId.trim();
    if (!selectedFileId) {
      setSaveStatus({ type: "error", message: "ファイルIDが見つかりません。" });
      return;
    }

    setSavingToFirestore(true);
    setSaveStatus({ type: null, message: null });

    try {
      const metadataRaw = buildFileSummaryMetadata({
        fileId: selectedFileId,
        fileName: result.metadata?.name,
        mimeType: result.metadata?.mimeType,
        modifiedTime: result.metadata?.modifiedTime,
        parentId: selectedParentId || undefined,
        model: usedModel || modelName,
        structured: result.structured,
        validationErrors: result.validationErrors || [],
        parseSuccess: result.success && !result.structuredParseFailed,
        validationSuccess:
          result.success && !result.structuredParseFailed && !result.error,
        source: "ai-summary-test",
        schemaVersion: result.schemaVersion,
        promptVersion:
          result.schemaVersion === "1.2.0-draft.2"
            ? "1.2.0-draft.2"
            : undefined,
        systemInstructionVersion:
          result.schemaVersion === "1.2.0-draft.2"
            ? "1.2.0-draft.2"
            : undefined,
      });

      if (!isPersistableStructuredSummary(metadataRaw)) {
        setSaveStatus({
          type: "error",
          message:
            "この要約は保存可能な要約メタデータの条件（パース成功、バリデーション成功など）を満たしていません。",
        });
        return;
      }

      if (
        savedMetadata &&
        shouldSkipFirestoreSummaryWrite(savedMetadata, metadataRaw)
      ) {
        setSaveStatus({
          type: "success",
          message:
            "内容に変更がないため、Firestoreへの書き込みをスキップしました（スキップ最適化）。",
        });
        setFirestorePersisted("persisted");
        setSavingToFirestore(false);
        return;
      }

      const sanitizedMetadata =
        sanitizeSummaryMetadataForFirestore(metadataRaw);
      const docPath = getFileSummaryDocPath(currentUid, selectedFileId);
      const docRef = doc(db, docPath);

      await setDoc(docRef, sanitizedMetadata, { merge: true });

      setSaveStatus({
        type: "success",
        message: "Firestoreへ正常にメタデータを保存しました。",
      });
      setFirestorePersisted("persisted");
      setSavedMetadata(sanitizedMetadata);
    } catch (err: any) {
      console.error("Failed to save to Firestore:", err);
      try {
        handleFirestoreError(
          err,
          OperationType.WRITE,
          `users/${currentUid}/file_summaries/${selectedFileId}`,
        );
      } catch (formattedErr: any) {
        setSaveStatus({ type: "error", message: formattedErr.message });
      }
    } finally {
      setSavingToFirestore(false);
    }
  };

  const currentMimeType = useMemo(() => {
    return samples.find((s) => s.file.id === fileId)?.file.mimeType;
  }, [samples, fileId]);

  useEffect(() => {
    if (!currentMimeType) {
      setCustomPrompt(
        "以下のファイル内容（最大5万文字のスニペット）を分析し、主な内容の要約を日本語で出力してください。",
      );
      return;
    }
    const isBinary =
      currentMimeType.startsWith("image/") ||
      currentMimeType === "application/pdf";
    if (isBinary) {
      setCustomPrompt(
        "以下のファイル内容を分析し、何が記載・描写されているか要約してください。日本語で出力してください。",
      );
    } else {
      setCustomPrompt(
        "以下のファイル内容（最大5万文字のスニペット）を分析し、主な内容の要約を日本語で出力してください。",
      );
    }
  }, [currentMimeType, fileId]);

  const handleCellClick = useCallback(
    (selectedModelId: string, mimeType: string) => {
      // Select Model
      setModelName(selectedModelId);
      try {
        localStorage.setItem(SELECTED_MODEL_KEY, selectedModelId);
      } catch (e) {
        // Silent
      }

      // Find matching sample file
      const matchingSample = samples.find((s) => {
        const fileMime = s.file.mimeType || "";
        if (mimeType === "text")
          return (
            fileMime.startsWith("text/") || fileMime === "application/json"
          );
        if (mimeType === "image") return fileMime.startsWith("image/");
        return fileMime === mimeType;
      });

      if (matchingSample) {
        setFileId(matchingSample.file.id);
        try {
          localStorage.setItem(SELECTED_FILE_ID_KEY, matchingSample.file.id);
        } catch (e) {
          // Silent
        }
      }
    },
    [samples],
  );

  const fetchValidationHistory = async () => {
    try {
      setLoadingHistory(true);
      const res = await fetch("/api/validation-history");
      if (res.ok) {
        const data = await res.json();
        setValidationHistory(data);
      }
    } catch (e) {
      console.error("Failed to fetch validation history", e);
    } finally {
      setLoadingHistory(false);
    }
  };

  const fetchExperimentHistory = async () => {
    try {
      setLoadingExperimentHistory(true);
      const res = await fetch("/api/experiment-history");
      if (res.ok) {
        const data = await res.json();
        setExperimentHistory(data);
      }
    } catch (e) {
      console.error("Failed to fetch experiment history", e);
    } finally {
      setLoadingExperimentHistory(false);
    }
  };

  const clearExperimentHistory = async () => {
    if (
      !confirm("Are you sure you want to clear the local experiment history?")
    )
      return;
    try {
      setLoadingExperimentHistory(true);
      await fetch("/api/experiment-history/clear", { method: "POST" });
      setExperimentHistory([]);
    } catch (e) {
      console.error("Failed to clear experiment history", e);
    } finally {
      setLoadingExperimentHistory(false);
    }
  };

  useEffect(() => {
    fetchValidationHistory();
    fetchExperimentHistory();
  }, []);

  const extractTextFromHtml = (html: string) => {
    try {
      // 1. Regex to remove all style and script tags very aggressively before DOM parsing
      let cleanHtml = html
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
        .replace(/<!--[\s\S]*?-->/g, ""); // remove comments

      const parser = new DOMParser();
      const doc = parser.parseFromString(cleanHtml, "text/html");

      // 2. Remove any remaining noisy tags
      doc
        .querySelectorAll("style, script, svg, symbol, defs")
        .forEach((el) => el.remove());

      // 3. Fallback safely to textContent
      let fullText =
        doc.body?.textContent || doc.documentElement.textContent || "";

      // 4. Strip any remaining tags, normalize whitespace
      fullText = fullText
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim();

      // Snippet for clipboard/preview
      const bodyTextSnippet = fullText.slice(0, 500);

      const title = doc.querySelector("title")?.textContent || null;
      let refined = "";
      if (title) refined += `[Title: ${title}] `;
      if (bodyTextSnippet) refined += bodyTextSnippet;

      return {
        refined: refined || null,
        fullText: fullText || null,
        title: title,
      };
    } catch (e) {
      return { refined: null, fullText: null, title: null };
    }
  };
  const [copied, setCopied] = useState(false);
  const [errorCopied, setErrorCopied] = useState(false);

  // Load samples and selected file from server on mount
  useEffect(() => {
    try {
      const cachedSamples = localStorage.getItem(CACHE_KEY);
      if (cachedSamples) {
        const parsed = JSON.parse(cachedSamples);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setSamples(parsed);
        }
      }

      const cachedFileId = localStorage.getItem(SELECTED_FILE_ID_KEY);
      if (cachedFileId) {
        setFileId(cachedFileId);
      }
    } catch (e) {
      console.error("Failed to parse or access cached data", e);
    }
  }, []);

  const fetchSamples = async () => {
    setFetchingSamples(true);
    setError(null);
    try {
      const res = await fetch(`/api/drive/debug/sample-files`, {
        headers: getDriveAuthHeaders(token || ""),
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 401) {
          console.warn("401 Unauthorized detected:", data);
          onSessionExpiry?.();
          throw new Error(
            "認証の有効期限が切れました。自動的にログアウトしますので、再度ログインしてください。",
          );
        }
        throw new Error(
          `API Error (${res.status}): ${data.error || "Unknown error"}`,
        );
      }
      if (data.samples) {
        setSamples(data.samples);
        // Save to cache
        try {
          localStorage.setItem(CACHE_KEY, JSON.stringify(data.samples));
        } catch (e) {
          console.warn("Failed to save samples to cache", e);
        }
      }
    } catch (err: any) {
      console.error("Failed to fetch samples", err);
      setError(err.message || "Failed to fetch samples");
    } finally {
      setFetchingSamples(false);
    }
  };

  const handleGenerate = async (targetMode: "text" | "structured") => {
    if (inputMode === "drive" && !fileId.trim()) return;
    if (inputMode === "manual" && !manualText.trim()) return;

    setOutputMode(targetMode);
    setLoading(true);
    setResult(null);
    setError(null);
    setRawErrorResponse(null);
    setProviderError(null);
    setUsedModel(modelName);

    let parsedId = fileId.trim();
    if (inputMode === "drive") {
      if (parsedId.includes("drive.google.com/file/d/")) {
        parsedId = parsedId.split("/d/")[1].split("/")[0];
      } else if (parsedId.includes("docs.google.com/document/d/")) {
        parsedId = parsedId.split("/d/")[1].split("/")[0];
      } else if (parsedId.includes("docs.google.com/spreadsheets/d/")) {
        parsedId = parsedId.split("/d/")[1].split("/")[0];
      } else if (parsedId.includes("docs.google.com/presentation/d/")) {
        parsedId = parsedId.split("/d/")[1].split("/")[0];
      }
      setFileId(parsedId);
    }

    try {
      let response;
      if (inputMode === "drive") {
        response = await fetch("/api/drive/debug/generate-file-summary", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...getDriveAuthHeaders(token || ""),
          },
          body: JSON.stringify({
            fileId: parsedId,
            modelName,
            customInstruction: customPrompt,
            outputMode: targetMode,
            includeRequestPreview: true,
            jsonMode: config.json_mode
          }),
        });
      } else {
        response = await fetch("/api/drive/debug/generate-manual-summary", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...getDriveAuthHeaders(token || ""),
          },
          body: JSON.stringify({
            text: manualText,
            modelName,
            customInstruction: customPrompt,
            outputMode: targetMode,
            inputLabel: manualInputLabel,
            includeRequestPreview: true,
            jsonMode: config.json_mode
          }),
        });
      }

      const text = await response.text();

      if (!response.ok) {
        setRawErrorResponse(text);

        // Try to refine error text based on content type
        if (
          text.trim().startsWith("<") ||
          text.toLowerCase().includes("<!doctype html>")
        ) {
          const { refined, fullText, title } = extractTextFromHtml(text);
          setRefinedErrorText(refined);
          setFullErrorText(fullText);
          setResponseTitle(title);
        } else {
          try {
            // If it's JSON, try to extract the error message nicely
            const jsonObj = JSON.parse(text);
            if (jsonObj.providerError) {
              setProviderError(jsonObj.providerError);
            }
            const extractedText =
              jsonObj.error?.message ||
              jsonObj.message ||
              jsonObj.error ||
              JSON.stringify(jsonObj, null, 2);
            setFullErrorText(
              typeof extractedText === "string"
                ? extractedText
                : JSON.stringify(extractedText, null, 2),
            );
            setRefinedErrorText(null);
            setResponseTitle("JSON Error Response");
          } catch (e) {
            // Plain text
            setRefinedErrorText(null);
            setFullErrorText(text);
            setResponseTitle(null);
          }
        }

        if (response.status === 401) {
          onSessionExpiry?.();
          throw new Error(
            "認証の有効期限が切れました。再度ログインしてください。",
          );
        }

        let data;
        try {
          data = JSON.parse(text);
        } catch (e) {
          throw new Error(
            `Server returned non-JSON response (${response.status})`,
          );
        }

        // Handle specific Gemini API or Proxy errors
        if (data && data.error) {
          if (
            typeof data.error === "string" &&
            data.error.includes("RESOURCE_EXHAUSTED")
          ) {
            throw new Error(
              "Gemini APIの利用制限に達しました。別のモデルをお試しください。",
            );
          }
          throw new Error(data.error);
        }

        throw new Error(`Generation failed with status ${response.status}`);
      }

      try {
        const data = JSON.parse(text);
        setResult(data);
      } catch (e) {
        setRawErrorResponse(text);
        if (
          text.trim().startsWith("<") ||
          text.toLowerCase().includes("<!doctype html>")
        ) {
          const { refined, fullText, title } = extractTextFromHtml(text);
          setRefinedErrorText(refined);
          setFullErrorText(fullText);
          setResponseTitle(title);
        } else {
          setRefinedErrorText(null);
          setFullErrorText(text); // show raw text as text also
          setResponseTitle(null);
        }
        throw new Error("Failed to parse response as JSON");
      }
    } catch (err: any) {
      setError(err.message || "An unknown error occurred");
    } finally {
      setLoading(false);
    }
  };

  const copyErrorInfo = () => {
    const selectedFile = samples.find((s) => s.file.id === fileId);
    const info = `
失敗
File: ${selectedFile?.file.name || "Unknown"}
MIME: ${selectedFile?.file.mimeType || "unknown"}
Model: ${usedModel || modelName}
Error: ${error}
${responseTitle ? `Page Title: ${responseTitle}\n` : ""}${refinedErrorText ? `Response Preview (Text): ${refinedErrorText.slice(0, 100)}${refinedErrorText.length > 100 ? "..." : ""}\n` : ""}Raw Response Preview: ${rawErrorResponse?.slice(0, 1000) || "None"}
    `.trim();

    try {
      if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(info).then(() => {
          setErrorCopied(true);
          setTimeout(() => setErrorCopied(false), 2000);
        });
      } else {
        const textArea = document.createElement("textarea");
        textArea.value = info;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand("copy");
        textArea.remove();
        setErrorCopied(true);
        setTimeout(() => setErrorCopied(false), 2000);
      }
    } catch (err) {
      console.error("Failed to copy info:", err);
    }
  };

  const copyMetadata = async () => {
    if (!result) return;

    const lines = ["成功。"];
    if (result.metadata?.name) lines.push(`File: ${result.metadata.name}`);
    if (result.metadata?.mimeType)
      lines.push(`MIME: ${result.metadata.mimeType}`);
    lines.push(`Model: ${usedModel || modelName}`);
    if (result.summary) {
      const firstLine = result.summary
        .split("\n")
        .map((l) => l.trim())
        .filter((l) => l.length > 0)[0];
      if (firstLine) {
        lines.push(`Summary First Line: ${firstLine}`);
      }
    }

    const text = lines.join("\n");

    try {
      // Fallback for environments where navigator.clipboard might be restricted
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } else {
        // Fallback using traditional execCommand
        const textArea = document.createElement("textarea");
        textArea.value = text;
        textArea.style.position = "fixed";
        textArea.style.left = "-9999px";
        textArea.style.top = "0";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand("copy");
        textArea.remove();
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    } catch (err) {
      console.error("Failed to copy text: ", err);
      alert(
        "クリップボードへのコピーに失敗しました。詳細: " +
          (err as Error).message,
      );
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Input Section */}
      <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm space-y-4">
        {/* Input Mode Toggle */}
        <div className="flex border-b border-slate-200 mb-4">
          <button
            onClick={() => setInputMode("drive")}
            className={`px-4 py-2 text-sm font-semibold border-b-2 transition-colors ${inputMode === "drive" ? "border-indigo-600 text-indigo-600" : "border-transparent text-slate-500 hover:text-slate-700"}`}
          >
            Google Drive ファイル
          </button>
          <button
            onClick={() => setInputMode("manual")}
            className={`px-4 py-2 text-sm font-semibold border-b-2 transition-colors ${inputMode === "manual" ? "border-indigo-600 text-indigo-600" : "border-transparent text-slate-500 hover:text-slate-700"}`}
          >
            マニュアル入力 (テスト用)
          </button>
        </div>

        {inputMode === "drive" ? (
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">
              ドライブ ファイル ID または共有リンク URL
            </label>
            <div className="flex bg-slate-50 border border-slate-200 rounded-md overflow-hidden">
              <span className="flex items-center px-3 text-slate-400 bg-slate-100 border-r border-slate-200">
                <LinkIcon className="w-4 h-4" />
              </span>
              <input
                type="text"
                value={fileId}
                onChange={(e) => {
                  const val = e.target.value;
                  setFileId(val);
                  try {
                    localStorage.setItem(SELECTED_FILE_ID_KEY, val);
                  } catch (err) {
                    // Silent
                  }
                }}
                placeholder="例: 1BxiMVs0XRYNzOQxx7_IcbOxyz..."
                className="w-full bg-transparent p-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            {fileId.trim() && (
              <>
                <div className="mt-2 flex items-center gap-2">
                  <span className="text-xs text-slate-500">
                    Firestoreステータス:
                  </span>
                  {firestorePersisted === "persisted" ? (
                    <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 text-xs px-2.5 py-0.5 rounded-full border border-emerald-200 font-bold">
                      <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                      Firestore: Persisted (保存済み)
                    </span>
                  ) : firestorePersisted === "checking" ? (
                    <span className="inline-flex items-center gap-1 bg-indigo-50 text-indigo-700 text-xs px-2.5 py-0.5 rounded-full border border-indigo-200 font-bold animate-pulse">
                      <Loader2 className="w-3 h-3 animate-spin text-indigo-500" />
                      確認中...
                    </span>
                  ) : firestorePersisted === "failed" ? (
                    <span className="inline-flex items-center gap-1 bg-rose-50 text-rose-700 text-xs px-2.5 py-0.5 rounded-full border border-rose-200 font-bold">
                      <span className="w-1.5 h-1.5 bg-rose-500 rounded-full" />
                      ステータス取得エラー
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 bg-slate-100 text-slate-600 text-xs px-2.5 py-0.5 rounded-full border border-slate-200 font-medium">
                      <span className="w-1.5 h-1.5 bg-slate-400 rounded-full" />
                      Firestore: Not persisted (未保存)
                    </span>
                  )}
                </div>

                {savedMetadata && (
                  <div className="mt-4 border border-indigo-100 bg-indigo-50/20 rounded-lg p-4 space-y-3">
                    <div className="flex items-center justify-between border-b border-indigo-100/50 pb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                          保存済みメタデータ詳細 (Saved Metadata Detail)
                        </span>
                        {(() => {
                          const status = getSummaryMetadataStatus({
                            savedMetadata,
                            currentSchemaVersion:
                              SCHEMA_VERSION_V12,
                            currentPromptVersion:
                              SUMMARY_ANALYSIS_PROMPT_VERSION,
                            currentSystemInstructionVersion:
                              SUMMARY_DEBUG_SYSTEM_INSTRUCTION_VERSION,
                            currentFileModifiedTime: currentFileModifiedTime,
                          });

                          switch (status) {
                            case "current":
                              return (
                                <span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-800 text-[10px] px-2 py-0.5 rounded border border-emerald-200 font-bold">
                                  最新状態 (Current)
                                </span>
                              );
                            case "stale-schema":
                              return (
                                <span
                                  className="inline-flex items-center gap-1 bg-amber-100 text-amber-800 text-[10px] px-2 py-0.5 rounded border border-amber-200 font-bold"
                                  title="スキーマバージョン不一致"
                                >
                                  スキーマが古い (Stale Schema)
                                </span>
                              );
                            case "stale-prompt":
                              return (
                                <span
                                  className="inline-flex items-center gap-1 bg-amber-100 text-amber-800 text-[10px] px-2 py-0.5 rounded border border-amber-200 font-bold"
                                  title="プロンプトまたはシステム指示バージョン不一致"
                                >
                                  プロンプトが古い (Stale Prompt)
                                </span>
                              );
                            case "stale-file":
                              return (
                                <span
                                  className="inline-flex items-center gap-1 bg-amber-100 text-amber-800 text-[10px] px-2 py-0.5 rounded border border-amber-200 font-bold"
                                  title="ファイル更新日時が新しくなっています"
                                >
                                  ファイル更新あり (Stale File)
                                </span>
                              );
                            case "invalid":
                              return (
                                <span className="inline-flex items-center gap-1 bg-rose-100 text-rose-800 text-[10px] px-2 py-0.5 rounded border border-rose-200 font-bold">
                                  無効なデータ (Invalid)
                                </span>
                              );
                            default:
                              return (
                                <span className="inline-flex items-center gap-1 bg-slate-100 text-slate-800 text-[10px] px-2 py-0.5 rounded border border-slate-200 font-bold">
                                  不明 (Unknown)
                                </span>
                              );
                          }
                        })()}
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => checkFirestorePersistence(fileId)}
                          className="p-1 text-slate-400 hover:text-slate-600 rounded hover:bg-slate-100 transition-colors"
                          title="診断を再読み込み"
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                      <div className="space-y-1 bg-white p-2.5 rounded border border-slate-100 shadow-sm">
                        <p className="text-slate-400">
                          ファイル名:{" "}
                          <span className="font-semibold text-slate-700">
                            {savedMetadata.fileName || "不明"}
                          </span>
                        </p>
                        <p className="text-slate-400">
                          モデル:{" "}
                          <span className="font-mono text-slate-700">
                            {savedMetadata.model || "不明"}
                          </span>
                        </p>
                        <p className="text-slate-400">
                          生成日時:{" "}
                          <span className="text-slate-700">
                            {savedMetadata.generatedAt
                              ? new Date(
                                  savedMetadata.generatedAt,
                                ).toLocaleString()
                              : "不明"}
                          </span>
                        </p>
                        <p className="text-slate-400">
                          更新日時(保存時):{" "}
                          <span className="text-slate-700">
                            {savedMetadata.modifiedTime
                              ? new Date(
                                  savedMetadata.modifiedTime,
                                ).toLocaleString()
                              : "不明"}
                          </span>
                        </p>
                      </div>

                      <div className="space-y-1 bg-white p-2.5 rounded border border-slate-100 shadow-sm">
                        <p className="text-slate-400">
                          スキーマVer:{" "}
                          <span className="font-mono text-slate-700">
                            {savedMetadata.schemaVersion || "不明"}
                          </span>
                        </p>
                        <p className="text-slate-400">
                          プロンプトVer:{" "}
                          <span className="font-mono text-slate-700">
                            {savedMetadata.promptVersion || "不明"}
                          </span>
                        </p>
                        <p className="text-slate-400">
                          システム指示Ver:{" "}
                          <span className="font-mono text-slate-700">
                            {savedMetadata.systemInstructionVersion || "不明"}
                          </span>
                        </p>
                        {savedMetadata.parentId && (
                          <p className="text-slate-400">
                            関連付け親ID:{" "}
                            <span className="font-mono text-indigo-600 bg-indigo-50 px-1 py-0.5 rounded border border-indigo-100">
                              {savedMetadata.parentId}
                            </span>
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Stale Warning & Hint */}
                    {(() => {
                      const status = getSummaryMetadataStatus({
                        savedMetadata,
                        currentSchemaVersion: SCHEMA_VERSION_V12,
                        currentPromptVersion: SUMMARY_ANALYSIS_PROMPT_VERSION,
                        currentSystemInstructionVersion:
                          SUMMARY_DEBUG_SYSTEM_INSTRUCTION_VERSION,
                        currentFileModifiedTime: currentFileModifiedTime,
                      });
                      if (status !== "current" && status !== "missing") {
                        return (
                          <div className="bg-amber-50 border border-amber-200 text-amber-800 text-[11px] p-2.5 rounded-md">
                            <span className="font-bold">⚠️ 注意: </span>
                            この保存データはスキーマ、プロンプト定義、または対象ファイルが古いため、最新モデルで要約を再生成することをお勧めします。
                          </div>
                        );
                      }
                      return null;
                    })()}

                    {/* Main Action Bar for Detail Panel */}
                    <div className="flex flex-wrap gap-2 pt-1">
                      <button
                        onClick={() => {
                          setResult({
                            outputMode: "structured",
                            structured: savedMetadata.structured,
                            summary: savedMetadata.summary,
                            success: true,
                            validationErrors:
                              savedMetadata.validationErrors || [],
                            metadata: {
                              name: savedMetadata.fileName,
                              mimeType: savedMetadata.mimeType,
                              modifiedTime: savedMetadata.modifiedTime,
                            },
                          });
                          setUsedModel(savedMetadata.model);
                          setError(null);
                        }}
                        className="px-3 py-1.5 bg-white border border-indigo-200 hover:bg-indigo-50 text-indigo-700 font-bold rounded text-[11px] transition-all flex items-center gap-1 shadow-sm"
                      >
                        <FileSearch className="w-3.5 h-3.5 text-indigo-600" />
                        現在のビューに結果を読み込む
                      </button>
                      <button
                        onClick={async () => {
                          try {
                            await navigator.clipboard.writeText(
                              JSON.stringify(savedMetadata, null, 2),
                            );
                            alert(
                              "メタデータJSONをクリップボードにコピーしました。",
                            );
                          } catch (err) {
                            console.error(err);
                          }
                        }}
                        className="px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 font-medium rounded text-[11px] transition-all flex items-center gap-1"
                      >
                        <Code className="w-3.5 h-3.5" />
                        JSONをコピー
                      </button>
                      <button
                        onClick={async () => {
                          try {
                            await navigator.clipboard.writeText(
                              savedMetadata.summary || "",
                            );
                            alert("要約文をコピーしました。");
                          } catch (err) {
                            console.error(err);
                          }
                        }}
                        className="px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 font-medium rounded text-[11px] transition-all flex items-center gap-1"
                      >
                        <Clipboard className="w-3.5 h-3.5" />
                        要約文をコピー
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">
                テスト用テキスト
                <span className="ml-2 text-xs text-rose-500 font-normal bg-rose-50 px-1.5 py-0.5 rounded border border-rose-100">
                  ※スキーマ評価専用
                </span>
              </label>
              <textarea
                value={manualText}
                onChange={(e) => {
                  setManualText(e.target.value);
                  setManualInputLabel(null); // Reset label if manually edited
                }}
                placeholder="テスト用のテキストをここに貼り付けてください。"
                className="w-full h-32 bg-slate-50 border border-slate-200 rounded-md p-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
              />
            </div>

            {/* Synthetic Fixtures Loader */}
            <div className="bg-amber-50/50 border border-amber-200 rounded-md p-3">
              <div className="flex items-center gap-1.5 mb-2">
                <FolderPlus className="w-4 h-4 text-amber-600" />
                <label className="text-xs font-bold text-amber-800">
                  Synthetic Fixtures (テスト用データセット)
                </label>
              </div>
              <p className="text-[10px] text-amber-700 mb-2">
                安全にスキーマ評価を行うための架空のダミーデータです。クリックするとテキストエリアに読み込まれます。
              </p>
              <div className="flex flex-wrap gap-2">
                {SUMMARY_FIXTURES.map((fixture) => (
                  <button
                    key={fixture.id}
                    onClick={() => {
                      setManualText(fixture.content);
                      setManualInputLabel(`Fixture: ${fixture.label}`);
                    }}
                    className="text-[10px] bg-white border border-amber-300 text-amber-700 hover:bg-amber-100 hover:text-amber-900 px-2 py-1 rounded transition-colors font-medium flex items-center gap-1"
                  >
                    <FileText className="w-3 h-3" />
                    {fixture.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-2">
            使用する言語モデル
          </label>
          <div className="flex flex-wrap gap-2">
            {MODELS.map((model) => (
              <button
                key={model.id}
                onClick={() => {
                  setModelName(model.id);
                  try {
                    localStorage.setItem(SELECTED_MODEL_KEY, model.id);
                  } catch (e) {
                    // Silent
                  }
                }}
                className={`text-[10px] sm:text-xs px-3 py-1.5 rounded-md border transition-all flex flex-col items-start ${
                  modelName === model.id
                    ? "bg-indigo-600 text-white border-indigo-600 shadow-sm"
                    : `${model.pricing.freeTier ? "bg-cyan-50/50 border-cyan-100 text-slate-600 hover:bg-cyan-50" : "bg-white text-slate-400 border-slate-200"} hover:border-indigo-300 hover:text-indigo-600`
                }`}
              >
                <div className="flex items-center gap-1">
                  <span className="font-bold">{model.label}</span>
                  {model.primary && (
                    <span
                      className={`text-[8px] uppercase px-1 rounded font-sans ${modelName === model.id ? "bg-indigo-500" : "bg-indigo-100 text-indigo-600"}`}
                    >
                      推奨
                    </span>
                  )}
                </div>
                {model.description && (
                  <span
                    className={`text-[8px] mt-0.5 ${modelName === model.id ? "text-indigo-100" : "text-slate-400"}`}
                  >
                    {model.description}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Model Info Detail */}
        {MODELS.find((m) => m.id === modelName) && (
          <div className="bg-slate-50 border border-slate-100 rounded-lg p-3 space-y-3">
            <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
              <div className="flex-1 space-y-2">
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">
                      正式モデルID:
                    </span>
                    <code className="text-[10px] bg-slate-200 px-1.5 py-0.5 rounded text-slate-700 font-mono">
                      {MODELS.find((m) => m.id === modelName)?.apiIdentifier}
                    </code>
                  </div>
                  {MODELS.find((m) => m.id === modelName)?.knowledgeCutOff && (
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">
                        学習データ締切:
                      </span>
                      <span className="text-[10px] font-bold text-slate-700">
                        {
                          MODELS.find((m) => m.id === modelName)
                            ?.knowledgeCutOff
                        }
                      </span>
                    </div>
                  )}
                  {MODELS.find((m) => m.id === modelName)?.releaseDate && (
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">
                        リリース日:
                      </span>
                      <span className="text-[10px] font-bold text-slate-700">
                        {MODELS.find((m) => m.id === modelName)?.releaseDate}
                      </span>
                    </div>
                  )}
                </div>

                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tight block">
                    価格体系 (Paid Tier)
                  </span>
                  <div className="flex gap-4">
                    <div>
                      <span className="text-[10px] text-slate-500 block">
                        入力 (1M tkn)
                      </span>
                      <span className="text-xs font-mono font-bold text-slate-700">
                        {
                          MODELS.find((m) => m.id === modelName)?.pricing
                            .inputPrice
                        }
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 block">
                        出力 (1M tkn)
                      </span>
                      <span className="text-xs font-mono font-bold text-slate-700">
                        {
                          MODELS.find((m) => m.id === modelName)?.pricing
                            .outputPrice
                        }
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 block">
                        Free Tier
                      </span>
                      <span
                        className={`text-xs font-bold ${MODELS.find((m) => m.id === modelName)?.pricing.freeTier ? "text-emerald-600" : "text-rose-600"}`}
                      >
                        {MODELS.find((m) => m.id === modelName)?.pricing
                          .freeTier
                          ? "あり"
                          : "なし"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tight block">
                  対応モーダル
                </span>
                <div className="flex flex-wrap gap-1">
                  {MODELS.find((m) => m.id === modelName)?.modalities.map(
                    (mod, i) => (
                      <span
                        key={i}
                        className="text-[9px] px-1.5 py-0.5 bg-white border border-slate-200 text-slate-600 rounded"
                      >
                        {mod}
                      </span>
                    ),
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {samples.length === 0 ? (
          <div className="pt-2">
            <button
              onClick={fetchSamples}
              disabled={fetchingSamples}
              className="text-sm flex items-center gap-1.5 text-indigo-600 hover:text-indigo-800 font-medium px-4 py-2 border border-indigo-100 rounded-md bg-indigo-50/50 hover:bg-indigo-50 transition-colors"
            >
              {fetchingSamples ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <FileSearch className="w-4 h-4" />
              )}
              サンプルファイルを検出する
            </button>
          </div>
        ) : (
          <div className="pt-2 border-t border-slate-100 mt-4">
            <div className="flex items-center justify-between mb-2 mt-2">
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">
                検出されたサンプルファイル
              </label>
              <button
                onClick={fetchSamples}
                disabled={fetchingSamples}
                className="text-[10px] flex items-center gap-1 text-slate-400 hover:text-indigo-600 font-medium transition-colors border border-transparent hover:border-indigo-100 px-1.5 py-0.5 rounded"
                title="サンプルファイルを再検出"
              >
                {fetchingSamples ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <RefreshCw className="w-3 h-3" />
                )}
                再検出
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {samples.map((sample, idx) => {
                const isSelected = fileId === sample.file.id;
                return (
                  <button
                    key={idx}
                    onClick={() => {
                      setFileId(sample.file.id);
                      try {
                        localStorage.setItem(
                          SELECTED_FILE_ID_KEY,
                          sample.file.id,
                        );
                      } catch (e) {
                        // Silent
                      }
                    }}
                    className={`border text-[10px] sm:text-xs py-1.5 px-3 rounded-full flex items-center gap-2 transition-all text-left max-w-xs truncate ${
                      isSelected
                        ? "bg-indigo-600 border-indigo-600 text-white shadow-sm"
                        : "bg-indigo-50 hover:bg-indigo-100 border-indigo-200 text-indigo-700"
                    }`}
                    title={sample.file.name}
                  >
                    <span
                      className={`font-bold flex-shrink-0 ${isSelected ? "text-indigo-100" : "opacity-70"}`}
                    >
                      {sample.category}
                    </span>
                    <span className="truncate">{sample.file.name}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Compatibility Matrix Section */}
      <div className="bg-slate-50/50 border border-slate-200 rounded-xl overflow-hidden transition-all duration-300">
        <button
          onClick={() => setShowMatrix(!showMatrix)}
          className="w-full flex items-center justify-between p-4 hover:bg-slate-100/50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div
              className={`p-2 rounded-lg transition-colors ${showMatrix ? "bg-indigo-100 text-indigo-600" : "bg-slate-200 text-slate-500"}`}
            >
              <LayoutGrid className="w-4 h-4" />
            </div>
            <div className="text-left">
              <h3 className="text-sm font-bold text-slate-700">
                モデル別ファイル形式対応状況 (検証マトリクス)
              </h3>
              <p className="text-[10px] text-slate-500 font-medium">
                {showMatrix
                  ? "マトリクスを閉じる"
                  : "モデルとファイル形式の互換性を確認・選択する"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {!showMatrix && (
              <div className="hidden sm:flex items-center gap-2 px-2 py-1 bg-white border border-slate-200 rounded text-[10px] text-slate-500 font-bold">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                全モデル検証済み
              </div>
            )}
            {showMatrix ? (
              <ChevronUp className="w-5 h-5 text-slate-400" />
            ) : (
              <ChevronDown className="w-5 h-5 text-slate-400" />
            )}
          </div>
        </button>

        {showMatrix && (
          <div className="p-4 pt-0 space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
            <div className="flex items-center justify-between py-2 border-t border-slate-200">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                Validation Grid
              </span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  fetchValidationHistory();
                }}
                disabled={loadingHistory}
                className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold text-slate-500 hover:text-indigo-600 bg-white border border-slate-200 hover:bg-indigo-50 rounded-md transition-colors disabled:opacity-50 shadow-sm"
              >
                <RefreshCw
                  className={`w-3 h-3 ${loadingHistory ? "animate-spin" : ""}`}
                />
                検証履歴を更新
              </button>
            </div>
            <div className="bg-white rounded-lg border border-slate-200 overflow-hidden shadow-inner">
              <CompatibilityMatrix
                history={validationHistory}
                currentModelId={modelName}
                currentMimeType={currentMimeType}
                onCellClick={handleCellClick}
              />
            </div>
            <div className="bg-amber-50 border border-amber-100 rounded-lg p-3 flex gap-2">
              <HelpCircle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
              <p className="text-[10px] text-amber-800 leading-relaxed">
                このマトリクスは、各モデルとファイル形式の組み合わせでの最新の検証結果を表示しています。
                セルをクリックすることで、モデルとテスト用のサンプルファイルを同時に切り替えることができます。
              </p>
            </div>
          </div>
        )}
      </div>

      <div className="mt-6">
        <label className="block text-sm font-semibold text-slate-700 mb-1">
          カスタム要約指示
        </label>
        <p className="text-xs text-slate-500 mb-2">
          この指示はAPIレベルのsystemInstructionではなく、要約タスク用の追加指示として本文・メタデータと一緒に送信されます。
        </p>
        <textarea
          value={customPrompt}
          onChange={(e) => setCustomPrompt(e.target.value)}
          className="w-full h-24 p-3 bg-slate-50 border border-slate-200 rounded-md text-sm font-mono text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-colors resize-y"
          placeholder="プロンプトを入力してください"
        />
      </div>

      <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
        <button
          onClick={() => handleGenerate("text")}
          disabled={
            loading ||
            (inputMode === "drive" ? !fileId.trim() : !manualText.trim())
          }
          className="w-full flex items-center justify-center gap-2 bg-slate-600 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold px-6 py-4 rounded-xl transition-all shadow-lg hover:shadow-slate-500/20 active:scale-[0.98]"
        >
          {loading && outputMode === "text" ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              生成中...
            </>
          ) : (
            <>
              <FileText className="w-5 h-5" />
              自由文要約を生成
            </>
          )}
        </button>

        <button
          onClick={() => handleGenerate("structured")}
          disabled={
            loading ||
            (inputMode === "drive" ? !fileId.trim() : !manualText.trim())
          }
          className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold px-6 py-4 rounded-xl transition-all shadow-lg hover:shadow-indigo-500/20 active:scale-[0.98]"
        >
          {loading && outputMode === "structured" ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              生成中...
            </>
          ) : (
            <>
              <Braces className="w-5 h-5" />
              構造化分析(JSON)を生成
            </>
          )}
        </button>
      </div>

      {/* Results Section */}
      <div className="mt-10 space-y-6">
        {error && (
          <div className="p-4 bg-rose-950/30 border border-rose-900/50 rounded-lg shadow-lg">
            <div className="flex items-center justify-between gap-3 mb-2">
              <div className="flex items-center gap-2 text-rose-400">
                <XCircle className="w-5 h-5" />
                <span className="font-bold text-sm">エラーが発生しました</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={copyErrorInfo}
                  className="flex items-center gap-1 text-[10px] px-2 py-1 rounded border bg-rose-900/40 text-rose-300 border-rose-800 hover:bg-rose-900/60 hover:text-white transition-all shadow-sm"
                >
                  {errorCopied ? (
                    <Check className="w-3 h-3 text-emerald-400" />
                  ) : (
                    <Clipboard className="w-3 h-3" />
                  )}
                  {errorCopied ? "コピーしました" : "失敗情報をコピー"}
                </button>
              </div>
            </div>
            <p className="text-rose-200/80 text-xs mb-4 font-mono break-all">
              {error}
            </p>

            {(error.includes("認証") ||
              error.includes("401") ||
              error.includes("UNAUTHENTICATED") ||
              error.includes("Invalid Credentials")) && (
              <div className="mb-4">
                <button
                  onClick={() => onSessionExpiry?.()}
                  className="w-full flex items-center justify-center gap-2 bg-rose-600 hover:bg-rose-700 text-white font-bold py-2 px-4 rounded transition-colors shadow-lg"
                >
                  <RefreshCw className="w-4 h-4" />
                  Google ドライブ認証をやり直す
                </button>
              </div>
            )}

            {refinedErrorText && (
              <div className="mt-4 p-3 bg-rose-950/30 border border-rose-500/20 rounded-lg">
                <label className="text-[10px] font-bold text-rose-300 uppercase tracking-tighter mb-1.5 block">
                  レスポンス内容 (抽出テキスト):
                </label>
                <p className="text-xs text-rose-100 font-medium leading-relaxed italic">
                  {refinedErrorText}
                </p>
              </div>
            )}

            {providerError && (
              <div className="mt-4 p-4 bg-amber-950/30 border border-amber-900/50 rounded-lg">
                <h4 className="text-xs font-bold text-amber-400 mb-2">Provider API Error</h4>
                <div className="space-y-1 text-sm font-mono text-amber-200/80">
                  <p><span className="text-amber-500/70">Status Code:</span> {providerError.statusCode}</p>
                  <p><span className="text-amber-500/70">Provider Status:</span> {providerError.providerStatus}</p>
                  {providerError.rawMessageSummary && (
                    <p><span className="text-amber-500/70">Message:</span> {providerError.rawMessageSummary}</p>
                  )}
                </div>
              </div>
            )}

            {rawErrorResponse && (
              <div className="mt-4">
                <div className="flex items-center justify-between gap-4 mb-2 border-b border-rose-900/30 pb-0">
                  <div className="flex items-center gap-0">
                    <button
                      onClick={() => setErrorViewTab("raw")}
                      className={`px-3 py-2 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all relative ${
                        errorViewTab === "raw"
                          ? "text-rose-400"
                          : "text-rose-900/60 hover:text-rose-400"
                      }`}
                    >
                      <Code className="w-3 h-3" />
                      Raw Response
                      {errorViewTab === "raw" && (
                        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-rose-500 rounded-full" />
                      )}
                    </button>
                    <button
                      onClick={() => setErrorViewTab("text")}
                      className={`px-3 py-2 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all relative ${
                        errorViewTab === "text"
                          ? "text-indigo-400"
                          : "text-indigo-900/60 hover:text-indigo-400"
                      }`}
                    >
                      <FileText className="w-3 h-3" />
                      Text Only
                      {errorViewTab === "text" && (
                        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-500 rounded-full" />
                      )}
                    </button>
                  </div>

                  <button
                    onClick={() => {
                      const content =
                        errorViewTab === "text"
                          ? fullErrorText || rawErrorResponse
                          : rawErrorResponse;
                      if (content) {
                        navigator.clipboard.writeText(content);
                        setErrorCopied(true);
                        setTimeout(() => setErrorCopied(false), 2000);
                      }
                    }}
                    className="px-2 py-1 text-[9px] text-rose-300/40 hover:text-rose-300 transition-colors uppercase font-bold flex items-center gap-1"
                  >
                    {errorCopied ? (
                      <Check className="w-2.5 h-2.5 text-emerald-400" />
                    ) : (
                      <Clipboard className="w-2.5 h-2.5" />
                    )}
                    {errorCopied ? "コピー" : "コピー"}
                  </button>
                </div>
                <div className="bg-black/40 rounded-b border-x border-b border-rose-900/30 p-3 overflow-x-auto max-h-[350px] custom-scrollbar">
                  <pre className="text-[10px] font-mono text-rose-300/70 whitespace-pre-wrap break-words leading-relaxed">
                    {errorViewTab === "text"
                      ? fullErrorText || rawErrorResponse
                      : rawErrorResponse}
                  </pre>
                </div>
              </div>
            )}
          </div>
        )}

        {result && (
          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-2xl text-slate-100 ring-1 ring-white/10">
            <div className="bg-slate-800 px-5 py-4 border-b border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex flex-col">
                <h3 className="font-semibold text-indigo-300 flex items-center gap-2">
                  <FileDigit className="w-4 h-4" />
                  実行結果
                </h3>
                {result.metadata?.name && (
                  <p
                    className="text-xs text-slate-100 mt-1 font-medium truncate max-w-[250px] sm:max-w-md"
                    title={result.metadata.name}
                  >
                    ファイル: {result.metadata.name}
                  </p>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {result.metadata?.mimeType && (
                  <span className="text-[10px] text-slate-400 font-mono bg-slate-950 px-2 py-1 rounded border border-slate-700">
                    MIME: {result.metadata.mimeType}
                  </span>
                )}
                <span className="text-[10px] text-indigo-300 font-mono bg-slate-950 px-2 py-1 rounded border border-indigo-900/50">
                  モデル: {usedModel || modelName}
                </span>
                <button
                  onClick={copyMetadata}
                  className={`flex items-center gap-1 text-[10px] px-2 py-1 rounded border transition-all ${
                    copied
                      ? "bg-emerald-900/40 text-emerald-400 border-emerald-800"
                      : "bg-slate-950 text-slate-400 border-slate-700 hover:text-white hover:border-slate-500"
                  }`}
                  title="メタデータをコピー"
                >
                  {copied ? (
                    <Check className="w-3 h-3 text-emerald-400" />
                  ) : (
                    <Clipboard className="w-3 h-3" />
                  )}
                  {copied ? "コピーしました" : "情報をコピー"}
                </button>
              </div>
            </div>

            <div className="p-4 space-y-6">
              {result.outputMode === "structured" &&
                result.structured &&
                inputMode === "drive" &&
                (() => {
                  const currentUid = userId || auth.currentUser?.uid;
                  const isDriveMode = inputMode === "drive";
                  const hasFileId = !!fileId.trim();
                  const isStructured =
                    result && result.outputMode === "structured";
                  const hasStructuredResult = !!(result && result.structured);
                  const isParseSuccess = !!(
                    result &&
                    result.success &&
                    !result.structuredParseFailed
                  );
                  const isValidationSuccess = !!(
                    result &&
                    result.success &&
                    !result.structuredParseFailed &&
                    !result.error
                  );
                  const isAuthenticated = !!currentUid;
                  const isSaveAvailable =
                    isDriveMode &&
                    hasFileId &&
                    isStructured &&
                    hasStructuredResult &&
                    isParseSuccess &&
                    isValidationSuccess &&
                    isAuthenticated;

                  return (
                    <div className="bg-slate-950/60 border border-slate-800 p-4 rounded-lg flex flex-col gap-4">
                      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                        <div className="space-y-1 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                              Firestore メタデータ連携
                            </span>
                            {firestorePersisted === "persisted" ? (
                              <span className="inline-flex items-center gap-1 bg-emerald-950/60 text-emerald-400 text-[10px] px-2 py-0.5 rounded border border-emerald-900/60 font-bold">
                                <Check className="w-3 h-3 text-emerald-400" />
                                保存済み (Persisted)
                              </span>
                            ) : firestorePersisted === "checking" ? (
                              <span className="inline-flex items-center gap-1 bg-indigo-950/60 text-indigo-400 text-[10px] px-2 py-0.5 rounded border border-indigo-900/60 font-bold animate-pulse">
                                <Loader2 className="w-3 h-3 animate-spin text-indigo-400" />
                                確認中...
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 bg-slate-900 text-slate-400 text-[10px] px-2 py-0.5 rounded border border-slate-800 font-bold">
                                未保存 (Not persisted)
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-400 leading-relaxed">
                            この構造化要約結果を、Firestoreに該当Driveファイルのメタデータとして永続保存できます。
                          </p>

                          {/* Parent Folder Selection Dropdown */}
                          <div className="mt-3">
                            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 text-slate-300">
                              関連付ける親ディレクトリ (任意 -
                              プレビューでフォルダ分類する際に使用されます)
                            </label>
                            <select
                              value={selectedParentId}
                              onChange={(e) =>
                                setSelectedParentId(e.target.value)
                              }
                              className="bg-slate-900 text-slate-100 text-xs rounded border border-slate-700 px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500 max-w-md w-full"
                            >
                              <option value="">
                                -- 親ディレクトリを選択してください (任意) --
                              </option>
                              {dirs.map((dir) => (
                                <option key={dir.drive_id} value={dir.drive_id}>
                                  {dir.path || dir.name} (
                                  {dir.drive_id.slice(0, 8)}...)
                                </option>
                              ))}
                            </select>
                          </div>

                          {saveStatus.message && (
                            <p
                              className={`text-xs font-bold flex items-center gap-1 mt-2 ${saveStatus.type === "success" ? "text-emerald-400" : "text-rose-400"}`}
                            >
                              {saveStatus.type === "success" ? (
                                <Check className="w-3.5 h-3.5" />
                              ) : (
                                <XCircle className="w-3.5 h-3.5" />
                              )}
                              {saveStatus.message}
                            </p>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-2 shrink-0 w-full md:w-auto">
                          <button
                            onClick={handleSaveToFirestore}
                            disabled={savingToFirestore || !isSaveAvailable}
                            className={`px-4 py-2 text-xs font-bold rounded-lg border transition-all flex items-center justify-center gap-1.5 shadow-sm w-full md:w-auto ${
                              savingToFirestore || !isSaveAvailable
                                ? "bg-slate-800 border-slate-700 text-slate-500 cursor-not-allowed"
                                : "bg-indigo-600 border-indigo-500 text-white hover:bg-indigo-500 hover:border-indigo-400"
                            }`}
                          >
                            {savingToFirestore ? (
                              <>
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                保存中...
                              </>
                            ) : (
                              <>
                                <RefreshCw className="w-3.5 h-3.5" />
                                Firestoreへメタデータ保存
                              </>
                            )}
                          </button>
                          {setActiveTab && (
                            <button
                              onClick={() => setActiveTab("firestore-test")}
                              className="px-3 py-2 text-xs font-bold rounded-lg border border-slate-700 bg-slate-900 text-slate-400 hover:text-white hover:border-slate-500 transition-all flex items-center justify-center gap-1 w-full md:w-auto"
                            >
                              <Settings className="w-3.5 h-3.5" />
                              Firestore診断
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Clearly explaining why save is disabled */}
                      {!isSaveAvailable && (
                        <div className="bg-rose-950/40 border border-rose-900/60 text-rose-300 text-[11px] p-2.5 rounded-md space-y-1">
                          <p className="font-bold flex items-center gap-1">
                            <XCircle className="w-3.5 h-3.5 text-rose-400" />
                            Firestoreへの保存は以下の理由により無効化されています：
                          </p>
                          <ul className="list-disc pl-4 space-y-0.5">
                            {!isAuthenticated && (
                              <li>
                                ユーザーが認証されていません。ログインしてください。
                              </li>
                            )}
                            {!isDriveMode && (
                              <li>入力モードがDriveではありません。</li>
                            )}
                            {!hasFileId && <li>ファイルIDが空です。</li>}
                            {!isStructured && (
                              <li>
                                要約出力モードが「構造化」ではありません。
                              </li>
                            )}
                            {!hasStructuredResult && (
                              <li>構造化結果が存在しません。</li>
                            )}
                            {!isParseSuccess && (
                              <li>構造化データのパースに失敗しています。</li>
                            )}
                            {isParseSuccess && !isValidationSuccess && (
                              <li>
                                構造化データのバリデーションに失敗しています。
                              </li>
                            )}
                          </ul>
                        </div>
                      )}
                    </div>
                  );
                })()}

              {result.outputMode === "structured" ? (
                <RenderStructuredSummary
                  structured={result.structured || {}}
                  rawText={result.rawText}
                  repairWarnings={result.warnings}
                  validationErrors={result.validationErrors}
                  repairFallbackUsed={result.repairFallbackUsed}
                  qualityStatus={result.qualityStatus}
                  qualityIssues={result.qualityIssues}
                  qualityScore={result.qualityScore}
                  experimentalModel={result.experimentalModel}
                  effectiveStructuredExecutionMode={result.effectiveStructuredExecutionMode}
                  providerFamily={result.providerFamily}
                  usedModelName={usedModel || undefined}
                />
              ) : (
                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                    <FileText className="w-4 h-4 text-emerald-400" />
                    生成された要約 (自由文)
                  </h4>
                  <div className="bg-slate-800/50 rounded-md p-4 border border-slate-700/50">
                    <p className="whitespace-pre-wrap text-emerald-50 leading-relaxed text-sm">
                      {result.summary}
                    </p>
                  </div>
                </div>
              )}

              {/* Metadata Box */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider font-mono">
                  メタデータ
                </h4>
                <div className="bg-slate-800 rounded-md p-3 border border-slate-700">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-y-2 text-xs">
                    <div className="flex">
                      <span className="text-slate-500 w-24">ファイル名:</span>
                      <span
                        className="font-medium text-slate-200 truncate"
                        title={result.metadata?.name}
                      >
                        {result.metadata?.name}
                      </span>
                    </div>
                    <div className="flex">
                      <span className="text-slate-500 w-24">MIME 形式:</span>
                      <span className="font-mono text-indigo-300">
                        {result.metadata?.mimeType}
                      </span>
                    </div>
                    <div className="flex">
                      <span className="text-slate-500 w-24">
                        サイズ (Bytes):
                      </span>
                      <span className="font-mono text-slate-300">
                        {result.metadata?.size || "N/A"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Structured Metadata Box */}
              {result.outputMode === "structured" && (
                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider font-mono">
                    構造化生成実行メタデータ
                  </h4>
                  <div className="bg-slate-800 rounded-md p-3 border border-slate-700">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-y-2 gap-x-4 text-xs">
                      <div className="flex justify-between md:justify-start">
                        <span className="text-slate-500 w-44">有効な実行モード:</span>
                        <span className="font-mono text-indigo-300 font-bold">
                          {result.effectiveStructuredExecutionMode || "N/A"}
                        </span>
                      </div>
                      <div className="flex justify-between md:justify-start">
                        <span className="text-slate-500 w-44">レスポンススキーマ有効化:</span>
                        <span className={`font-mono font-bold ${result.responseSchemaEnabled ? "text-emerald-400" : "text-amber-400"}`}>
                          {result.responseSchemaEnabled ? "有効" : "無効"}
                        </span>
                      </div>
                      <div className="flex justify-between md:justify-start">
                        <span className="text-slate-500 w-44">ネイティブスキーマサポート:</span>
                        <span className="font-mono text-slate-300">
                          {result.supportsNativeResponseSchema ? "対応" : "非対応"}
                        </span>
                      </div>
                      <div className="flex justify-between md:justify-start">
                        <span className="text-slate-500 w-44">プロバイダーファミリー:</span>
                        <span className="font-mono text-slate-300">
                          {result.providerFamily || "N/A"}
                        </span>
                      </div>
                      {result.failureKind && (
                        <div className="flex justify-between md:justify-start col-span-1 md:col-span-2">
                          <span className="text-rose-400 w-44">失敗種別 (failureKind):</span>
                          <span className="font-mono text-rose-300 font-bold bg-rose-950/40 px-1.5 py-0.5 rounded">
                            {result.failureKind}
                          </span>
                        </div>
                      )}
                      {result.emptyStructuredOutput && (
                        <div className="flex justify-between md:justify-start col-span-1 md:col-span-2">
                          <span className="text-rose-400 w-44">空の構造化出力検出:</span>
                          <span className="font-mono text-rose-300 font-bold bg-rose-950/40 px-1.5 py-0.5 rounded">
                            検出
                          </span>
                        </div>
                      )}
                      {result.underGeneratedStructuredOutput && (
                        <div className="flex justify-between md:justify-start col-span-1 md:col-span-2">
                          <span className="text-rose-400 w-44">未充足(underGenerated)検出:</span>
                          <span className="font-mono text-rose-300 font-bold bg-rose-950/40 px-1.5 py-0.5 rounded">
                            検出
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Content Sample Box */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider font-mono">
                  抽出されたテキストスニペット
                </h4>
                <div className="bg-slate-950 rounded-md p-3 border border-slate-800">
                  <p className="font-mono text-xs text-slate-500 whitespace-pre-wrap break-words leading-relaxed select-all">
                    {result.contentSampleSnippet}
                  </p>
                </div>
              </div>

              <RequestPreviewPanel preview={result.requestPreview} />
            </div>
          </div>
        )}
      </div>

      {/* Experiment History Section */}
      <div className="mt-10 bg-white p-6 rounded-lg border border-slate-200 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
            <HistoryIcon className="w-4 h-4 text-indigo-500" />
            実験履歴 (Local Debug)
          </h3>
          <div className="flex gap-2">
            <button
              onClick={fetchExperimentHistory}
              disabled={loadingExperimentHistory}
              className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold text-slate-500 hover:text-indigo-600 bg-slate-100 hover:bg-indigo-50 rounded-md transition-colors disabled:opacity-50"
            >
              <RefreshCw
                className={`w-3 h-3 ${loadingExperimentHistory ? "animate-spin" : ""}`}
              />
              更新
            </button>
            <button
              onClick={clearExperimentHistory}
              disabled={loadingExperimentHistory}
              className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold text-rose-500 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-md transition-colors disabled:opacity-50"
            >
              <Trash2 className="w-3 h-3" />
              クリア
            </button>
          </div>
        </div>

        {experimentHistory.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 text-[10px] uppercase text-slate-500 tracking-wider">
                  <th className="p-2 border-b border-slate-200">Time</th>
                  <th className="p-2 border-b border-slate-200">Input</th>
                  <th className="p-2 border-b border-slate-200">Model</th>
                  <th className="p-2 border-b border-slate-200">Schema/Mode</th>
                  <th className="p-2 border-b border-slate-200">Status</th>
                  <th className="p-2 border-b border-slate-200">
                    Preview / Classifications
                  </th>
                  <th className="p-2 border-b border-slate-200">Action</th>
                </tr>
              </thead>
              <tbody className="text-[10px] sm:text-xs text-slate-600">
                {experimentHistory.map((item) => {
                  const summaryPreview =
                    item.structuredResult?.summary?.oneLine ||
                    (item.outputMode !== "structured" && item.rawOutput) ||
                    "-";
                  
                  const docKinds =
                    item.structuredResult?.documentKindInfo?.kinds?.join(", ") || "-";
                  
                  const domainsPreview =
                    item.structuredResult?.subjectAreas?.domains?.map((d: any) => d.domain).join(", ") || "-";

                  const topicLabelsList: string[] = [];
                  if (item.structuredResult?.subjectAreas?.domains) {
                    for (const dom of item.structuredResult.subjectAreas.domains) {
                      if (dom.labels) {
                        for (const lbl of dom.labels) {
                          if (lbl.kind === "topic" && lbl.label) {
                            topicLabelsList.push(lbl.label);
                          }
                        }
                      }
                    }
                  }
                  const topicLabels = topicLabelsList.length > 0 ? topicLabelsList.join(", ") : "-";

                  return (
                    <tr
                      key={item.id}
                      className="border-b border-slate-100 hover:bg-slate-50"
                    >
                      <td className="p-2 whitespace-nowrap">
                        {new Date(item.timestamp).toLocaleTimeString()}
                      </td>
                      <td
                        className="p-2 max-w-[120px] truncate"
                        title={item.inputLabel}
                      >
                        {item.inputLabel}
                      </td>
                      <td className="p-2 whitespace-nowrap">{item.model}</td>
                      <td className="p-2 whitespace-nowrap">
                        {item.outputMode === "structured"
                           ? item.schemaVersion
                          : item.outputMode}
                      </td>
                      <td className="p-2 whitespace-nowrap">
                        {item.error ? (
                          <span className="text-rose-600 flex items-center gap-1">
                            <XCircle className="w-3 h-3" /> Error
                          </span>
                        ) : item.validationSuccess ? (
                          <span className="text-emerald-600 flex items-center gap-1">
                            <Check className="w-3 h-3" /> Valid
                          </span>
                        ) : (
                          <span className="text-amber-600 flex items-center gap-1">
                            <XCircle className="w-3 h-3" /> Invalid
                          </span>
                        )}
                      </td>
                      <td className="p-2 max-w-[200px]">
                        <div
                          className="truncate font-medium text-slate-800 mb-0.5"
                          title={summaryPreview}
                        >
                          {summaryPreview}
                        </div>
                        {item.outputMode === "structured" &&
                          item.parseSuccess && (
                            <div
                              className="text-[9px] text-slate-400 truncate"
                              title={`Kinds: ${docKinds} | Topics: ${topicLabels} | Domains: ${domainsPreview}`}
                            >
                              <span className="text-slate-500">K:</span>{" "}
                              {docKinds} /{" "}
                              <span className="text-slate-500">T:</span>{" "}
                              {topicLabels} /{" "}
                              <span className="text-slate-500">D:</span>{" "}
                              {domainsPreview}
                            </div>
                          )}
                      </td>
                      <td className="p-2 whitespace-nowrap">
                        <button
                          onClick={() => {
                            setResult({
                              success: !item.error,
                              outputMode: item.outputMode,
                              metadata: item.fileMetadata,
                              structured: item.structuredResult,
                              summary:
                                item.outputMode !== "structured"
                                  ? item.rawOutput ||
                                    item.summary ||
                                    "No summary (raw output not persisted)"
                                  : item.structuredResult?.summary?.oneLine ||
                                    "No summary",
                              rawText: item.rawOutput,
                              schemaVersion: item.schemaVersion,
                              error: item.error,
                              validationErrors: item.validationErrors,
                              structuredParseFailed: !item.parseSuccess,
                            });
                            setUsedModel(item.model);
                            setError(item.error || null);
                          }}
                          className="text-indigo-600 hover:underline flex items-center gap-1"
                        >
                          表示
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-xs text-slate-500 py-4 text-center">
            履歴はありません。
          </p>
        )}
      </div>
    </div>
  );
};
