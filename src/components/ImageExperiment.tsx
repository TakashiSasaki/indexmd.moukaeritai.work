import React, { useState, useEffect, useMemo } from 'react';
import { Search, Image as ImageIcon, AlertCircle, AlertTriangle, CheckCircle, RefreshCw, Activity, Check, Copy, Download, ExternalLink, Info, Trash2, Terminal, ChevronDown, ChevronUp, Clock, ArrowRight, HelpCircle, Play, RotateCw, XCircle, Loader2 } from 'lucide-react';
import { AppConfig } from '../types';
import { getVisualModelCapability } from '../lib/modelCapabilities';
import { 
  compareExpectedImageKind, 
  compareExpectedCategories, 
  compareExpectedLabels, 
  compareExpectedVisibleText,
  evaluateSampleComparison,
  PublicSampleComparisonSummary
} from '../lib/visualAnalysis/publicSamples/compare';
import { PUBLIC_VISUAL_SAMPLES } from '../lib/visualAnalysis/publicSamples/registry';
import { PublicSampleBatchRunSummary, PublicSampleBatchRunItem, VisualBatchJobEvent } from '../lib/visualAnalysis/publicSamples/batchTypes';
import {
  PublicSampleBatchCheckpoint,
  loadActiveBatchCheckpoint,
  saveActiveBatchCheckpoint,
  clearActiveBatchCheckpoint,
  isCheckpointCompatible,
  rebuildBatchSummaryFromCheckpoint,
  buildTargetSampleIdsHash
} from '../lib/visualAnalysis/publicSamples/batchCheckpoint';
import { buildBatchReportForChat, buildFailuresOnlyReport, buildBatchSummaryReportForChat, buildBatchDiagnosticReportForChat, buildFullItemReport } from '../lib/visualAnalysis/publicSamples/reportBuilder';
import { buildBatchComparisonReportForChat } from '../lib/visualAnalysis/publicSamples/comparisonReport';
import { stringifyJsonArtifact, downloadJsonArtifact, fnv1a32 } from '../lib/visualAnalysis/publicSamples/artifactUtils';
import { safeFetch, safeFetchWithRetry, ResponseDiagnostics, SafeFetchRetryEvent } from '../lib/visualAnalysis/safeFetch';

interface ImageExperimentProps {
  token: string;
  config: AppConfig;
  onAddLog: (level: "info"|"success"|"warn"|"error", msg: string, details?: string) => void;
  onSessionExpiry: () => void;
  activeSubTab?: "client" | "server" | "matrix";
}

function PublicSamplePreview({ sampleId }: { sampleId: string }) {
  return (
    <div className="w-full h-48 bg-slate-100 rounded flex items-center justify-center overflow-hidden border border-slate-200">
      <img src={`/api/visual/public-samples/${sampleId}/image?variant=preview`} alt="Sample Preview" className="max-w-full max-h-full object-contain" />
    </div>
  );
}

function ImagePreview({ fileId, token }: { fileId: string; token: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!fileId || !token) return;

    let objectUrl: string | null = null;

    const fetchImage = async () => {
      try {
        const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (!res.ok) throw new Error("Failed to fetch image preview");
        const blob = await res.blob();
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      } catch (err: any) {
        setError(err.message);
      }
    };

    fetchImage();

    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [fileId, token]);

  if (error) return <div className="h-48 bg-slate-100 rounded-lg flex items-center justify-center text-xs text-slate-400 p-4 text-center">{error}</div>;
  if (!url) return <div className="h-48 bg-slate-100 rounded-lg flex items-center justify-center text-xs text-slate-400 animate-pulse">Loading preview...</div>;

  return (
    <div className="relative group">
      <img src={url} alt="Preview" className="w-full h-auto max-h-96 object-contain rounded-lg border border-slate-200" />
      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-colors rounded-lg" />
    </div>
  );
}

export default function ImageExperiment({ token, config, onAddLog, onSessionExpiry, activeSubTab }: ImageExperimentProps) {
  // Drive mode is retired, always use public sample mode
  const mode = "public";

  // Public sample mode state
  const [samples, setSamples] = useState<any[]>([]);
  const [selectedSampleId, setSelectedSampleId] = useState<string>(() => {
    return localStorage.getItem("image_experiment_selected_sample_id") || "";
  });
  const [isLoadingSamples, setIsLoadingSamples] = useState(false);

  // Checked public sample IDs for customized batch runs
  const [selectedSampleIds, setSelectedSampleIds] = useState<Record<string, boolean>>({});

  // Dynamic success/failure status of public samples
  const [sampleStatuses, setSampleStatuses] = useState<Record<string, "success" | "failure" | null>>(() => {
    try {
      const saved = localStorage.getItem("image_experiment_sample_statuses");
      return saved ? JSON.parse(saved) : {};
    } catch (e) {
      return {};
    }
  });

  // Persist sample statuses in localStorage whenever they change
  useEffect(() => {
    localStorage.setItem("image_experiment_sample_statuses", JSON.stringify(sampleStatuses));
  }, [sampleStatuses]);

  // Bulk action handlers for public samples selection
  const handleSelectAllSamples = () => {
    const updated: Record<string, boolean> = {};
    samples.forEach(s => {
      updated[s.id] = true;
    });
    setSelectedSampleIds(updated);
  };

  const handleDeselectAllSamples = () => {
    const updated: Record<string, boolean> = {};
    samples.forEach(s => {
      updated[s.id] = false;
    });
    setSelectedSampleIds(updated);
  };

  const handleSelectNonSuccessfulSamples = () => {
    const updated: Record<string, boolean> = {};
    samples.forEach(s => {
      updated[s.id] = sampleStatuses[s.id] !== "success";
    });
    setSelectedSampleIds(updated);
  };

  const handleClearSampleStatuses = () => {
    setSampleStatuses({});
  };

  // Shared state
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(() => {
    try {
      const saved = localStorage.getItem("image_experiment_last_result");
      return saved ? JSON.parse(saved) : null;
    } catch (e) {
      return null;
    }
  });
  const [modelSelection, setModelSelection] = useState<string>(() => {
    return localStorage.getItem("image_experiment_model_selection") || 
      `${config.gemini_model || "gemini-3.5-flash"}|${config.json_mode || "prompt_only"}`;
  });

  const [modelName, jsonModeOption] = modelSelection.includes("|") 
    ? modelSelection.split("|") 
    : [modelSelection, config.json_mode || "prompt_only"];

  useEffect(() => {
    localStorage.setItem("image_experiment_model_selection", modelSelection);
  }, [modelSelection]);
  const [copied, setCopied] = useState<string | null>(null);
  const [includePreview, setIncludePreview] = useState(false);
  const [customInstruction, setCustomInstruction] = useState<string>("");
  const [showPreviewHelp, setShowPreviewHelp] = useState(false);
  const [showBatchArtifactHelp, setShowBatchArtifactHelp] = useState(false);
  const [showMatrixHelp, setShowMatrixHelp] = useState(false);
  const [showServerSideJob, setShowServerSideJob] = useState(false);
  const [serverJobId, setServerJobId] = useState("");
  const [serverJobStatus, setServerJobStatus] = useState<any>(null);
  const [serverJobComputedState, setServerJobComputedState] = useState<any>(null);
  const [serverJobItemsPreview, setServerJobItemsPreview] = useState<any[]>([]);
  const [isStartingServerJob, setIsStartingServerJob] = useState(false);
  const [serverJobList, setServerJobList] = useState<any[]>([]);

  // Batch evaluation state
  const [isBatchRunning, setIsBatchRunning] = useState<boolean>(false);
  const [batchProgress, setBatchProgress] = useState<{ current: number, total: number } | null>(null);
  const [activeCheckpoint, setActiveCheckpoint] = useState<PublicSampleBatchCheckpoint | null>(null);

  useEffect(() => {
    const handleBeforeUnload = () => {
      if (activeCheckpoint && activeCheckpoint.status === 'running') {
        try {
          const updated = {
            ...activeCheckpoint,
            lastEvent: {
              type: 'batchInterrupted' as const,
              timestamp: new Date().toISOString(),
              message: 'Page is unloading/closing'
            }
          };
          saveActiveBatchCheckpoint(updated);
        } catch (e) {}
      }
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden' && activeCheckpoint && activeCheckpoint.status === 'running') {
        try {
          const updated = {
            ...activeCheckpoint,
            lastEvent: {
              type: 'batchInterrupted' as const,
              timestamp: new Date().toISOString(),
              message: 'Page became hidden'
            }
          };
          saveActiveBatchCheckpoint(updated);
        } catch (e) {}
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [activeCheckpoint]);
  const [hasIncompatibleCheckpoint, setHasIncompatibleCheckpoint] = useState<boolean>(false);
  const [batchSummary, setBatchSummary] = useState<PublicSampleBatchRunSummary | null>(() => {
    try {
      const saved = localStorage.getItem("image_experiment_last_batch_summary");
      return saved ? JSON.parse(saved) : null;
    } catch (e) {
      return null;
    }
  });

  const [pastBatchRuns, setPastBatchRuns] = useState<PublicSampleBatchRunSummary[]>(() => {
    try {
      const saved = localStorage.getItem("image_experiment_batch_runs");
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });

  const [internalExperimentViewTab, setExperimentViewTab] = useState<"client" | "server" | "matrix">(() => {
    return (localStorage.getItem("image_experiment_view_tab") as any) || "client";
  });

  const experimentViewTab = activeSubTab || internalExperimentViewTab;

  useEffect(() => {
    localStorage.setItem("image_experiment_view_tab", internalExperimentViewTab);
  }, [internalExperimentViewTab]);

  interface MatrixCellResult {
    sampleId: string;
    modelName: string;
    jsonMode: string;
    success: boolean;
    timestamp: string;
    runId?: string;
    overallStatus?: 'pass' | 'warning' | 'fail';
    reviewStatus?: 'pass' | 'needsReview' | 'fail';
    error?: string;
    source: 'client-single' | 'client-batch' | 'server-job';
  }

  const [matrixResults, setMatrixResults] = useState<Record<string, MatrixCellResult>>(() => {
    try {
      const saved = localStorage.getItem("image_experiment_matrix_results");
      return saved ? JSON.parse(saved) : {};
    } catch (e) {
      return {};
    }
  });

  const handleUpdateMatrixResult = (cell: MatrixCellResult) => {
    setMatrixResults(prev => {
      const key = `${cell.sampleId}|${cell.modelName}|${cell.jsonMode}`;
      const updated = {
        ...prev,
        [key]: {
          ...cell,
          timestamp: cell.timestamp || new Date().toISOString()
        }
      };
      try {
        localStorage.setItem("image_experiment_matrix_results", JSON.stringify(updated));
      } catch (e) {
        console.warn("Failed to save matrix results to localStorage", e);
      }
      return updated;
    });
  };

  // Merge batch past runs on mount and whenever pastBatchRuns updates
  useEffect(() => {
    try {
      const matrixSaved = localStorage.getItem("image_experiment_matrix_results");
      let matrix: Record<string, MatrixCellResult> = matrixSaved ? JSON.parse(matrixSaved) : {};
      let changed = false;

      const savedRuns = localStorage.getItem("image_experiment_batch_runs");
      const runs: any[] = savedRuns ? JSON.parse(savedRuns) : [];
      runs.forEach(run => {
        if (run && Array.isArray(run.items)) {
          run.items.forEach((it: any) => {
            const key = `${it.sampleId}|${run.modelName}|${run.jsonMode}`;
            if (!matrix[key]) {
              let overallStatus: 'pass' | 'warning' | 'fail' | undefined;
              let reviewStatus: 'pass' | 'needsReview' | 'fail' | undefined;
              if (it.comparison) {
                overallStatus = it.comparison.overallStatus;
                reviewStatus = it.comparison.reviewStatus;
              }
              matrix[key] = {
                sampleId: it.sampleId,
                modelName: run.modelName,
                jsonMode: run.jsonMode,
                success: it.success,
                timestamp: run.timestamp || new Date().toISOString(),
                runId: run.runId,
                overallStatus,
                reviewStatus,
                error: it.error,
                source: 'client-batch'
              };
              changed = true;
            }
          });
        }
      });

      if (changed) {
        localStorage.setItem("image_experiment_matrix_results", JSON.stringify(matrix));
        setMatrixResults(matrix);
      }
    } catch (e) {
      console.warn("Failed to merge matrix results:", e);
    }
  }, [pastBatchRuns]);

  const MATRIX_COLUMNS = [
    { model: "gemini-3.5-flash", mode: "native_schema", label: "G3.5 Flash (Native)" },
    { model: "gemini-3.5-flash", mode: "prompt_only", label: "G3.5 Flash (Prompt)" },
    { model: "gemini-flash-latest", mode: "native_schema", label: "G Flash Lat (Native)" },
    { model: "gemini-flash-latest", mode: "prompt_only", label: "G Flash Lat (Prompt)" },
    { model: "gemini-3.1-flash-lite", mode: "native_schema", label: "G3.1 Lite (Native)" },
    { model: "gemini-3.1-flash-lite", mode: "prompt_only", label: "G3.1 Lite (Prompt)" },
    { model: "gemini-1.5-pro", mode: "native_schema", label: "G1.5 Pro (Native)" },
    { model: "gemini-1.5-pro", mode: "prompt_only", label: "G1.5 Pro (Prompt)" },
    { model: "gemma-4-31b-it", mode: "prompt_only", label: "Gemma4 31B (Prompt)" },
    { model: "gemma-4-26b-a4b-it", mode: "prompt_only", label: "Gemma4 26B (Prompt)" },
  ];

  const [selectedMatrixCell, setSelectedMatrixCell] = useState<{
    sampleId: string;
    model: string;
    mode: string;
    result?: MatrixCellResult;
  } | null>(null);

  const [runningCellKey, setRunningCellKey] = useState<string | null>(null);

  const handleRunSingleCell = async (sampleId: string, modelName: string, jsonMode: string) => {
    const key = `${sampleId}|${modelName}|${jsonMode}`;
    if (runningCellKey) return;
    setRunningCellKey(key);
    onAddLog("info", `[Matrix Run] Running single cell test: ${sampleId} with ${modelName} (${jsonMode})...`);
    
    try {
      const matchedSample = PUBLIC_VISUAL_SAMPLES.find(s => s.id === sampleId);
      const sfResult = await safeFetchWithRetry<any>('/api/visual/public-samples/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sampleId,
          modelName,
          jsonMode,
          includeRequestPreview: false,
          customInstruction: ""
        })
      });

      const data = sfResult.data || {};
      const success = sfResult.success && data.success;
      
      let overallStatus: 'pass' | 'warning' | 'fail' | undefined;
      let reviewStatus: 'pass' | 'needsReview' | 'fail' | undefined;

      if (success && data.expectedMetadata) {
        const comparisonSample = {
          id: sampleId,
          title: matchedSample?.title || sampleId,
          category: (matchedSample?.category || "other") as any,
          source: (matchedSample?.source || "unknown") as any,
          expectedImageKind: data.expectedMetadata.imageKind,
          acceptableImageKinds: data.expectedMetadata.acceptableImageKinds || [],
          expectedElementCategories: data.expectedMetadata.elementCategories || [],
          expectedVisibleElementLabels: data.expectedMetadata.visibleElementLabels || [],
          expectedVisibleElementLabelAliases: data.expectedMetadata.visibleElementLabelAliases || {},
          expectedVisibleText: data.expectedMetadata.visibleText || [],
          optionalElementCategories: data.expectedMetadata.optionalElementCategories || [],
          optionalVisibleElementLabels: data.expectedMetadata.optionalVisibleElementLabels || [],
          optionalVisibleElementLabelAliases: data.expectedMetadata.optionalVisibleElementLabelAliases || {},
          optionalVisibleText: data.expectedMetadata.optionalVisibleText || []
        };
        try {
          const comp = evaluateSampleComparison(comparisonSample, data);
          overallStatus = comp.overallStatus;
          reviewStatus = comp.reviewStatus;
        } catch (e) {}
      }

      const cellResult: MatrixCellResult = {
        sampleId,
        modelName,
        jsonMode,
        success,
        timestamp: new Date().toISOString(),
        overallStatus,
        reviewStatus,
        error: sfResult.error || data.error,
        source: 'client-single'
      };

      handleUpdateMatrixResult(cellResult);
      
      // Update selectedMatrixCell detail view if open for this cell
      setSelectedMatrixCell(prev => {
        if (prev && prev.sampleId === sampleId && prev.model === modelName && prev.mode === jsonMode) {
          return {
            ...prev,
            result: cellResult
          };
        }
        return prev;
      });

      if (success) {
        onAddLog("success", `[Matrix Run] Successfully updated cell for ${sampleId}`);
      } else {
        onAddLog("error", `[Matrix Run] Failed cell run: ${sfResult.error || data.error || 'Unknown error'}`);
      }
    } catch (err: any) {
      onAddLog("error", `[Matrix Run] Error: ${err.message}`);
    } finally {
      setRunningCellKey(null);
    }
  };

  const handleExportMatrixCSV = () => {
    try {
      let csv = "Sample ID,Sample Title,";
      csv += MATRIX_COLUMNS.map(col => `"${col.label}"`).join(",") + "\n";
      
      PUBLIC_VISUAL_SAMPLES.forEach(sample => {
        let row = `"${sample.id}","${sample.title}",`;
        const colResults = MATRIX_COLUMNS.map(col => {
          const key = `${sample.id}|${col.model}|${col.mode}`;
          const res = matrixResults[key];
          if (!res) return "Not Run";
          if (!res.success) return `Fail: ${res.error?.replace(/"/g, '""') || 'Unknown'}`;
          return res.overallStatus ? `Pass (${res.overallStatus})` : "Success";
        });
        row += colResults.map(r => `"${r}"`).join(",") + "\n";
      });

      const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csv], { type: 'text/csv;charset=utf-8;' }); // Add UTF-8 BOM
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `experiment-matrix-${Date.now()}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      onAddLog("success", "マトリクス結果CSVをエクスポートしました。");
    } catch (e: any) {
      onAddLog("error", `CSVエクスポートに失敗しました: ${e.message}`);
    }
  };

  const handleClearMatrixResults = () => {
    if (confirm("本当にすべてのマトリクス結果履歴をリセットしますか？この操作は取り消せません。")) {
      localStorage.removeItem("image_experiment_matrix_results");
      setMatrixResults({});
      setSelectedMatrixCell(null);
      onAddLog("success", "マトリクス結果履歴をリセットしました。");
    }
  };

  useEffect(() => {
    if (result) {
      try {
        localStorage.setItem("image_experiment_last_result", JSON.stringify(result));
      } catch (e) {
        console.warn("Could not save result to localStorage", e);
      }
    } else {
      localStorage.removeItem("image_experiment_last_result");
    }
  }, [result]);

  useEffect(() => {
    if (batchSummary) {
      try {
        localStorage.setItem("image_experiment_last_batch_summary", JSON.stringify(batchSummary));
      } catch (e) {
        console.warn("Could not save batchSummary to localStorage", e);
      }
    } else {
      localStorage.removeItem("image_experiment_last_batch_summary");
    }
  }, [batchSummary]);

  const [compareRunAId, setCompareRunAId] = useState<string>("");
  const [compareRunBId, setCompareRunBId] = useState<string>("");

  useEffect(() => {
    if (pastBatchRuns.length >= 2) {
      if (!compareRunAId || !pastBatchRuns.some(r => r.runId === compareRunAId)) {
        setCompareRunAId(pastBatchRuns[0].runId);
      }
      if (!compareRunBId || !pastBatchRuns.some(r => r.runId === compareRunBId)) {
        setCompareRunBId(pastBatchRuns[1].runId);
      }
    } else if (pastBatchRuns.length === 1) {
      if (!compareRunAId) {
        setCompareRunAId(pastBatchRuns[0].runId);
      }
    }
  }, [pastBatchRuns, compareRunAId, compareRunBId]);

  const handleDownloadComparison = () => {
    const runA = pastBatchRuns.find(r => r.runId === compareRunAId);
    const runB = pastBatchRuns.find(r => r.runId === compareRunBId);
    if (!runA) {
      onAddLog("error", "Cannot perform comparison: Run A not selected or found.");
      return;
    }
    const runsToCompare = runB ? [runA, runB] : [runA];
    try {
      const comparisonReport = buildBatchComparisonReportForChat(runsToCompare);
      downloadJsonArtifact(comparisonReport, `batch-comparison-${Date.now()}.json`);
      onAddLog("success", `Comparison report successfully downloaded for runs: ${runA.modelName}(${runA.jsonMode})` + (runB ? ` vs ${runB.modelName}(${runB.jsonMode})` : ""));
    } catch (err: any) {
      onAddLog("error", `Failed to build comparison report: ${err?.message || String(err)}`);
    }
  };

  // Load and validate active batch checkpoint on mount or settings change
  useEffect(() => {
    if (samples.length === 0) return;
    
    const checkpoint = loadActiveBatchCheckpoint();
    if (checkpoint && (checkpoint.status === 'running' || checkpoint.status === 'failed')) {
      const currentSettings = {
        modelName,
        jsonMode: jsonModeOption,
        customInstructionHash: fnv1a32(customInstruction.trim()),
        availableSampleIds: samples.map(s => s.id)
      };
      
      if (isCheckpointCompatible(checkpoint, currentSettings)) {
        setActiveCheckpoint(checkpoint);
        setHasIncompatibleCheckpoint(false);
      } else {
        setActiveCheckpoint(null);
        setHasIncompatibleCheckpoint(true);
        // Do not clear it automatically, let user discard it or switch back settings
      }
    } else {
      setActiveCheckpoint(null);
      setHasIncompatibleCheckpoint(false);
    }
  }, [samples, modelName, jsonModeOption, customInstruction]);

  // Health check states
  const [healthCheckFailed, setHealthCheckFailed] = useState<boolean>(false);
  const [healthCheckDiagnostics, setHealthCheckDiagnostics] = useState<ResponseDiagnostics | null>(null);
  const [healthCheckError, setHealthCheckError] = useState<string | null>(null);

  const chatSummaryReport = useMemo(() => batchSummary ? buildBatchSummaryReportForChat(batchSummary) : null, [batchSummary]);
  const chatDiagnosticReport = useMemo(() => batchSummary ? buildBatchDiagnosticReportForChat(batchSummary) : null, [batchSummary]);
  const failuresReport = useMemo(() => batchSummary ? buildFailuresOnlyReport(batchSummary) : null, [batchSummary]);
  
  const chatSummaryReportStats = useMemo(() => {
    if (!chatSummaryReport) return null;
    return stringifyJsonArtifact(chatSummaryReport);
  }, [chatSummaryReport]);

  const chatDiagnosticReportStats = useMemo(() => {
    if (!chatDiagnosticReport) return null;
    return stringifyJsonArtifact(chatDiagnosticReport);
  }, [chatDiagnosticReport]);

  const failuresReportStats = useMemo(() => {
    if (!failuresReport) return null;
    return stringifyJsonArtifact(failuresReport);
  }, [failuresReport]);

  const fullReportStats = useMemo(() => {
    if (!batchSummary) return null;
    return stringifyJsonArtifact(batchSummary);
  }, [batchSummary]);
  
  // Privacy options
  const [storeRawOutputPreviewInDrive, setStoreRawOutputPreviewInDrive] = useState<boolean>(false);
  
  const selectedSample = samples.find(s => s.id === selectedSampleId) || null;
  const isPublicResult = !!result?.sampleMetadata;
  const isDriveResult = !!result?.metadata;

  const visualCap = getVisualModelCapability(modelName);

  const handleCopy = async (text: string, id: string) => {
    try {
      let isJson = false;
      let parsed = null;
      try {
        if (text.trim().startsWith('{') || text.trim().startsWith('[')) {
          parsed = JSON.parse(text);
          isJson = true;
        }
      } catch (e) {
        // Not valid JSON, or just plain text
      }

      const charLength = text.length;
      let byteLength = 0;
      try {
        byteLength = new TextEncoder().encode(text).length;
      } catch (e) {
        byteLength = charLength;
      }

      const hash = fnv1a32(text);

      if (isJson && !parsed) {
        throw new Error("Invalid stringified JSON or null object");
      }

      // Check if it exceeds 1MB (warning threshold)
      if (byteLength > 1 * 1024 * 1024) {
        const proceed = window.confirm(
          `Warning: This payload is very large (${(byteLength / 1024 / 1024).toFixed(2)} MB, FNV-1a Hash: ${hash}).\n` +
          `Copying to clipboard might freeze the browser. We strongly recommend downloading instead.\n\n` +
          `Do you want to proceed with copying?`
        );
        if (!proceed) return;
      }

      await navigator.clipboard.writeText(text);

      // Verify integrity
      try {
        const readBack = await navigator.clipboard.readText();
        if (readBack !== text) {
          console.warn("Integrity verification mismatch. Clipboard may have truncated the content.");
        }
      } catch (e) {
        // clipboard read-back might require special user permission, skip
      }

      setCopied(id);
      onAddLog("info", `Copied successfully. Size: ${byteLength} bytes (${charLength} chars). Hash: ${hash}`);
      setTimeout(() => setCopied(null), 2000);
    } catch (err: any) {
      console.error("Failed to copy to clipboard", err);
      alert(`Clipboard copy failed: ${err?.message || String(err)}`);
    }
  };

  const handleDownload = (value: unknown, defaultFilename: string, id: string) => {
    try {
      const artifact = downloadJsonArtifact(value, defaultFilename);
      setCopied(id);
      onAddLog("success", `Downloaded ${defaultFilename}. Size: ${artifact.byteLength} bytes. Hash: ${artifact.hash}`);
      setTimeout(() => setCopied(null), 2000);
    } catch (err: any) {
      console.error("Failed to download JSON", err);
      alert(`Download failed: ${err?.message || String(err)}`);
    }
  };

  // Synchronize state changes to localStorage
  useEffect(() => {
    if (selectedSampleId) {
      localStorage.setItem("image_experiment_selected_sample_id", selectedSampleId);
    } else {
      localStorage.removeItem("image_experiment_selected_sample_id");
    }
  }, [selectedSampleId]);

  useEffect(() => {
    if (samples.length === 0) {
      setIsLoadingSamples(true);
      fetch("/api/visual/public-samples")
        .then(res => res.json())
        .then(data => {
          setSamples(data);
          const savedId = localStorage.getItem("image_experiment_selected_sample_id");
          if (savedId && data.some((s: any) => s.id === savedId)) {
            setSelectedSampleId(savedId);
          } else if (data.length > 0 && !selectedSampleId) {
            setSelectedSampleId(data[0].id);
          }

          // Initialize checkboxes to all true by default
          const initialSelected: Record<string, boolean> = {};
          data.forEach((s: any) => {
            initialSelected[s.id] = true;
          });
          setSelectedSampleIds(initialSelected);
        })
        .catch(err => onAddLog("error", "Failed to fetch public samples", err.message))
        .finally(() => setIsLoadingSamples(false));
    }
  }, [samples.length, onAddLog, selectedSampleId]);

  useEffect(() => {
    if (samples.length > 0) {
      if (!selectedSampleId || !samples.find(s => s.id === selectedSampleId)) {
        const savedId = localStorage.getItem("image_experiment_selected_sample_id");
        if (savedId && samples.find(s => s.id === savedId)) {
          setSelectedSampleId(savedId);
        } else {
          setSelectedSampleId(samples[0].id);
        }
      }
    }
  }, [samples, selectedSampleId]);

  const handleAnalyzePublic = async () => {
    if (!selectedSampleId) {
      onAddLog("warn", "Please select a public sample.");
      return;
    }

    setLoading(true);
    setResult(null);
    setBatchSummary(null);
    const payload = {
      sampleId: selectedSampleId,
      modelName,
      includeRequestPreview: includePreview,
      jsonMode: jsonModeOption,
      customInstruction: customInstruction.trim()
    };

    try {
      const sfResult = await safeFetchWithRetry<any>("/api/visual/public-samples/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      }, {
        retryHttpStatuses: [429, 502, 503, 504],
        maxAttempts: 5,
        delaysMs: [10000, 30000, 60000, 120000],
        onRetry: (event: SafeFetchRetryEvent) => {
          const reason = event.status === 429 
            ? "レート制限 (429)" 
            : event.status 
              ? `HTTP エラー (${event.status})` 
              : event.failureKind === "networkError" 
                ? "ネットワークエラー" 
                : event.htmlTitle || "一時的なエラー";
          onAddLog("warn", `[Image Analysis] リトライが必要なエラーを検出しました (${reason})。${event.delayMs / 1000}秒後にリトライします (Attempt ${event.attempt})...`);
        }
      });

      if (sfResult.responseDiagnostics?.status === 401) {
        onSessionExpiry();
        return;
      }

      const data = sfResult.data || {};

      if (!sfResult.success) {
        const errMsg = sfResult.error || "Failed to analyze public sample";
        const errorResult = {
          success: false,
          error: errMsg,
          failureKind: sfResult.failureKind,
          responseDiagnostics: sfResult.responseDiagnostics
        };
        setResult(errorResult);
        onAddLog("error", `[Image Analysis] Error: ${errMsg}`);
        setSampleStatuses(prev => ({ ...prev, [selectedSampleId]: "failure" }));

        handleUpdateMatrixResult({
          sampleId: selectedSampleId,
          modelName,
          jsonMode: jsonModeOption,
          success: false,
          timestamp: new Date().toISOString(),
          error: errMsg,
          source: 'client-single'
        });
      } else {
        setResult(data);
        if (!data.success) {
          onAddLog("error", `[Image Analysis] Error: ${data.error || "Failed to analyze public sample"}`);
          setSampleStatuses(prev => ({ ...prev, [selectedSampleId]: "failure" }));

          handleUpdateMatrixResult({
            sampleId: selectedSampleId,
            modelName,
            jsonMode: jsonModeOption,
            success: false,
            timestamp: new Date().toISOString(),
            error: data.error || "Failed to analyze public sample",
            source: 'client-single'
          });
        } else {
          onAddLog("success", `[Image Analysis] Complete for sample ${selectedSampleId}`);
          setSampleStatuses(prev => ({ ...prev, [selectedSampleId]: "success" }));

          let overallStatus: 'pass' | 'warning' | 'fail' | undefined;
          let reviewStatus: 'pass' | 'needsReview' | 'fail' | undefined;

          if (data.expectedMetadata) {
            const comparisonSample = {
              id: selectedSampleId,
              title: selectedSample?.title || selectedSampleId,
              category: (selectedSample?.category || "other") as any,
              source: (selectedSample?.source || "unknown") as any,
              expectedImageKind: data.expectedMetadata.imageKind,
              acceptableImageKinds: data.expectedMetadata.acceptableImageKinds || [],
              expectedElementCategories: data.expectedMetadata.elementCategories || [],
              expectedVisibleElementLabels: data.expectedMetadata.visibleElementLabels || [],
              expectedVisibleElementLabelAliases: data.expectedMetadata.visibleElementLabelAliases || {},
              expectedVisibleText: data.expectedMetadata.visibleText || [],
              optionalElementCategories: data.expectedMetadata.optionalElementCategories || [],
              optionalVisibleElementLabels: data.expectedMetadata.optionalVisibleElementLabels || [],
              optionalVisibleElementLabelAliases: data.expectedMetadata.optionalVisibleElementLabelAliases || {},
              optionalVisibleText: data.expectedMetadata.optionalVisibleText || []
            };
            try {
              const comp = evaluateSampleComparison(comparisonSample, data);
              overallStatus = comp.overallStatus;
              reviewStatus = comp.reviewStatus;
            } catch (e) {}
          }

          handleUpdateMatrixResult({
            sampleId: selectedSampleId,
            modelName,
            jsonMode: jsonModeOption,
            success: true,
            timestamp: new Date().toISOString(),
            overallStatus,
            reviewStatus,
            source: 'client-single'
          });
        }
      }
    } catch (err: any) {
      onAddLog("error", `[Image Analysis] Error: ${err.message}`);
      setSampleStatuses(prev => ({ ...prev, [selectedSampleId]: "failure" }));

      handleUpdateMatrixResult({
        sampleId: selectedSampleId,
        modelName,
        jsonMode: jsonModeOption,
        success: false,
        timestamp: new Date().toISOString(),
        error: err.message,
        source: 'client-single'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleStartServerJob = async () => {
    if (isStartingServerJob) return;
    setIsStartingServerJob(true);
    try {
      const activeIds = samples.filter(s => selectedSampleIds[s.id]).map(s => s.id);
      if (activeIds.length === 0) {
        onAddLog("error", "No samples selected for server-side job");
        return;
      }
      onAddLog("info", `Starting server-side job for ${activeIds.length} samples...`);
      const res = await fetch("/api/visual/batch-jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          modelName: modelName,
          jsonMode: jsonModeOption,
          customInstruction: customInstruction,
          targetSampleIds: activeIds
        })
      });
      if (!res.ok) throw new Error(`Failed to start job: ${res.status}`);
      const data = await res.json();
      setServerJobId(data.job.jobId);
      setServerJobStatus(data.job);
      onAddLog("success", `Server-side job started: ${data.job.jobId}`);
    } catch (e: any) {
      onAddLog("error", `Server-side job failed: ${e.message}`);
    } finally {
      setIsStartingServerJob(false);
    }
  };

  const handleRefreshServerJob = async () => {
    if (!serverJobId) return;
    try {
      const res = await fetch(`/api/visual/batch-jobs/${serverJobId}`);
      if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
      const data = await res.json();
      setServerJobStatus(data.job);
      setServerJobComputedState(data.computedState ?? null);
      setServerJobItemsPreview(data.itemsPreview ?? []);
    } catch (e: any) {
      onAddLog("error", `Refresh failed: ${e.message}`);
    }
  };
  
  
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (showServerSideJob && serverJobId && serverJobStatus && (serverJobStatus.status === 'running' || serverJobStatus.status === 'queued' || serverJobStatus.status === 'canceling')) {
      interval = setInterval(() => {
        handleRefreshServerJob();
      }, 5000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [showServerSideJob, serverJobId, serverJobStatus]);

  const loadServerJobs = async () => {
    try {
      const res = await fetch("/api/visual/batch-jobs");
      if (res.ok) {
        const data = await res.json();
        const jobs = data.jobs || [];
        setServerJobList(jobs);
        
        // Auto-select the active job if one exists and we don't have one selected
        if (!serverJobId) {
          const activeJob = jobs.find((j: any) => j.status === 'queued' || j.status === 'running' || j.status === 'canceling');
          if (activeJob) {
            setServerJobId(activeJob.jobId);
            setServerJobStatus(activeJob);
          }
        }
      }
    } catch (e) {
      console.warn("Failed to load server jobs", e);
    }
  };

  useEffect(() => {
    if (showServerSideJob) {
      loadServerJobs();
    }
  }, [showServerSideJob]);

  const handleImportServerJob = async () => {
    if (!serverJobStatus || serverJobStatus.status !== 'completed') return;
    try {
      onAddLog("info", `Importing server job ${serverJobStatus.jobId} into batch summary...`);
      const res = await fetch(`/api/visual/batch-jobs/${serverJobStatus.jobId}/summary-data`);
      if (!res.ok) throw new Error(`Failed to fetch summary data: ${res.status}`);
      const summary = await res.json();
      
      setBatchSummary(summary);
      
      // Save to past runs
      try {
        const BATCH_RUNS_KEY = "image_experiment_batch_runs";
        const MAX_STORED_RUNS = 5;
        const storedStr = localStorage.getItem(BATCH_RUNS_KEY);
        let runs: PublicSampleBatchRunSummary[] = storedStr ? JSON.parse(storedStr) : [];
        
        const fullRun: PublicSampleBatchRunSummary = {
          runId: summary.runId,
          timestamp: summary.timestamp,
          startedAt: summary.startedAt,
          completedAt: summary.completedAt,
          durationMs: summary.durationMs,
          modelName: summary.modelName,
          jsonMode: summary.jsonMode,
          total: summary.total,
          successCount: summary.successCount,
          failureCount: summary.failureCount,
          validCount: summary.validCount || 0,
          validLowQualityCount: summary.validLowQualityCount || 0,
          invalidJsonCount: summary.invalidJsonCount || 0,
          expectedComparisonPassCount: summary.expectedComparisonPassCount || 0,
          expectedComparisonWarningCount: summary.expectedComparisonWarningCount || 0,
          expectedComparisonFailCount: summary.expectedComparisonFailCount || 0,
          reviewPassCount: summary.reviewPassCount,
          reviewNeedsReviewCount: summary.reviewNeedsReviewCount,
          reviewFailCount: summary.reviewFailCount,
          providerQuotaSummary: summary.providerQuotaSummary,
          rateLimitSummary: summary.rateLimitSummary,
          items: summary.items
        };
        
        runs.unshift(fullRun);
        if (runs.length > MAX_STORED_RUNS) {
           runs = runs.slice(0, MAX_STORED_RUNS);
        }
        
        // Strip heavy things to avoid quota errors
        const lightweightRuns = runs.map(run => ({
          ...run,
          items: run.items.map(item => {
            if ((item.record?.visualAnalysis as any)?.requestPreview) {
              const lightweightRecord = {
                 ...item.record,
                 visualAnalysis: {
                    ...item.record.visualAnalysis,
                    requestPreview: undefined as any
                 }
              };
              return { ...item, record: lightweightRecord };
            }
            return item;
          })
        }));

        localStorage.setItem(BATCH_RUNS_KEY, JSON.stringify(lightweightRuns));
        setPastBatchRuns(lightweightRuns);
        
      } catch (e) {
        console.warn("Could not save imported run to localStorage:", e);
        onAddLog("warn", "Could not save imported run to localStorage (Quota exceeded?).");
      }
      
      onAddLog("success", `Imported server job summary ${serverJobStatus.jobId}`);
    } catch (e: any) {
      onAddLog("error", `Failed to import server job: ${e.message}`);
    }
  };

  const handleCancelServerJob = async () => {
    if (!serverJobId) return;
    try {
      const res = await fetch(`/api/visual/batch-jobs/${serverJobId}/cancel`, { method: 'POST' });
      if (!res.ok) throw new Error(`Cancel failed: ${res.status}`);
      const data = await res.json();
      setServerJobStatus(data.job);
      onAddLog("info", "Requested server-side job cancellation");
    } catch (e: any) {
      onAddLog("error", `Cancel failed: ${e.message}`);
    }
  };

  const handleForceCancelServerJob = async () => {
    if (!serverJobId) return;
    try {
      const res = await fetch(`/api/visual/batch-jobs/${serverJobId}/force-cancel`, { method: 'POST' });
      if (!res.ok) throw new Error(`Force cancel failed: ${res.status}`);
      const data = await res.json();
      setServerJobStatus(data.job);
      onAddLog("warn", "Force-canceled server-side job");
    } catch (e: any) {
      onAddLog("error", `Force cancel failed: ${e.message}`);
    }
  };

  const handleRunBatch = async (resumeMode: boolean = false, includeFailed: boolean = false, onlyFailed: boolean = false) => {
    const checkpointRef = { current: null as any };
    const heartbeatTimer = setInterval(() => {
       if (checkpointRef.current && checkpointRef.current.status === 'running') {
          checkpointRef.current = {
             ...checkpointRef.current,
             lastHeartbeatAt: new Date().toISOString(),
             lastCheckpointSavedAt: new Date().toISOString()
          };
          try { saveActiveBatchCheckpoint(checkpointRef.current); } catch(e){}
          setActiveCheckpoint(checkpointRef.current);
       }
    }, 10000);
    try {
    let targetSamples = samples.filter(s => selectedSampleIds[s.id]);
    
    let isResuming = false;
    let initialCheckpoint: PublicSampleBatchCheckpoint | null = null;
    
    if (resumeMode && activeCheckpoint) {
      isResuming = true;
      initialCheckpoint = activeCheckpoint;
      let idsToRun: string[] = [];
      if (onlyFailed) {
        idsToRun = [...activeCheckpoint.failedSampleIds];
      } else if (includeFailed) {
        idsToRun = [...activeCheckpoint.pendingSampleIds, ...activeCheckpoint.failedSampleIds];
      } else {
        idsToRun = [...activeCheckpoint.pendingSampleIds];
      }
      targetSamples = samples.filter(s => idsToRun.includes(s.id));
    } else {
      if (targetSamples.length === 0) {
        onAddLog("warn", "実行対象のサンプルが選択されていません。");
        alert("実行対象のサンプルが選択されていません。チェックボックスで選択してください。");
        return;
      }
    }

    setHealthCheckFailed(false);
    setHealthCheckDiagnostics(null);
    setHealthCheckError(null);

    setIsBatchRunning(true);
    if (!isResuming) {
      setBatchSummary(null);
      setResult(null); // Clear single result
    }

    // Initialize or restore state
    let total = isResuming && initialCheckpoint ? initialCheckpoint.targetSampleIds.length : targetSamples.length;
    let currentProgress = isResuming && initialCheckpoint 
      ? (onlyFailed
          ? initialCheckpoint.targetSampleIds.length - initialCheckpoint.failedSampleIds.length
          : includeFailed 
            ? initialCheckpoint.targetSampleIds.length - (initialCheckpoint.pendingSampleIds.length + initialCheckpoint.failedSampleIds.length)
            : initialCheckpoint.completedSampleIds.length)
      : 0;
    setBatchProgress({ current: currentProgress, total });

    let items: PublicSampleBatchRunItem[] = [];
    
    let successCount = 0;
    let failureCount = 0;
    let validCount = 0;
    let validLowQualityCount = 0;
    let invalidJsonCount = 0;
    let expectedComparisonPassCount = 0;
    let expectedComparisonWarningCount = 0;
    let expectedComparisonFailCount = 0;
    let reviewPassCount = 0;
    let reviewNeedsReviewCount = 0;
    let reviewFailCount = 0;

    if (isResuming && initialCheckpoint) {
      if (onlyFailed) {
        // Exclude failed items so they run again, but keep successful items
        items = initialCheckpoint.items.filter(it => !initialCheckpoint!.failedSampleIds.includes(it.sampleId));
      } else if (includeFailed) {
        // Exclude failed items from items list to re-run them
        items = initialCheckpoint.items.filter(it => !initialCheckpoint!.failedSampleIds.includes(it.sampleId));
      } else {
        items = [...initialCheckpoint.items];
      }
      
      // Re-sum counters from remaining/restored items
      for (const item of items) {
        if (item.success) {
          successCount++;
          if (item.qualityStatus === 'valid') validCount++;
          if (item.qualityStatus === 'validLowQuality') validLowQualityCount++;
          
          const comp = item.comparison;
          if (comp) {
            if (comp.overallStatus === 'pass') expectedComparisonPassCount++;
            if (comp.overallStatus === 'warning') expectedComparisonWarningCount++;
            if (comp.overallStatus === 'fail') expectedComparisonFailCount++;

            if (comp.reviewStatus === 'pass') reviewPassCount++;
            if (comp.reviewStatus === 'needsReview') reviewNeedsReviewCount++;
            if (comp.reviewStatus === 'fail') reviewFailCount++;
          }
        } else {
          failureCount++;
          reviewFailCount++;
          if (item.failureKind === 'jsonParseError') {
            invalidJsonCount++;
          }
        }
      }
    }

    const newStatuses = { ...sampleStatuses };
    
    let currentCheckpoint: PublicSampleBatchCheckpoint; // replaced by checkpointRef.current // replaced by checkpointRef.current
    
    if (isResuming && initialCheckpoint) {
       checkpointRef.current = { 
         ...initialCheckpoint, 
         status: 'running',
         lastEvent: {
           type: 'batchStarted',
           timestamp: new Date().toISOString(),
           message: `Batch resumed (includeFailed: ${includeFailed}, onlyFailed: ${onlyFailed})`
         },
         ...(includeFailed || onlyFailed ? {
           pendingSampleIds: onlyFailed 
             ? [...initialCheckpoint.failedSampleIds]
             : [...initialCheckpoint.pendingSampleIds, ...initialCheckpoint.failedSampleIds],
           failedSampleIds: [],
           completedSampleIds: initialCheckpoint.completedSampleIds.filter(id => {
             return !initialCheckpoint!.failedSampleIds.includes(id);
           }),
           items: [...items],
           counters: {
             successCount,
             failureCount,
             validCount,
             validLowQualityCount,
             invalidJsonCount,
             expectedComparisonPassCount,
             expectedComparisonWarningCount,
             expectedComparisonFailCount,
             reviewPassCount,
             reviewNeedsReviewCount,
             reviewFailCount
           }
         } : {})
       };
       try {
         saveActiveBatchCheckpoint(checkpointRef.current);
       } catch (err: any) {
         console.warn("Failed to save initial checkpoint to localStorage", err);
       }
       setActiveCheckpoint(checkpointRef.current);
    } else {
       const initialTargetIds = targetSamples.map(s => s.id);
       checkpointRef.current = {
         checkpointVersion: "public-sample-batch-checkpoint.v0.1.0",
         runId: crypto.randomUUID(),
         createdAt: new Date().toISOString(),
         updatedAt: new Date().toISOString(),
         startedAt: new Date().toISOString(),
         status: 'running',
         modelName,
         jsonMode: jsonModeOption,
         customInstructionHash: fnv1a32(customInstruction.trim()),
         targetSampleIds: initialTargetIds,
         completedSampleIds: [],
         pendingSampleIds: [...initialTargetIds],
         failedSampleIds: [],
         items: [],
         counters: {
           successCount: 0,
           failureCount: 0,
           validCount: 0,
           validLowQualityCount: 0,
           invalidJsonCount: 0,
           expectedComparisonPassCount: 0,
           expectedComparisonWarningCount: 0,
           expectedComparisonFailCount: 0,
           reviewPassCount: 0,
           reviewNeedsReviewCount: 0,
           reviewFailCount: 0
         },
         runFingerprint: {
           modelName,
           jsonMode: jsonModeOption,
           customInstructionHash: fnv1a32(customInstruction.trim()),
           targetSampleIdsHash: buildTargetSampleIdsHash(initialTargetIds)
         },
         lastEvent: {
           type: 'batchStarted',
           timestamp: new Date().toISOString(),
           message: `Batch started with ${initialTargetIds.length} target samples`
         }
       };
       try {
         saveActiveBatchCheckpoint(checkpointRef.current);
       } catch (err: any) {
         console.warn("Failed to save initial checkpoint to localStorage", err);
         onAddLog("warn", "警告: ローカルストレージへのチェックポイント保存に失敗しました。解析は続行されます。");
       }
       setActiveCheckpoint(checkpointRef.current);
    }

    // Pre-batch health check
    onAddLog("info", "バッチ開始前にヘルスチェックを実行しています...");
    const hcResult = await safeFetchWithRetry<any>("/api/visual/health", undefined, {
      maxAttempts: 3,
      retryHttpStatuses: [502, 503, 504],
      onRetry: (event: SafeFetchRetryEvent) => {
        onAddLog("warn", `[Health Check] サーバーウォームアップまたは一時的エラーを検出しました。${event.delayMs / 1000}秒後にリトライします (Attempt ${event.attempt})...`);
      }
    });
    
    if (!hcResult.success || !hcResult.data?.ok) {
      setIsBatchRunning(false);
      setHealthCheckFailed(true);
      setHealthCheckDiagnostics(hcResult.responseDiagnostics || null);
      setHealthCheckError(hcResult.error || "ヘルスチェック応答が不正です。");
      onAddLog("error", `ヘルスチェックに失敗しました。バッチ処理は開始されません。: ${hcResult.error}`);
      
      checkpointRef.current = {
        ...checkpointRef.current,
        status: 'failed',
        lastError: hcResult.error || "Health check failed",
        lastFailureKind: hcResult.failureKind || "healthCheckFailed",
        lastResponseDiagnostics: hcResult.responseDiagnostics,
        lastEvent: {
          type: 'batchFailed',
          timestamp: new Date().toISOString(),
          error: hcResult.error || "Health check failed",
          failureKind: hcResult.failureKind || "healthCheckFailed",
          message: `Health check failed: ${hcResult.error}`
        }
      };
      try {
        saveActiveBatchCheckpoint(checkpointRef.current);
      } catch (err: any) {
        console.warn("Failed to save checkpoint progress to localStorage", err);
      }
      setActiveCheckpoint(checkpointRef.current);
      return;
    }

    onAddLog("success", "ヘルスチェックに成功しました。バッチ解析を開始します。");

    checkpointRef.current = {
      ...checkpointRef.current,
      lastEvent: {
        type: 'healthCheckPassed',
        timestamp: new Date().toISOString(),
        message: "Health check passed successfully"
      }
    };
    try {
      saveActiveBatchCheckpoint(checkpointRef.current);
    } catch (err: any) {
      console.warn("Failed to save checkpoint progress to localStorage", err);
    }
    setActiveCheckpoint(checkpointRef.current);

    for (let i = 0; i < targetSamples.length; i++) {
        const sample = targetSamples[i];
        currentProgress++;
        setBatchProgress({ current: currentProgress, total });
        
        const sampleStartedAt = new Date();
        
        checkpointRef.current = {
          ...checkpointRef.current,
          currentSampleId: sample.id,
          currentSampleTitle: sample.title,
          lastEvent: {
            type: 'sampleStarted',
            timestamp: new Date().toISOString(),
            sampleId: sample.id,
            sampleTitle: sample.title,
            message: `Started processing sample: ${sample.title} (${sample.id})`
          }
        };
        try {
          saveActiveBatchCheckpoint(checkpointRef.current);
        } catch (err: any) {
          console.warn("Failed to save checkpoint at sampleStarted", err);
        }
        setActiveCheckpoint(checkpointRef.current);
        
        checkpointRef.current = {
          ...checkpointRef.current,
          lastEvent: {
            type: 'apiRequestStarted',
            timestamp: new Date().toISOString(),
            sampleId: sample.id,
            sampleTitle: sample.title,
            message: `Sending API request for ${sample.title}`
          }
        };
        try {
          saveActiveBatchCheckpoint(checkpointRef.current);
        } catch (err: any) {
          console.warn("Failed to save checkpoint at apiRequestStarted", err);
        }
        setActiveCheckpoint(checkpointRef.current);

        let item: PublicSampleBatchRunItem | null = null;
        try {
            const sfResult = await safeFetchWithRetry<any>('/api/visual/public-samples/analyze', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                sampleId: sample.id,
                modelName: modelName,
                jsonMode: jsonModeOption,
                includeRequestPreview: false, // Force false for batch
                customInstruction: customInstruction.trim()
              })
            }, {
              retryHttpStatuses: [429, 502, 503, 504],
              maxAttempts: 2,
              delaysMs: [60000],
              onRetry: (event: SafeFetchRetryEvent) => {
                const reason = event.status === 429 
                  ? "レート制限 (429)" 
                  : event.status 
                    ? `HTTP エラー (${event.status})` 
                    : event.failureKind === "networkError" 
                      ? "ネットワークエラー" 
                      : event.htmlTitle || "一時的なエラー";
                onAddLog("warn", `[Batch ${sample.id}] リトライが必要なエラーを検出しました (${reason})。${event.delayMs / 1000}秒後にリトライします (Attempt ${event.attempt})...`);
              }
            });
            
            checkpointRef.current = {
              ...checkpointRef.current,
              lastResponseDiagnostics: sfResult.responseDiagnostics,
              lastRetryDiagnostics: sfResult.retryDiagnostics,
              lastError: sfResult.error,
              lastFailureKind: sfResult.failureKind,
              lastEvent: {
                type: 'apiResponseReceived',
                timestamp: new Date().toISOString(),
                sampleId: sample.id,
                sampleTitle: sample.title,
                message: `Received API response for ${sample.title} (status: ${sfResult.responseDiagnostics?.status || 'N/A'})`
              }
            };
            try {
              saveActiveBatchCheckpoint(checkpointRef.current);
            } catch (err: any) {
              console.warn("Failed to save checkpoint at apiResponseReceived", err);
            }
            setActiveCheckpoint(checkpointRef.current);

            if (sfResult.responseDiagnostics?.status === 401) {
              onSessionExpiry();
              throw new Error("Session expired (401)");
            }

            const data = sfResult.data || {};
            
            const sampleCompletedAt = new Date();
            item = {
              sampleId: sample.id,
              title: sample.title,
              startedAt: sampleStartedAt.toISOString(),
              completedAt: sampleCompletedAt.toISOString(),
              durationMs: sampleCompletedAt.getTime() - sampleStartedAt.getTime(),
              success: sfResult.success && data.success,
              qualityStatus: data.qualityStatus,
              qualityScore: data.qualityScore,
              qualityIssues: data.qualityIssues,
              analysisRun: data.analysisRun,
              parseDiagnostics: data.parseDiagnostics,
              generationDiagnostics: data.generationDiagnostics,
              inputDiagnostics: data.inputDiagnostics,
              normalizationDiagnostics: data.normalizationDiagnostics,
              failureKind: sfResult.failureKind || data.failureKind,
              error: sfResult.error || data.error,
              responseRaw: data,
              responseDiagnostics: sfResult.responseDiagnostics,
              retryDiagnostics: sfResult.retryDiagnostics
            };

            if (sfResult.success && data.success) {
                successCount++;
                newStatuses[sample.id] = "success";
                if (data.qualityStatus === 'valid') validCount++;
                if (data.qualityStatus === 'validLowQuality') validLowQualityCount++;
                
                // compute comparison
                const expectedMetadata = data.expectedMetadata;
                const comparisonSample = {
                  ...sample,
                  expectedImageKind: expectedMetadata?.imageKind ?? sample.expectedImageKind,
                  acceptableImageKinds: expectedMetadata?.acceptableImageKinds ?? sample.acceptableImageKinds,
                  expectedElementCategories: expectedMetadata?.elementCategories ?? sample.expectedElementCategories,
                  expectedVisibleElementLabels: expectedMetadata?.visibleElementLabels ?? sample.expectedVisibleElementLabels,
                  expectedVisibleElementLabelAliases: expectedMetadata?.visibleElementLabelAliases ?? sample.expectedVisibleElementLabelAliases,
                  expectedVisibleText: expectedMetadata?.visibleText ?? sample.expectedVisibleText,
                  optionalElementCategories: expectedMetadata?.optionalElementCategories ?? sample.optionalElementCategories,
                  optionalVisibleElementLabels: expectedMetadata?.optionalVisibleElementLabels ?? sample.optionalVisibleElementLabels,
                  optionalVisibleElementLabelAliases: expectedMetadata?.optionalVisibleElementLabelAliases ?? sample.optionalVisibleElementLabelAliases,
                  optionalVisibleText: expectedMetadata?.optionalVisibleText ?? sample.optionalVisibleText
                };
                const comp = evaluateSampleComparison(comparisonSample, data);
                item.comparison = comp;
                
                if (comp.overallStatus === 'pass') expectedComparisonPassCount++;
                if (comp.overallStatus === 'warning') expectedComparisonWarningCount++;
                if (comp.overallStatus === 'fail') expectedComparisonFailCount++;

                if (comp.reviewStatus === 'pass') reviewPassCount++;
                if (comp.reviewStatus === 'needsReview') reviewNeedsReviewCount++;
                if (comp.reviewStatus === 'fail') reviewFailCount++;
            } else {
                failureCount++;
                reviewFailCount++;
                newStatuses[sample.id] = "failure";
                if (item.failureKind === 'jsonParseError' || (data.parseDiagnostics && !data.parseDiagnostics.success && data.parseDiagnostics.attempts)) {
                    invalidJsonCount++;
                }
            }
            items.push(item);
        } catch (e: any) {
            failureCount++;
            reviewFailCount++;
            newStatuses[sample.id] = "failure";
            item = {
               sampleId: sample.id,
               title: sample.title,
               success: false,
               error: e.message,
               failureKind: "executionError"
            };
            items.push(item);
        }
        setSampleStatuses({ ...newStatuses });

        // Update matrix results in real-time
        if (item) {
          let overallStatus: 'pass' | 'warning' | 'fail' | undefined;
          let reviewStatus: 'pass' | 'needsReview' | 'fail' | undefined;
          if (item.comparison) {
            overallStatus = item.comparison.overallStatus;
            reviewStatus = item.comparison.reviewStatus;
          }
          handleUpdateMatrixResult({
            sampleId: item.sampleId,
            modelName,
            jsonMode: jsonModeOption,
            success: item.success,
            timestamp: new Date().toISOString(),
            runId: checkpointRef.current?.runId,
            overallStatus,
            reviewStatus,
            error: item.error,
            source: 'client-batch'
          });
        }
        
        // Update and save checkpoint after each sample
        checkpointRef.current = {
          ...checkpointRef.current,
          updatedAt: new Date().toISOString(),
          completedSampleIds: [...checkpointRef.current.completedSampleIds, sample.id],
          pendingSampleIds: checkpointRef.current.pendingSampleIds.filter(id => id !== sample.id),
          failedSampleIds: item.success ? checkpointRef.current.failedSampleIds : [...checkpointRef.current.failedSampleIds, sample.id],
          items: [...items], // copy to trigger updates if used directly
          lastError: item.success ? checkpointRef.current.lastError : item.error,
          lastFailureKind: item.success ? checkpointRef.current.lastFailureKind : item.failureKind,
          lastEvent: {
            type: item.success ? 'sampleCompleted' : 'sampleFailed',
            timestamp: new Date().toISOString(),
            sampleId: sample.id,
            sampleTitle: sample.title,
            failureKind: item.success ? undefined : item.failureKind,
            error: item.success ? undefined : item.error,
            message: item.success 
              ? `Completed sample: ${sample.title} (${sample.id}) successfully`
              : `Failed sample: ${sample.title} (${sample.id}) - ${item.error || 'Unknown error'}`
          },
          counters: {
            successCount,
            failureCount,
            validCount,
            validLowQualityCount,
            invalidJsonCount,
            expectedComparisonPassCount,
            expectedComparisonWarningCount,
            expectedComparisonFailCount,
            reviewPassCount,
            reviewNeedsReviewCount,
            reviewFailCount
          }
        };
        try {
          saveActiveBatchCheckpoint(checkpointRef.current);
        } catch (err: any) {
          console.warn("Failed to save checkpoint progress to localStorage", err);
          checkpointRef.current.lastEvent = {
            type: 'checkpointSaveFailed',
            timestamp: new Date().toISOString(),
            message: `Failed to save progress checkpoint to localStorage: ${err.message}`
          };
        }
        setActiveCheckpoint(checkpointRef.current);
    }
    
    const batchCompletedAt = new Date();
    checkpointRef.current = {
      ...checkpointRef.current,
      status: 'completed',
      updatedAt: batchCompletedAt.toISOString(),
      completedAt: batchCompletedAt.toISOString(),
      durationMs: checkpointRef.current.startedAt ? batchCompletedAt.getTime() - new Date(checkpointRef.current.startedAt).getTime() : undefined,
      currentSampleId: undefined,
      currentSampleTitle: undefined
    };

    const summary: PublicSampleBatchRunSummary = {
        runId: checkpointRef.current.runId,
        timestamp: new Date().toISOString(),
        startedAt: checkpointRef.current.startedAt,
        completedAt: checkpointRef.current.completedAt,
        durationMs: checkpointRef.current.durationMs,
        modelName,
        jsonMode: jsonModeOption,
        total,
        successCount,
        failureCount,
        validCount,
        validLowQualityCount,
        invalidJsonCount,
        expectedComparisonPassCount,
        expectedComparisonWarningCount,
        expectedComparisonFailCount,
        reviewPassCount,
        reviewNeedsReviewCount,
        reviewFailCount,
        items
    };
    
    setBatchSummary(summary);
    
    // Clear the active checkpoint as the batch has completed normally
    clearActiveBatchCheckpoint();
    setActiveCheckpoint(null);
    
    // Save a compact version to localStorage to prevent quota limits
    const shrinkBatchRunSummaryForLocalStorage = (sum: PublicSampleBatchRunSummary) => {
      return {
        ...sum,
        items: sum.items.map(it => {
          const matchedSample = PUBLIC_VISUAL_SAMPLES.find(s => s.id === it.sampleId);
          const category = it.category || 
                           matchedSample?.category || 
                           (it.responseRaw?.sampleMetadata as any)?.category || 
                           (it.comparison as any)?.category || 
                           "unknown";
          
          let exec: any = undefined;
          if (it.analysisRun?.metadata ?? it.analysisRun) {
            const run = it.analysisRun?.metadata ?? it.analysisRun;
            exec = {
              modelName: run.model?.name || run.execution?.modelName,
              providerFamily: run.model?.providerFamily || run.execution?.providerFamily,
              structuredExecutionMode: run.execution?.structuredExecutionMode,
              jsonMode: run.execution?.jsonMode,
              jsonRecovery: run.execution?.jsonRecovery
            };
          } else if (it.execution) {
            exec = {
              modelName: it.execution.modelName,
              providerFamily: it.execution.providerFamily,
              structuredExecutionMode: it.execution.structuredExecutionMode,
              jsonMode: it.execution.jsonMode,
              jsonRecovery: it.execution.jsonRecovery
            };
          }

          return {
            sampleId: it.sampleId,
            title: it.title,
            success: it.success,
            error: it.error,
            failureKind: it.failureKind,
            qualityStatus: it.qualityStatus,
            qualityScore: it.qualityScore,
            qualityIssues: it.qualityIssues,
            category,
            taxonomyCategory: it.taxonomyCategory,
            comparison: it.comparison ? {
              imageKind: it.comparison.imageKind,
              categories: it.comparison.categories,
              labels: it.comparison.labels,
              visibleText: it.comparison.visibleText,
              overallStatus: it.comparison.overallStatus,
              reviewStatus: it.comparison.reviewStatus,
              reviewReasons: it.comparison.reviewReasons
            } : undefined,
            execution: exec
          };
        })
      };
    };

    const saved = localStorage.getItem("image_experiment_batch_runs");
    let runs = saved ? JSON.parse(saved) : [];
    runs.unshift(shrinkBatchRunSummaryForLocalStorage(summary));
    if (runs.length > 5) runs = runs.slice(0, 5);
    localStorage.setItem("image_experiment_batch_runs", JSON.stringify(runs));
    setPastBatchRuns(runs);

    setIsBatchRunning(false);
    setBatchProgress(null);
    onAddLog("success", `Batch regression complete for ${total} samples.`);

    // If exactly 1 sample was processed in this subset run, also set single result so the user can see detail tabs immediately
    if (total === 1 && items[0].responseRaw) {
      setResult(items[0].responseRaw);
    }
    } finally {
      clearInterval(heartbeatTimer);
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto p-[1px] md:p-6">
      {/* 🚀 タブナビゲーション */}
      {!activeSubTab && (
        <div className="flex border-b border-slate-200 bg-slate-100/50 p-1 rounded-xl gap-1 mb-2 shadow-sm">
          <button
            onClick={() => setExperimentViewTab("client")}
            className={`flex-1 py-3 px-4 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 ${
              experimentViewTab === "client"
                ? "bg-white text-indigo-600 shadow-sm border border-slate-200/50"
                : "text-slate-500 hover:text-slate-900 hover:bg-slate-200/30"
            }`}
          >
            <Activity className="w-4 h-4 text-indigo-500" />
            クライアント実験 (Client Experiment)
          </button>
          <button
            onClick={() => {
              setExperimentViewTab("server");
              setShowServerSideJob(true); // サーバー実験タブ選択時に自動展開
            }}
            className={`flex-1 py-3 px-4 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 ${
              experimentViewTab === "server"
                ? "bg-white text-indigo-600 shadow-sm border border-slate-200/50"
                : "text-slate-500 hover:text-slate-900 hover:bg-slate-200/30"
            }`}
          >
            <Terminal className="w-4 h-4 text-purple-500" />
            サーバー実験 (Server Job)
          </button>
          <button
            onClick={() => setExperimentViewTab("matrix")}
            className={`flex-1 py-3 px-4 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 ${
              experimentViewTab === "matrix"
                ? "bg-white text-indigo-600 shadow-sm border border-slate-200/50"
                : "text-slate-500 hover:text-slate-900 hover:bg-slate-200/30"
            }`}
          >
            <CheckCircle className="w-4 h-4 text-emerald-500" />
            実験結果マトリクス (Matrix Results)
          </button>
        </div>
      )}

      {experimentViewTab !== "matrix" ? (
        <>
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-[1px] sm:p-5">
              {experimentViewTab === "client" && activeCheckpoint && (
            <div className="mb-6 p-5 rounded-xl border border-amber-200 bg-amber-50/70 backdrop-blur-sm shadow-sm space-y-4">
              <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between border-b border-amber-200/60 pb-3">
                <div className="space-y-1">
                  <h3 className="text-sm font-bold text-amber-900 flex items-center gap-2">
                    <Activity className="w-4 h-4 text-amber-600 animate-pulse" />
                    {isBatchRunning ? 'バッチ解析実行中' : '未完了のバッチ解析があります (チェックポイント検出)'}
                    {(() => {
                       const now = new Date().getTime();
                       const lastHb = activeCheckpoint.lastHeartbeatAt ? new Date(activeCheckpoint.lastHeartbeatAt).getTime() : 0;
                       const isStale = activeCheckpoint.status === 'running' && (now - lastHb > 60000);
                       if (isBatchRunning) {
                          if (activeCheckpoint.lastEvent?.type === 'apiRequestStarted') return <span className="ml-2 px-2 py-0.5 bg-blue-100 text-blue-800 text-[10px] rounded">API応答待ち</span>;
                          return <span className="ml-2 px-2 py-0.5 bg-green-100 text-green-800 text-[10px] rounded">実行中</span>;
                       }
                       if (activeCheckpoint.status === 'running') {
                          if (isStale) return <span className="ml-2 px-2 py-0.5 bg-red-100 text-red-800 text-[10px] rounded">中断の可能性 (Stale)</span>;
                          return <span className="ml-2 px-2 py-0.5 bg-green-100 text-green-800 text-[10px] rounded">実行中 (BG)</span>;
                       }
                       if (activeCheckpoint.status === 'failed') return <span className="ml-2 px-2 py-0.5 bg-red-100 text-red-800 text-[10px] rounded">失敗</span>;
                       return null;
                    })()}
                  </h3>
                  <p className="text-xs text-amber-700">
                    {isBatchRunning 
                      ? "バッチ処理を実行しています。以下の診断情報がリアルタイムに更新されます。"
                      : "前回のバッチ実行が途中で中断されました。以下から現在の診断情報と、再開・破棄アクションを選択できます。"}
                    <br/>
                    <span className="font-semibold text-amber-800">※ チェックボックスの選択に関わらず、保存されたチェックポイントの対象サンプルで実行されます。</span>
                  </p>
                </div>
                <div className="flex flex-wrap gap-2 w-full lg:w-auto shrink-0">
                  <button
                    onClick={() => {
                      if (confirm("本当にこのチェックポイントを破棄しますか？")) {
                        clearActiveBatchCheckpoint();
                        setActiveCheckpoint(null);
                      }
                    }}
                    disabled={isBatchRunning}
                    className="px-3 py-1.5 text-xs font-bold text-amber-700 hover:text-amber-800 bg-amber-100/80 hover:bg-amber-200 rounded-md transition-colors disabled:opacity-50 flex items-center gap-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> 破棄する
                  </button>
                  <button
                    onClick={() => handleRunBatch(true, false)}
                    disabled={isBatchRunning}
                    className="px-3 py-1.5 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-md transition-colors disabled:opacity-50 flex items-center gap-1 shadow-sm"
                  >
                    <Play className="w-3.5 h-3.5" /> 未完了のみ再開
                  </button>
                  {activeCheckpoint.failedSampleIds.length > 0 && (
                    <>
                      <button
                        onClick={() => handleRunBatch(true, false, true)}
                        disabled={isBatchRunning}
                        className="px-3 py-1.5 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-md transition-colors disabled:opacity-50 flex items-center gap-1 shadow-sm"
                      >
                        <RefreshCw className="w-3.5 h-3.5" /> 失敗のみ再開
                      </button>
                      <button
                        onClick={() => handleRunBatch(true, true)}
                        disabled={isBatchRunning}
                        className="px-3 py-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-md transition-colors disabled:opacity-50 flex items-center gap-1 shadow-sm"
                      >
                        <RotateCw className="w-3.5 h-3.5" /> 失敗＋未完了も再開
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Advanced Controls: Copy / Download JSON */}
              <div className="flex flex-wrap gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(JSON.stringify(activeCheckpoint, null, 2));
                    alert("チェックポイントJSONをクリップボードにコピーしました！");
                  }}
                  className="px-2.5 py-1 text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded shadow-sm flex items-center gap-1 transition-colors"
                >
                  <Copy className="w-3.5 h-3.5" /> チェックポイントJSONをコピー
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const blob = new Blob([JSON.stringify(activeCheckpoint, null, 2)], { type: 'application/json' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `batch-checkpoint-${activeCheckpoint.runId}.json`;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                  }}
                  className="px-2.5 py-1 text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded shadow-sm flex items-center gap-1 transition-colors"
                >
                  <Download className="w-3.5 h-3.5" /> 診断JSONをダウンロード
                </button>
              </div>

              {/* Progress & Setup Status */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                <div className="bg-white p-3 rounded-lg border border-amber-100">
                  <div className="text-slate-400 font-medium">基本情報</div>
                  <div className="mt-1 font-semibold text-slate-800">
                    モデル: <span className="text-slate-900">{activeCheckpoint.modelName}</span>
                  </div>
                  <div className="text-slate-600">
                    モード: {activeCheckpoint.jsonMode === 'json_object' ? 'JSON Mode' : 'Plain Text'}
                  </div>
                  <div className="text-slate-500 text-[10px] mt-1 space-y-0.5">
                    <div>開始時刻: {new Date(activeCheckpoint.createdAt).toLocaleString()}</div>
                    {activeCheckpoint.lastHeartbeatAt && <div>最終Heartbeat: {new Date(activeCheckpoint.lastHeartbeatAt).toLocaleTimeString()}</div>}
                    {activeCheckpoint.lastCheckpointSavedAt && <div>最終保存: {new Date(activeCheckpoint.lastCheckpointSavedAt).toLocaleTimeString()}</div>}
                  </div>
                </div>

                <div className="bg-white p-3 rounded-lg border border-amber-100">
                  <div className="text-slate-400 font-medium">進捗状況</div>
                  <div className="mt-1 flex items-center gap-2">
                    <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                      <div 
                        className="bg-amber-500 h-full transition-all duration-300" 
                        style={{ width: `${(activeCheckpoint.completedSampleIds.length / activeCheckpoint.targetSampleIds.length) * 100}%` }}
                      />
                    </div>
                    <span className="font-mono font-bold text-slate-700 whitespace-nowrap">
                      {activeCheckpoint.completedSampleIds.length} / {activeCheckpoint.targetSampleIds.length}
                    </span>
                  </div>
                  <div className="mt-1 flex gap-3 text-slate-600 text-[11px]">
                    <span className="text-emerald-700 font-semibold">成功: {activeCheckpoint.counters.successCount}</span>
                    <span className="text-rose-700 font-semibold">失敗: {activeCheckpoint.counters.failureCount}</span>
                    <span className="text-slate-500 font-semibold">未着手: {activeCheckpoint.pendingSampleIds.length}</span>
                  </div>
                </div>

                <div className="bg-white p-3 rounded-lg border border-amber-100">
                  <div className="text-slate-400 font-medium">直近のバッチイベント</div>
                  {activeCheckpoint.lastEvent ? (
                    <div className="mt-1 space-y-0.5">
                      <div className="font-semibold text-amber-900 flex items-center gap-1">
                        <span className="px-1.5 py-0.2 bg-amber-100 text-amber-800 rounded font-mono text-[9px]">
                          {activeCheckpoint.lastEvent.type}
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-500 font-mono">
                        {new Date(activeCheckpoint.lastEvent.timestamp).toLocaleTimeString()}
                      </div>
                      {activeCheckpoint.lastEvent.message && (
                        <div className="text-slate-700 text-[11px] line-clamp-2" title={activeCheckpoint.lastEvent.message}>
                          {activeCheckpoint.lastEvent.message}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="mt-1 text-slate-500 italic">イベント記録なし</div>
                  )}
                </div>
              </div>

              {/* Status & Diagnostic Details */}
              {activeCheckpoint.items.length === 0 && activeCheckpoint.completedSampleIds.length === 0 && (
                <div className="bg-amber-100 text-amber-800 text-xs p-3 rounded-lg">
                  最初のサンプル処理中に中断したため、サンプル単位の失敗詳細はまだ保存されていません。ただし、以下の直近のイベントやエラーが記録されている場合があります。
                </div>
              )}
              {(activeCheckpoint.currentSampleId || activeCheckpoint.lastError || activeCheckpoint.lastFailureKind) && (
                <div className="bg-white p-4 rounded-lg border border-amber-100 space-y-2 text-xs">
                  <h4 className="font-bold text-slate-800 border-b pb-1">直近の実行中サンプル & エラー診断</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-2">
                    {activeCheckpoint.currentSampleId && (
                      <div>
                        <span className="text-slate-400 block text-[10px]">実行中だったサンプル:</span>
                        <span className="font-semibold text-slate-800">
                          {activeCheckpoint.currentSampleTitle || '名称未設定'} 
                          <span className="text-[10px] text-slate-500 font-mono ml-1">({activeCheckpoint.currentSampleId})</span>
                        </span>
                      </div>
                    )}
                    {activeCheckpoint.lastFailureKind && (
                      <div>
                        <span className="text-slate-400 block text-[10px]">失敗種別 (Failure Kind):</span>
                        <span className="font-mono text-rose-700 font-semibold bg-rose-50 px-1 py-0.5 rounded">
                          {activeCheckpoint.lastFailureKind}
                        </span>
                      </div>
                    )}
                    {activeCheckpoint.lastError && (
                      <div className="col-span-1 md:col-span-2">
                        <span className="text-slate-400 block text-[10px]">直近のエラー詳細 (Last Error):</span>
                        <span className="text-rose-900 font-mono bg-rose-50/50 p-1 rounded block mt-0.5 whitespace-pre-wrap break-all text-[11px]">
                          {activeCheckpoint.lastError}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* HTTP / Retry Diagnostics detail */}
                  {activeCheckpoint.lastResponseDiagnostics && (
                    <div className="mt-2 pt-2 border-t border-slate-100 text-[11px] grid grid-cols-1 md:grid-cols-3 gap-2">
                      <div>
                        <span className="text-slate-400">HTTP Status:</span>{' '}
                        <span className="font-mono font-semibold text-slate-700">
                          {activeCheckpoint.lastResponseDiagnostics.status} {activeCheckpoint.lastResponseDiagnostics.statusText}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400">Content-Type:</span>{' '}
                        <span className="font-mono text-slate-700">{activeCheckpoint.lastResponseDiagnostics.contentType || 'N/A'}</span>
                      </div>
                      {activeCheckpoint.lastResponseDiagnostics.htmlTitle && (
                        <div>
                          <span className="text-slate-400">HTML Title:</span>{' '}
                          <span className="font-semibold text-amber-800">"{activeCheckpoint.lastResponseDiagnostics.htmlTitle}"</span>
                        </div>
                      )}
                    </div>
                  )}

                  {activeCheckpoint.lastRetryDiagnostics && activeCheckpoint.lastRetryDiagnostics.attempts > 1 && (
                    <div className="text-[10px] text-slate-500 font-mono">
                      リトライ実績: {activeCheckpoint.lastRetryDiagnostics.attempts} 回の試行を実施
                    </div>
                  )}
                </div>
              )}

              {/* Special message if first sample interrupted */}
              {activeCheckpoint.items.length === 0 && activeCheckpoint.completedSampleIds.length === 0 && (
                <div className="p-3 bg-blue-50 text-blue-800 rounded-lg text-xs border border-blue-100 flex items-center gap-1.5">
                  <Info className="w-4 h-4 text-blue-600 shrink-0" />
                  <span>最初のサンプル処理中に中断したため、サンプル単位の失敗詳細はまだ保存されていません。</span>
                </div>
              )}

              {/* Failed Items List if any */}
              {activeCheckpoint.items.filter(it => !it.success).length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5 text-rose-500" />
                    これまでに失敗したサンプル一覧 ({activeCheckpoint.items.filter(it => !it.success).length}件)
                  </h4>
                  <div className="max-h-48 overflow-y-auto border border-slate-200 rounded-lg bg-white divide-y divide-slate-100 shadow-inner">
                    {activeCheckpoint.items.filter(it => !it.success).map((item, idx) => (
                      <div key={(item.sampleId || "sample") + "-" + idx} className="p-3 hover:bg-slate-50 text-xs transition-colors flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                        <div className="space-y-1">
                          <div className="font-semibold text-slate-800 flex items-center gap-1.5">
                            <span>{item.title}</span>
                            <span className="text-[10px] text-slate-400 font-mono">({item.sampleId})</span>
                          </div>
                          {item.error && (
                            <div className="text-rose-800 font-mono text-[11px] bg-rose-50/50 px-1.5 py-1 rounded break-all mt-1">
                              {item.error}
                            </div>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-1 items-start sm:justify-end text-[10px] shrink-0">
                          {item.failureKind && (
                            <span className="px-1.5 py-0.5 rounded bg-rose-50 text-rose-700 font-mono border border-rose-100">
                              Kind: {item.failureKind}
                            </span>
                          )}
                          {item.generationDiagnostics?.providerStatus && (
                            <span className="px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 font-mono border border-amber-100">
                              Provider Status: {item.generationDiagnostics.providerStatus}
                            </span>
                          )}
                          {item.responseDiagnostics?.status && (
                            <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-mono border border-slate-200">
                              HTTP: {item.responseDiagnostics.status}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {experimentViewTab === "client" && hasIncompatibleCheckpoint && !isBatchRunning && (
            <div className="mb-6 p-4 rounded-lg border border-slate-200 bg-slate-50">
              <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
                <div className="space-y-1">
                  <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2">
                    <Activity className="w-4 h-4 text-slate-500" />
                    中断されたバッチ解析がありますが、現在の設定と一致しません
                  </h3>
                  <p className="text-xs text-slate-600">
                    設定（モデル、JSONモード、または指示文など）が異なるため、このまま再開することはできません。設定を元に戻すか、このバッチを破棄してください。
                  </p>
                </div>
                <div className="flex gap-2 w-full md:w-auto shrink-0 justify-end">
                  <button
                    onClick={() => {
                      clearActiveBatchCheckpoint();
                      setHasIncompatibleCheckpoint(false);
                    }}
                    disabled={isBatchRunning}
                    className="px-3 py-1.5 text-xs font-bold text-slate-700 hover:text-slate-800 bg-slate-200/60 hover:bg-slate-300/60 rounded-md transition-colors disabled:opacity-50"
                  >
                    破棄する
                  </button>
                </div>
              </div>
            </div>
          )}
          
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left side: Inputs */}
            <div className="lg:col-span-12 space-y-4">
              <div className="space-y-4">
                  {/* Quick Selection Actions & Thumbnail Grid Panel */}
                  <div className="flex flex-col gap-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-end gap-3 border-b border-slate-100 pb-3">

                      <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={handleSelectAllSamples}
                          className="px-2 py-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded text-[10px] font-bold shadow-sm transition-colors"
                        >
                          全選択
                        </button>
                        <button
                          type="button"
                          onClick={handleDeselectAllSamples}
                          className="px-2 py-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded text-[10px] font-bold shadow-sm transition-colors"
                        >
                          全解除
                        </button>
                        <button
                          type="button"
                          onClick={handleSelectNonSuccessfulSamples}
                          className="px-2 py-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded text-[10px] font-bold shadow-sm transition-colors"
                          title="まだ成功していない、または失敗したサンプルのみを選択します"
                        >
                          未成功のみ選択
                        </button>
                        <button
                          type="button"
                          onClick={handleClearSampleStatuses}
                          disabled={Object.keys(sampleStatuses).length === 0}
                          className="px-2 py-1 text-red-600 hover:text-red-700 hover:bg-red-50 disabled:opacity-50 disabled:hover:bg-transparent rounded text-[10px] font-bold transition-colors flex items-center gap-1 border border-transparent"
                          title="サンプルの実行成功・失敗インジケーターをクリアします"
                        >
                          <Trash2 className="w-3.5 h-3.5" /> インジケータークリア
                        </button>
                      </div>
                    </div>

                    {samples.length > 0 ? (
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 gap-1.5 max-h-none overflow-visible pr-0">
                        {samples.map((s) => {
                          const isChecked = !!selectedSampleIds[s.id];
                          const isHighlighted = selectedSampleId === s.id;
                          const runStatus = sampleStatuses[s.id];
                          const thumbUrl = s.thumbnailRoute || s.source?.thumbnailUrl || s.source?.imageUrl;

                          return (
                            <div
                              key={s.id}
                              onClick={() => {
                                setSelectedSampleId(s.id);
                                localStorage.setItem("image_experiment_selected_sample_id", s.id);
                              }}
                              className={`group relative flex items-center gap-2 p-1.5 rounded-lg border text-left cursor-pointer transition-all select-none ${
                                isHighlighted
                                  ? "bg-indigo-50/70 border-indigo-300 ring-1 ring-indigo-300/30"
                                  : "bg-white border-slate-200 hover:border-indigo-200 hover:bg-slate-50/50"
                              }`}
                            >
                              {/* Checkbox */}
                              <div className="shrink-0 flex items-center" onClick={(e) => e.stopPropagation()}>
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={(e) => {
                                    setSelectedSampleIds((prev) => ({
                                      ...prev,
                                      [s.id]: e.target.checked,
                                    }));
                                  }}
                                  className="w-3.5 h-3.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                                />
                              </div>

                              {/* Thumbnail */}
                              <div className="w-8 h-8 rounded overflow-hidden border border-slate-200 bg-slate-100 shrink-0 relative flex items-center justify-center group-hover:border-slate-300">
                                {thumbUrl ? (
                                  <img
                                    src={thumbUrl}
                                    alt={s.title}
                                    referrerPolicy="no-referrer"
                                    className="w-full h-full object-cover transition-transform group-hover:scale-105"
                                    onError={(e) => {
                                      e.currentTarget.style.display = 'none';
                                      const nextSibling = e.currentTarget.nextElementSibling as HTMLElement;
                                      if (nextSibling) nextSibling.style.display = 'flex';
                                    }}
                                  />
                                ) : null}
                                <div className="hidden absolute inset-0 bg-rose-50 items-center justify-center text-rose-300 flex-col" style={{ display: !thumbUrl ? 'flex' : 'none' }}>
                                  <AlertCircle className="w-3.5 h-3.5" />
                                </div>
                              </div>

                              {/* Text info */}
                              <div className="min-w-0 flex-1 flex flex-col justify-center">
                                <span className={`font-bold leading-tight truncate text-[10.5px] block ${
                                  isHighlighted ? "text-indigo-900" : "text-slate-700"
                                }`} title={s.title}>
                                  {s.title}
                                </span>
                                <div className="flex items-center gap-1 mt-0.5 overflow-hidden">
                                  <span className="text-[8.5px] text-slate-400 font-medium truncate capitalize shrink-0">
                                    {s.category}
                                  </span>
                                  <span className={`text-[7px] font-bold px-1 py-0.5 rounded-sm shrink-0 uppercase tracking-wider ${
                                    (s.isSynthetic ?? s.source?.provider === "localFixture")
                                      ? "bg-amber-100 text-amber-700" 
                                      : "bg-blue-100 text-blue-700"
                                  }`}>
                                    {(s.isSynthetic ?? s.source?.provider === "localFixture") ? "SYNTHETIC" : "EXTERNAL"}
                                  </span>
                                </div>
                              </div>

                              {/* Overlaid status badge or indicators */}
                              <div className="absolute top-1 right-1 flex gap-0.5 items-center">
                                {runStatus === "success" && (
                                  <span className="w-2 h-2 rounded-full bg-emerald-500 ring-1 ring-white shadow-sm" title="成功" />
                                )}
                                {runStatus === "failure" && (
                                  <span className="w-2 h-2 rounded-full bg-red-500 ring-1 ring-white shadow-sm" title="失敗" />
                                )}
                                {isHighlighted && (
                                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-600 ring-1 ring-white" title="表示中" />
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="w-full px-3 py-6 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-400 italic text-center">
                        サンプルがありません。
                      </div>
                    )}
                  </div>
                </div>

              <div className="mt-4">
                {/* Custom Instruction section removed as requested */}
              </div>

              <div className="flex flex-col md:flex-row gap-4 items-end pt-2">
                <div className="flex flex-col gap-1 w-full md:w-auto flex-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">AI Model</label>
                  <select
                    value={modelSelection}
                    onChange={(e) => setModelSelection(e.target.value)}
                    className={`w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-slate-50 min-w-[220px] h-[38px] ${visualCap.recommendation === 'experimental' ? 'border-amber-300 ring-1 ring-amber-100' : ''}`}
                  >
                    <option value="gemini-3.5-flash|native_schema">⭐️ ⚡️ Gemini 3.5 Flash</option>
                    <option value="gemini-3.5-flash|prompt_only">⭐️ 📝 Gemini 3.5 Flash</option>
                    <option value="gemini-flash-latest|native_schema">⚡️ Gemini Flash Latest</option>
                    <option value="gemini-flash-latest|prompt_only">📝 Gemini Flash Latest</option>
                    <option value="gemini-3.1-flash-lite|native_schema">⭐️ ⚡️ Gemini 3.1 Flash Lite</option>
                    <option value="gemini-3.1-flash-lite|prompt_only">⭐️ 📝 Gemini 3.1 Flash Lite</option>
                    <option value="gemini-1.5-pro|native_schema">🧪 ⚡️ Gemini 1.5 Pro</option>
                    <option value="gemini-1.5-pro|prompt_only">🧪 📝 Gemini 1.5 Pro</option>
                    <option value="gemma-4-31b-it|prompt_only">⚠️ 📝 Gemma 4 31B IT</option>
                    <option value="gemma-4-26b-a4b-it|prompt_only">⚠️ 📝 Gemma 4 26B</option>
                  </select>
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 px-1 mt-1 text-[10px] text-slate-500 font-medium">
                    <span className="flex items-center gap-0.5">⭐️推奨</span>
                    <span className="flex items-center gap-0.5">🧪実験的</span>
                    <span className="flex items-center gap-0.5">⚠️非推奨</span>
                    <span className="w-px h-3 bg-slate-300 mx-0.5"></span>
                    <span className="flex items-center gap-0.5">⚡️Native</span>
                    <span className="flex items-center gap-0.5">📝Prompt</span>
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4">
                  <div className="flex items-center gap-1.5 h-auto sm:h-[38px] py-1 sm:py-0 px-2 relative">
                    <label className="flex items-center gap-2 cursor-pointer group whitespace-nowrap">
                      <input 
                        type="checkbox" 
                        checked={includePreview} 
                        onChange={(e) => setIncludePreview(e.target.checked)}
                        className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                      />
                      <span className="text-[11px] text-slate-600 group-hover:text-slate-900 transition-colors">
                        リクエストプレビュー
                      </span>
                    </label>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setShowPreviewHelp(!showPreviewHelp);
                      }}
                      className="text-slate-400 hover:text-slate-600 focus:outline-none p-0.5 rounded-full hover:bg-slate-100 transition-colors flex items-center justify-center"
                      title="ヘルプを表示"
                    >
                      <HelpCircle className="w-3.5 h-3.5" />
                    </button>

                    {showPreviewHelp && (
                      <div className="absolute top-full left-0 sm:right-0 sm:left-auto mt-1.5 w-64 bg-slate-800 text-white text-[11px] p-3 rounded-lg shadow-xl z-[99] leading-relaxed border border-slate-700 animate-in fade-in slide-in-from-top-1 duration-150">
                        <div className="flex justify-between items-start mb-1 font-bold text-slate-200">
                          <span>リクエストプレビューとは</span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setShowPreviewHelp(false);
                            }}
                            className="text-[10px] text-slate-400 hover:text-white font-semibold underline"
                          >
                            閉じる
                          </button>
                        </div>
                        <p className="text-slate-300">
                          有効にすると、モデルに送信されたシステム指示（System Instruction）やタスクプロンプトなどのAPIリクエスト詳細を、解析結果と一緒に取得し、デバッグプレビュー（Debug: Request Preview）で確認できるようになります。
                        </p>
                      </div>
                    )}
                  </div>
                </div>
                {experimentViewTab === "client" && (
                  <div className="flex flex-col md:flex-row gap-2 w-full md:w-auto mt-4 md:mt-0">
                    <div className="text-[10px] text-slate-500 flex items-center mr-3 mt-1 md:mt-0">
                      <strong>Run Selected (Stable)</strong>: Browser-driven, uses localStorage checkpoint
                    </div>
                    <button
                      onClick={() => handleRunBatch()}
                      disabled={isBatchRunning || samples.length === 0 || loading}
                      className="px-6 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2 transition-colors h-[38px] flex-1 md:flex-none justify-center whitespace-nowrap shadow-sm animate-in fade-in zoom-in-95 duration-150"
                    >
                      {isBatchRunning ? (
                        <>
                          <Activity className="w-4 h-4 animate-pulse" /> 解析中 ({batchProgress?.current}/{batchProgress?.total})
                        </>
                      ) : (
                        <>
                          <Activity className="w-4 h-4" /> 選択サンプルの解析実行 (Run Selected)
                        </>
                      )}
                    </button>
                  </div>
                )}
      </div>
      </div>
      </div>
      </div>
      </div>


      {/* Server-Side Job */}
      {experimentViewTab === "server" && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3 mb-4">
            <Terminal className="w-5 h-5 text-purple-500" />
            <span className="font-bold text-slate-800 text-base">Server-Side Batch Job (Experimental)</span>
            <span className="px-2 py-0.5 rounded text-[10px] font-black bg-purple-100 text-purple-800 uppercase">Beta</span>
          </div>
          
          <div className="space-y-4">
            <p className="text-xs text-slate-500">
              Starts an experimental batch job on the Node.js server. Unlike the client-side <strong>Run Selected</strong> button (stable), 
              this job will continue running even if you close the browser tab. 
              Currently, jobs are stored in local disk cache and are not guaranteed to be durable in production.
            </p>
            
            <div className="flex items-center gap-2">
              <button
                onClick={handleStartServerJob}
                disabled={isStartingServerJob || (serverJobStatus && ['queued', 'running', 'canceling'].includes(serverJobStatus.status))}
                className="px-4 py-2 bg-purple-600 text-white rounded text-xs font-bold hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {serverJobStatus && ['queued', 'running', 'canceling'].includes(serverJobStatus.status)
                  ? '既存のジョブを実行中...'
                  : isStartingServerJob
                  ? 'Starting...'
                  : 'Start Server-Side Job'}
              </button>
              
              <div className="flex-1 max-w-xs flex items-center gap-2 ml-4">
                <input 
                  type="text" 
                  value={serverJobId}
                  onChange={(e) => setServerJobId(e.target.value)}
                  placeholder="Enter Job ID"
                  className="w-full text-xs p-1.5 border rounded"
                />
                <button
                  onClick={handleRefreshServerJob}
                  disabled={!serverJobId}
                  className="px-3 py-1.5 bg-slate-100 text-slate-700 rounded text-xs font-bold hover:bg-slate-200 disabled:opacity-50"
                >
                  Refresh
                </button>
              </div>
            </div>
            
            {serverJobStatus && (
              <div className="bg-slate-50 border rounded p-3 text-xs space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <strong>Status:</strong> <span className={serverJobStatus.status === 'running' ? 'text-indigo-600 font-bold' : serverJobStatus.status === 'canceling' ? 'text-amber-600 font-bold' : serverJobStatus.status === 'canceled' ? 'text-slate-500 font-bold' : ''}>
                      {serverJobComputedState?.displayStatus === 'interrupted' ? 'interrupted (server restarted)' : serverJobComputedState?.displayStatus === 'cancelStuck' ? 'cancelStuck (canceling)' : serverJobStatus.status}
                    </span>
                  </div>
                  {['queued', 'running'].includes(serverJobStatus.status) && (
                    <div>
                      <button onClick={handleCancelServerJob} className="text-red-600 hover:text-red-800 font-bold px-2 py-1 bg-red-50 rounded border border-red-200 shadow-sm">Cancel Job</button>
                      <div className="text-[10px] text-slate-400 mt-1 max-w-[200px]">
                        Cancel は cooperative cancel です。現在処理中の1件はすぐには止まらない場合がありますが、次の sample には進みません。
                      </div>
                    </div>
                  )}
                  {(serverJobComputedState?.displayStatus === 'cancelStuck' || serverJobComputedState?.displayStatus === 'interrupted') && (
                    <div className="text-right">
                      <button onClick={handleForceCancelServerJob} className="text-red-700 hover:text-white hover:bg-red-700 font-bold px-2 py-1 bg-red-100 rounded border border-red-300 shadow-sm transition-colors">Force Cancel</button>
                    </div>
                  )}
                </div>
                {serverJobComputedState?.displayStatus === 'cancelStuck' && (
                    <div className="p-2 bg-amber-50 text-amber-800 text-[10px] rounded border border-amber-200">
                      キャンセル要求後、現在処理中の sample が長時間終了していません。
                      provider API 呼び出し待ち、ネットワーク停止、または runner 停止の可能性があります。
                      この job は次の sample には進まないはずですが、必要なら強制的に canceled としてマークできます。
                    </div>
                )}
                {serverJobComputedState?.displayStatus === 'interrupted' && (
                    <div className="p-2 bg-rose-50 text-rose-800 text-[10px] rounded border border-rose-200">
                      サーバーが再起動されたため、このジョブを実行していたバックグラウンドプロセスは既に失われています。(interrupted)
                      Force Cancel を押してジョブを終了させてください。
                    </div>
                )}
                <div><strong>Progress:</strong> {(serverJobStatus.counters?.successCount || 0) + (serverJobStatus.counters?.failureCount || 0)} / {serverJobStatus.counters?.total || 0}</div>
                <div><strong>Current Sample:</strong> {serverJobStatus.currentSampleTitle || serverJobStatus.currentSampleId || '-'}</div>
                {serverJobStatus.startedAt && <div><strong>Elapsed Time:</strong> {serverJobStatus.durationMs ? `${(serverJobStatus.durationMs / 1000).toFixed(1)}s` : `${((new Date().getTime() - new Date(serverJobStatus.startedAt).getTime()) / 1000).toFixed(1)}s`}</div>}
                <div><strong>Last Event:</strong> {serverJobStatus.lastEvent?.message || '-'}</div>
                <div><strong>Last Heartbeat:</strong> {serverJobStatus.lastHeartbeatAt ? new Date(serverJobStatus.lastHeartbeatAt).toLocaleTimeString() : '-'}</div>
                
                {serverJobItemsPreview && serverJobItemsPreview.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-slate-200">
                    <strong className="text-[10px] text-slate-500 uppercase">Recent Items:</strong>
                    <div className="flex flex-col gap-1 mt-1">
                      {serverJobItemsPreview.map((item: any, idx: number) => (
                        <div key={item.sampleId || idx} className="flex items-center justify-between bg-white p-1 rounded border border-slate-100">
                          <span className="truncate max-w-[200px]" title={item.title}>{item.title}</span>
                          <span className={`text-[9px] font-bold px-1.5 rounded ${item.status === 'success' ? 'bg-emerald-100 text-emerald-800' : item.status === 'failure' ? 'bg-rose-100 text-rose-800' : 'bg-slate-100 text-slate-600'}`}>
                            {item.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <div className="flex gap-2 pt-2 mt-2 border-t border-slate-200">
                  <a href={`/api/visual/batch-jobs/${serverJobStatus.jobId}/reports/full`} target="_blank" className="text-indigo-600 hover:underline">Full JSON</a>
                  <a href={`/api/visual/batch-jobs/${serverJobStatus.jobId}/reports/summary`} target="_blank" className="text-indigo-600 hover:underline">Summary</a>
                  <a href={`/api/visual/batch-jobs/${serverJobStatus.jobId}/reports/diagnostic`} target="_blank" className="text-indigo-600 hover:underline">Diagnostic</a>
                  <a href={`/api/visual/batch-jobs/${serverJobStatus.jobId}/reports/failures`} target="_blank" className="text-indigo-600 hover:underline">Failures</a>
                  {serverJobStatus.status === 'completed' && (
                    <button onClick={handleImportServerJob} className="ml-auto px-2 py-1 bg-emerald-100 text-emerald-800 rounded font-bold hover:bg-emerald-200">
                      Import to Batch Summary
                    </button>
                  )}
                </div>
              </div>
            )}
            
            {serverJobList.length > 0 && !serverJobStatus && (
              <div className="pt-2 border-t border-slate-100">
                <h4 className="text-xs font-bold text-slate-700 mb-2">Recent Server Jobs</h4>
                <div className="space-y-1 max-h-32 overflow-y-auto">
                  {serverJobList.slice().reverse().map((job, i) => (
                    <button 
                      key={job.jobId + "-" + i}
                      onClick={() => {
                        setServerJobId(job.jobId);
                        setServerJobStatus(job);
                      }}
                      className="w-full text-left text-xs p-2 rounded hover:bg-slate-50 border border-transparent hover:border-slate-200 flex justify-between"
                    >
                      <span>{new Date(job.createdAt).toLocaleString()}</span>
                      <span className={`font-medium ${job.status === 'completed' ? 'text-emerald-600' : job.status === 'failed' ? 'text-red-600' : job.status === 'running' ? 'text-indigo-600 font-bold' : 'text-slate-500'}`}>
                        {job.status} ({job.counters?.successCount}/{job.counters?.total})
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {healthCheckFailed && healthCheckDiagnostics && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 space-y-4 mb-6">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-red-100 text-red-600 rounded-full shrink-0">
              <AlertCircle className="w-6 h-6" />
            </div>
            <div className="space-y-1 w-full">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-red-900">Pre-batch Health Check Failed</h3>
                <button
                  onClick={() => handleCopy(JSON.stringify(healthCheckDiagnostics, null, 2), 'healthcheck-error')}
                  className="text-xs font-bold text-red-600 hover:text-red-700 flex items-center gap-1 bg-red-100/50 px-3 py-1.5 rounded"
                >
                  {copied === 'healthcheck-error' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  {copied === 'healthcheck-error' ? "Copied!" : "Copy Diagnostics"}
                </button>
              </div>
              <p className="text-sm text-red-700 leading-relaxed mt-1">
                Before initiating a batch analysis, a quick health check is performed on <code className="bg-red-100 px-1 py-0.5 rounded font-mono">GET /api/visual/health</code>.
                The response was not a valid JSON indicating ok, indicating a backend connectivity or static hosting route issue.
              </p>
              {healthCheckDiagnostics.isTransientStartupHtml ? (
                <p className="text-xs text-red-600 italic font-medium mt-1">
                  The backend server is warming up or restarting ("Starting Server..." HTML). The retry attempts were exhausted.
                </p>
              ) : (
                <p className="text-xs text-red-600 italic font-medium mt-1">
                  This usually means "/api/..." is being served by the frontend/static fallback instead of the API server.
                </p>
              )}
              
              <div className="mt-4 space-y-3">
                <div className="p-3 bg-red-100/50 rounded-lg">
                  <span className="block text-[10px] text-red-500 font-bold uppercase mb-1">Raw Error</span>
                  <span className="font-mono text-xs text-red-900 break-all">{(healthCheckDiagnostics as any).error || String(healthCheckDiagnostics)}</span>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                   <div className="p-2 bg-white rounded border border-red-100">
                      <span className="block text-[10px] text-red-400 mb-0.5 font-bold uppercase">Content Type</span>
                      <span className="font-bold text-xs text-red-800 truncate block" title={healthCheckDiagnostics.contentType}>{healthCheckDiagnostics.contentType || "N/A"}</span>
                   </div>
                   <div className="p-2 bg-white rounded border border-red-100">
                      <span className="block text-[10px] text-red-400 mb-0.5 font-bold uppercase">Body Length</span>
                      <span className="font-bold text-xs text-red-800">{healthCheckDiagnostics.bodyLength} chars</span>
                   </div>
                   <div className="p-2 bg-white rounded border border-red-100">
                      <span className="block text-[10px] text-red-400 mb-0.5 font-bold uppercase">HTML Title</span>
                      <span className="font-bold text-xs text-red-800 truncate block" title={healthCheckDiagnostics.htmlTitle}>{healthCheckDiagnostics.htmlTitle || "None Detected"}</span>
                   </div>
                </div>

                <div className="p-2 bg-white rounded border border-red-100">
                   <span className="block text-[10px] text-red-400 mb-0.5 font-bold uppercase">Request URL</span>
                   <span className="font-mono text-xs text-slate-600 break-all">{healthCheckDiagnostics.url}</span>
                </div>

                {healthCheckDiagnostics.bodyPreview && (
                  <details className="text-xs bg-white rounded border border-red-100 group mt-2" open>
                    <summary className="px-3 py-2 font-bold text-red-800 cursor-pointer hover:bg-red-50 transition-colors flex items-center justify-between select-none">
                      <span>Response Body Preview (Max 4000 chars)</span>
                      <span className="text-red-400 group-open:rotate-180 transition-transform">▼</span>
                    </summary>
                    <div className="p-3 border-t border-red-100 bg-slate-50 font-mono text-[10px] whitespace-pre-wrap text-slate-700 overflow-x-auto max-h-96 overflow-y-auto">
                      {healthCheckDiagnostics.bodyPreview}
                    </div>
                  </details>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {batchSummary && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-4">
          <div className="flex flex-col gap-2 border-b border-slate-100 pb-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <Activity className="w-4 h-4 text-indigo-600" /> Batch Regression Summary
              </h3>
              <button
                type="button"
                onClick={() => setShowBatchArtifactHelp(true)}
                className="text-slate-400 hover:text-indigo-600 p-1.5 rounded-lg hover:bg-slate-50 transition-colors flex items-center gap-1 text-xs font-medium"
                aria-label="JSON出力の説明を表示"
                title="JSON出力の説明"
              >
                <HelpCircle className="w-4 h-4" />
                <span className="hidden sm:inline">JSON出力について</span>
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-2">
              {/* 1. ChatGPT Summary Report */}
              <div className="p-3 rounded-lg border border-emerald-100 bg-emerald-50/30 flex flex-col justify-between space-y-2">
                <div>
                  <div className="flex items-center gap-1.5 justify-between">
                    <div className="text-[11px] font-bold text-emerald-900">ChatGPT Summary</div>
                    <span className="text-[8.5px] bg-emerald-100 text-emerald-800 px-1 rounded font-black uppercase">Copy Recommended</span>
                  </div>
                  <p className="text-[9px] text-slate-500 mt-0.5 leading-tight">Minimalist, ultra-compact text representation. High-speed copy, targeted &lt;50KB.</p>
                  {chatSummaryReportStats && (
                    <div className="text-[9px] font-mono text-emerald-700/80 mt-1">
                      Size: {chatSummaryReportStats.byteLength} bytes ({chatSummaryReportStats.charLength} chars) | Hash: {chatSummaryReportStats.hash}
                    </div>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleCopy(chatSummaryReportStats?.text || "", 'batch-report-summary')}
                    className="text-[10px] font-bold text-emerald-700 hover:text-emerald-800 flex items-center justify-center gap-1 bg-white hover:bg-emerald-50 px-2 py-1.5 rounded border border-emerald-200 shadow-sm flex-1"
                  >
                    {copied === 'batch-report-summary' ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                    {copied === 'batch-report-summary' ? "Copied" : "Copy Report"}
                  </button>
                  <button
                    onClick={() => handleDownload(chatSummaryReport, `visual-analysis-summary-${Date.now()}.json`, 'batch-report-summary-dl')}
                    className="text-[10px] font-bold text-emerald-700 hover:text-emerald-850 flex items-center justify-center gap-1 bg-white hover:bg-emerald-50 px-2 py-1.5 rounded border border-emerald-200 shadow-sm"
                    title="Download as JSON file"
                  >
                    {copied === 'batch-report-summary-dl' ? <Check className="w-3 h-3" /> : <Download className="w-3 h-3" />}
                  </button>
                </div>
              </div>

              {/* 2. ChatGPT Diagnostic Report */}
              <div className="p-3 rounded-lg border border-indigo-100 bg-indigo-50/50 flex flex-col justify-between space-y-2">
                <div>
                  <div className="flex items-center gap-1.5 justify-between">
                    <div className="text-[11px] font-bold text-indigo-900">ChatGPT Diagnostic</div>
                    <span className="text-[8.5px] bg-indigo-100 text-indigo-800 px-1 rounded font-black uppercase">Copy Recommended</span>
                  </div>
                  <p className="text-[9px] text-slate-500 mt-0.5 leading-tight">Compact diagnostics (excludes success bodyPreviews). Target size: 50KB-100KB.</p>
                  {chatDiagnosticReportStats && (
                    <div className="text-[9px] font-mono text-indigo-700/80 mt-1">
                      Size: {chatDiagnosticReportStats.byteLength} bytes ({chatDiagnosticReportStats.charLength} chars) | Hash: {chatDiagnosticReportStats.hash}
                    </div>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleCopy(chatDiagnosticReportStats?.text || "", 'batch-report-diagnostic')}
                    className="text-[10px] font-bold text-indigo-600 hover:text-indigo-700 flex items-center justify-center gap-1 bg-white hover:bg-indigo-50 px-2 py-1.5 rounded border border-indigo-200 shadow-sm flex-1"
                  >
                    {copied === 'batch-report-diagnostic' ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                    {copied === 'batch-report-diagnostic' ? "Copied" : "Copy Report"}
                  </button>
                  <button
                    onClick={() => handleDownload(chatDiagnosticReport, `visual-analysis-diagnostic-${Date.now()}.json`, 'batch-report-diagnostic-dl')}
                    className="text-[10px] font-bold text-indigo-600 hover:text-indigo-700 flex items-center justify-center gap-1 bg-white hover:bg-indigo-50 px-2 py-1.5 rounded border border-indigo-200 shadow-sm"
                    title="Download as JSON file"
                  >
                    {copied === 'batch-report-diagnostic-dl' ? <Check className="w-3 h-3" /> : <Download className="w-3 h-3" />}
                  </button>
                </div>
              </div>

              {/* 3. Failures Only Section */}
              <div className="p-3 rounded-lg border border-red-100 bg-red-50/50 flex flex-col justify-between space-y-2">
                <div>
                  <div className="flex items-center gap-1.5 justify-between">
                    <div className="text-[11px] font-bold text-red-900">Failures Only JSON</div>
                    <span className="text-[8.5px] bg-red-100 text-red-800 px-1 rounded font-black uppercase">Copy Recommended</span>
                  </div>
                  <p className="text-[9px] text-slate-500 mt-0.5 leading-tight">Only contains samples that failed generation, schemas or validation checks.</p>
                  {failuresReportStats && (
                    <div className="text-[9px] font-mono text-red-700/80 mt-1">
                      Size: {failuresReportStats.byteLength} bytes ({failuresReportStats.charLength} chars) | Hash: {failuresReportStats.hash}
                    </div>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleCopy(failuresReportStats?.text || "", 'batch-report-failures')}
                    className="text-[10px] font-bold text-red-600 hover:text-red-700 flex items-center justify-center gap-1 bg-white hover:bg-red-50 px-2 py-1.5 rounded border border-red-200 shadow-sm flex-1"
                  >
                    {copied === 'batch-report-failures' ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                    {copied === 'batch-report-failures' ? "Copied" : "Copy"}
                  </button>
                  <button
                    onClick={() => handleDownload(failuresReport, `visual-analysis-failures-${Date.now()}.json`, 'batch-report-failures-dl')}
                    className="text-[10px] font-bold text-red-600 hover:text-red-700 flex items-center justify-center gap-1 bg-white hover:bg-red-50 px-2 py-1.5 rounded border border-red-200 shadow-sm"
                    title="Download as JSON file"
                  >
                    {copied === 'batch-report-failures-dl' ? <Check className="w-3 h-3" /> : <Download className="w-3 h-3" />}
                  </button>
                </div>
              </div>

              {/* 4. Full Batch Section (Download recommended) */}
              <div className="p-3 rounded-lg border border-slate-200 bg-slate-50 flex flex-col justify-between space-y-2">
                <div>
                  <div className="flex items-center gap-1.5 justify-between">
                    <div className="text-[11px] font-bold text-slate-900">Full Batch JSON</div>
                    <span className="text-[8.5px] bg-slate-200 text-slate-800 px-1 rounded font-black uppercase">Download Recommended</span>
                  </div>
                  <p className="text-[9px] text-slate-500 mt-0.5 leading-tight">Full raw output, complete execution runs, and raw responses.</p>
                  {fullReportStats && (
                    <div className="text-[9px] font-mono text-slate-600 mt-1">
                      Size: {fullReportStats.byteLength} bytes ({fullReportStats.charLength} chars) | Hash: {fullReportStats.hash}
                    </div>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleDownload(batchSummary, `visual-analysis-full-batch-${Date.now()}.json`, 'batch-summary-full-dl')}
                    className="text-[10px] font-bold text-white bg-indigo-600 hover:bg-indigo-700 flex items-center justify-center gap-1 px-2 py-1.5 rounded shadow-sm flex-1"
                    title="Download complete payload directly"
                  >
                    {copied === 'batch-summary-full-dl' ? <Check className="w-3 h-3" /> : <Download className="w-3 h-3" />}
                    {copied === 'batch-summary-full-dl' ? "Downloaded" : "Download Full JSON"}
                  </button>
                  <button
                    onClick={() => handleCopy(fullReportStats?.text || "", 'batch-summary-full')}
                    className="text-[10px] font-bold text-slate-600 hover:text-slate-700 flex items-center justify-center gap-1 bg-white hover:bg-slate-100 px-2.5 py-1.5 rounded border border-slate-200 shadow-sm"
                    title="Copy raw string (May freeze if too large)"
                  >
                    {copied === 'batch-summary-full' ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                  </button>
                </div>
              </div>
            </div>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-[11px]">
             <div className="p-3 bg-slate-50 rounded border border-slate-100">
                <span className="block text-slate-400 mb-1">Total Run</span>
                <span className="font-bold text-lg text-slate-700">{batchSummary.total}</span>
             </div>
             <div className="p-3 bg-emerald-50 rounded border border-emerald-100">
                <span className="block text-emerald-600 mb-1">Success / Valid</span>
                <span className="font-bold text-lg text-emerald-700">{batchSummary.successCount} / {batchSummary.validCount}</span>
             </div>
             <div className="p-3 bg-red-50 rounded border border-red-100">
                <span className="block text-red-600 mb-1">Failed / Invalid JSON</span>
                <span className="font-bold text-lg text-red-700">{batchSummary.failureCount} / {batchSummary.invalidJsonCount}</span>
             </div>
             <div className="p-3 bg-indigo-50 rounded border border-indigo-100">
                <span className="block text-indigo-600 mb-1">Comparison (Pass/Warn/Fail)</span>
                <span className="font-bold text-lg text-indigo-700">{batchSummary.expectedComparisonPassCount} / {batchSummary.expectedComparisonWarningCount} / {batchSummary.expectedComparisonFailCount}</span>
             </div>
             <div className="p-3 bg-violet-50 rounded border border-violet-100">
                <span className="block text-violet-600 mb-1">Review (Pass/Review/Fail)</span>
                <span className="font-bold text-lg text-violet-700">{batchSummary.reviewPassCount ?? 0} / {batchSummary.reviewNeedsReviewCount ?? 0} / {batchSummary.reviewFailCount ?? 0}</span>
             </div>
          </div>

          {/* Provider Quota & Rate Limit Summary */}
          {batchSummary && ((batchSummary.providerQuotaSummary && batchSummary.providerQuotaSummary.total > 0) || (batchSummary.rateLimitSummary && batchSummary.rateLimitSummary.total429 > 0)) && (
            <div className="p-3 rounded-lg border border-amber-200 bg-amber-50/50 space-y-2 mt-2">
              <h4 className="text-[11px] font-bold text-amber-900 flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                Provider Quota & Rate-Limit Diagnostics
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-[10px] text-slate-700">
                {batchSummary.providerQuotaSummary && batchSummary.providerQuotaSummary.total > 0 && (
                  <div className="space-y-1">
                    <span className="font-bold text-amber-800">Model Quota Failures ({batchSummary.providerQuotaSummary.total})</span>
                    <ul className="list-disc pl-4 space-y-0.5 text-slate-600">
                      <li>Total attempts across failures: {batchSummary.providerQuotaSummary.totalAttempts}</li>
                      {Object.entries(batchSummary.providerQuotaSummary.byProviderStatus || {}).map(([status, count]: [string, any]) => (
                        <li key={status}>Status "{status}": {count} event(s)</li>
                      ))}
                      {Object.entries(batchSummary.providerQuotaSummary.byModelName || {}).map(([model, count]: [string, any]) => (
                        <li key={model}>Model "{model}": {count} event(s)</li>
                      ))}
                    </ul>
                  </div>
                )}
                {batchSummary.rateLimitSummary && batchSummary.rateLimitSummary.total429 > 0 && (
                  <div className="space-y-1">
                    <span className="font-bold text-red-800">Transport-level 429 Rate Limits ({batchSummary.rateLimitSummary.total429})</span>
                    <ul className="list-disc pl-4 space-y-0.5 text-slate-600">
                      <li>Total attempts: {batchSummary.rateLimitSummary.totalAttempts}</li>
                    </ul>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Comparative Baseline Engine UI */}
          {pastBatchRuns.length > 0 && (
            <div className="p-4 rounded-xl border border-indigo-100 bg-indigo-50/20 space-y-3 mt-2">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                    <Activity className="w-3.5 h-3.5 text-indigo-600" />
                    Comparative Baseline Engine
                  </h4>
                  <p className="text-[10px] text-slate-500">
                    Compare runs side-by-side to analyze Native Schema vs Prompted JSON performance.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleDownloadComparison}
                  disabled={!compareRunAId}
                  className="text-[10px] font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 disabled:cursor-not-allowed flex items-center justify-center gap-1 px-3 py-1.5 rounded shadow-sm self-start sm:self-center transition-colors"
                >
                  <Download className="w-3 h-3" />
                  Download Comparison JSON
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Baseline Run A</label>
                  <select
                    value={compareRunAId}
                    onChange={(e) => setCompareRunAId(e.target.value)}
                    className="w-full text-[11px] font-medium bg-white border border-slate-200 rounded px-2 py-1.5 text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  >
                    <option value="">Select Baseline Run A</option>
                    {pastBatchRuns.map((r, i) => (
                      <option key={r.runId ? r.runId + "-" + i : i} value={r.runId}>
                        #{i + 1} - {r.modelName} ({r.jsonMode}) - {r.successCount}/{r.total} - {new Date(r.timestamp).toLocaleTimeString()}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Comparison Run B (Optional)</label>
                  <select
                    value={compareRunBId}
                    onChange={(e) => setCompareRunBId(e.target.value)}
                    className="w-full text-[11px] font-medium bg-white border border-slate-200 rounded px-2 py-1.5 text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  >
                    <option value="">None (Single Run Inspection)</option>
                    {pastBatchRuns.map((r, i) => (
                      <option key={r.runId ? r.runId + "-" + i : i} value={r.runId}>
                        #{i + 1} - {r.modelName} ({r.jsonMode}) - {r.successCount}/{r.total} - {new Date(r.timestamp).toLocaleTimeString()}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )}

          <div className="overflow-x-auto border border-slate-200 rounded-lg">
            <table className="w-full text-[10px] text-left">
               <thead className="bg-slate-50 text-slate-500 uppercase border-b border-slate-200">
                  <tr>
                     <th className="px-3 py-2 font-semibold">Sample</th>
                     <th className="px-3 py-2 font-semibold">Quality Status</th>
                     <th className="px-3 py-2 font-semibold">Image Kind</th>
                     <th className="px-3 py-2 font-semibold">Expected Comparison</th>
                     <th className="px-3 py-2 font-semibold">Review Status</th>
                     <th className="px-3 py-2 font-semibold text-right">Export</th>
                  </tr>
               </thead>
               <tbody className="divide-y divide-slate-100">
                  {batchSummary.items.map((item, idx) => (
                    <tr key={idx} className={item.success ? "hover:bg-slate-50" : "bg-red-50 hover:bg-red-100/50"}>
                      <td className="px-3 py-2 font-semibold text-slate-700" title={item.sampleId}>
                        {item.title}
                        {!item.success && (
                          <div className="mt-1 space-y-1 font-sans">
                            <span className="block font-normal text-red-600 mt-0.5">{item.error || 'Failed'}</span>
                            {item.generationDiagnostics && (
                              <div className="bg-white rounded border border-amber-200 p-2 text-[9px] space-y-1 font-sans mt-1">
                                <div className="font-bold text-amber-800">
                                  [{item.failureKind}] Model: {item.generationDiagnostics.modelName} | Code: {item.generationDiagnostics.statusCode || "N/A"} ({item.generationDiagnostics.providerStatus || "N/A"})
                                </div>
                                {item.generationDiagnostics.providerFailureKind && (
                                  <div className="text-amber-700 font-medium font-mono">
                                    Provider Failure Class: {item.generationDiagnostics.providerFailureKind}
                                  </div>
                                )}
                                {item.generationDiagnostics.retryAfterMs !== undefined && (
                                  <div className="text-indigo-600 font-semibold font-mono">
                                    Retry-After: {item.generationDiagnostics.retryAfterMs}ms (Reason: {item.generationDiagnostics.retryAfterReason || "N/A"})
                                  </div>
                                )}
                                {item.generationDiagnostics.attempts && item.generationDiagnostics.attempts.length > 0 && (
                                  <div className="text-slate-500 font-sans mt-1">
                                    <span className="font-semibold block text-slate-700">Generation Attempts ({item.generationDiagnostics.attempts.length}):</span>
                                    <ul className="list-disc list-inside pl-1 text-[8px] space-y-0.5 mt-0.5">
                                      {item.generationDiagnostics.attempts.map((att: any, aIdx: number) => (
                                        <li key={aIdx} className="font-mono text-slate-600">
                                          # {att.attempt} Model: {att.modelName} | Status: {att.statusCode} ({att.providerStatus || "N/A"}) | Kind: {att.providerFailureKind || "N/A"} {att.delayMs ? `| Backoff: ${Math.round(att.delayMs)}ms` : ""} {att.retryAfterMs ? `| Retry-After: ${att.retryAfterMs}ms` : ""}
                                        </li>
                                      ))}
                                    </ul>
                                  </div>
                                )}
                              </div>
                            )}
                            {item.responseDiagnostics && (
                              <div className="bg-white rounded border border-red-200 p-2 text-[9px] space-y-1 font-sans mt-1">
                                <div className="font-bold text-red-800">
                                  [{item.failureKind}] Status: {item.responseDiagnostics.status} ({item.responseDiagnostics.statusText || "N/A"}) | Content-Type: {item.responseDiagnostics.contentType}
                                </div>
                                {item.responseDiagnostics.htmlTitle && (
                                  <div className="text-slate-600 font-medium">
                                    HTML Title: <span className="font-mono bg-slate-100 px-1 py-0.5 rounded">{item.responseDiagnostics.htmlTitle}</span>
                                  </div>
                                )}
                                <details className="mt-1 text-slate-500">
                                  <summary className="cursor-pointer hover:text-red-800 font-semibold select-none">Response Body Preview</summary>
                                  <div className="mt-1 p-2 bg-slate-50 rounded border border-slate-200 font-mono text-[9px] max-h-32 overflow-y-auto whitespace-pre-wrap text-slate-700">
                                    {item.responseDiagnostics.bodyPreview}
                                  </div>
                                </details>
                              </div>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2">
                         {item.success && (
                            <span className={`px-1.5 py-0.5 rounded ${item.qualityStatus === 'valid' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                               {item.qualityStatus}
                            </span>
                         )}
                      </td>
                      <td className="px-3 py-2">
                         {item.comparison?.imageKind && (
                            <span className={`font-mono ${item.comparison.imageKind.status === 'exact' ? 'text-emerald-600' : item.comparison.imageKind.status === 'acceptable' ? 'text-indigo-600' : 'text-red-600'}`}>
                               {item.comparison.imageKind.detected || 'missing'} 
                               {item.comparison.imageKind.status !== 'exact' && ` (exp: ${item.comparison.imageKind.expected})`}
                            </span>
                         )}
                      </td>
                      <td className="px-3 py-2">
                         {item.comparison && (
                            <span className={`px-1.5 py-0.5 rounded font-bold uppercase ${item.comparison.overallStatus === 'pass' ? 'text-emerald-600 bg-emerald-50' : item.comparison.overallStatus === 'warning' ? 'text-amber-600 bg-amber-50' : 'text-red-600 bg-red-50'}`}>
                               {item.comparison.overallStatus}
                            </span>
                         )}
                      </td>
                      <td className="px-3 py-2">
                         {item.comparison && (
                            <span className={`px-1.5 py-0.5 rounded font-bold uppercase ${item.comparison.reviewStatus === 'pass' ? 'text-emerald-600 bg-emerald-50' : item.comparison.reviewStatus === 'needsReview' ? 'text-indigo-600 bg-indigo-50' : 'text-red-600 bg-red-50'}`}>
                               {item.comparison.reviewStatus}
                            </span>
                         )}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleCopy(JSON.stringify(buildFullItemReport(item), null, 2), `item-${idx}`)}
                            className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-slate-100 rounded transition-colors"
                            title="Copy full item JSON"
                          >
                             {copied === `item-${idx}` ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                          </button>
                          <button
                            onClick={() => handleDownload(buildFullItemReport(item), `visual-analysis-sample-${item.sampleId}-${Date.now()}.json`, `item-dl-${idx}`)}
                            className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-slate-100 rounded transition-colors"
                            title="Download item JSON file"
                          >
                             {copied === `item-dl-${idx}` ? <Check className="w-3 h-3" /> : <Download className="w-3 h-3" />}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
               </tbody>
            </table>
          </div>
        </div>
      )}

      {result && !batchSummary && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-slate-100 pb-4 gap-4">
              {isDriveResult && (
                <div>
                  <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                    {result.metadata?.name}
                    <a
                      href={`https://drive.google.com/open?id=${result.metadata?.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-slate-400 hover:text-indigo-600"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  </h3>
                  <p className="text-[11px] text-slate-500 flex items-center gap-3">
                    <span>{result.metadata?.mimeType}</span>
                    <span>•</span>
                    <span>Size: {result.metadata?.size ? (result.metadata.size / 1024).toFixed(1) : "-"} KB</span>
                    {result.metadata?.modifiedTime && (
                      <>
                        <span>•</span>
                        <span>Modified: {new Date(result.metadata.modifiedTime).toLocaleString()}</span>
                      </>
                    )}
                  </p>
                </div>
              )}
              {isPublicResult && result.sampleMetadata && (
                <div>
                  <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                    {result.sampleMetadata.title}
                    {result.sampleMetadata.sourcePageUrl && (
                      <a
                        href={result.sampleMetadata.sourcePageUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-slate-400 hover:text-indigo-600"
                        title="View Source Page"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    )}
                  </h3>
                  <div className="flex flex-col gap-1 mt-1">
                    <p className="text-[11px] text-slate-500 flex items-center gap-3">
                      <span>Category: <span className="font-bold">{result.sampleMetadata.category}</span></span>
                      <span>•</span>
                      <span>License: {result.sampleMetadata.licenseName} ({result.sampleMetadata.licenseKind})</span>
                    </p>
                    {result.sampleMetadata.attributionText && (
                      <p className="text-[10px] text-slate-400 italic">
                        {result.sampleMetadata.attributionText}
                      </p>
                    )}
                  </div>
                </div>
              )}
              <div className="flex items-center gap-2">
                <span className={`px-2 py-1 text-[10px] font-bold uppercase rounded border flex items-center gap-1 ${result.success ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : 'bg-red-50 text-red-600 border-red-200'}`}>
                   {result.success ? <CheckCircle className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
                  Schema: {result.success ? "VALID" : "INVALID"}
                </span>
                <span className={`px-2 py-1 text-[10px] font-bold uppercase rounded border ${result.qualityStatus === 'validLowQuality' ? 'bg-amber-50 text-amber-600 border-amber-200' : result.qualityStatus === 'valid' ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : 'bg-red-50 text-red-600 border-red-200'}`}>
                  Quality: {result.qualityStatus}
                </span>
              </div>
            </div>

            {result.success === false && result.failureKind === "generationError" && (
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 space-y-4">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-orange-100 text-orange-600 rounded-full shrink-0">
                    <Activity className="w-5 h-5" />
                  </div>
                  <div className="space-y-1 w-full">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-bold text-orange-900">Execution Failure: Model Generation Failed</h3>
                      <button
                        onClick={() => handleCopy(JSON.stringify(result, null, 2), 'generation-error')}
                        className="text-[10px] font-bold text-orange-600 hover:text-orange-700 flex items-center gap-1 bg-orange-100/50 px-2 py-1 rounded"
                      >
                        {copied === 'generation-error' ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                        {copied === 'generation-error' ? "Copied!" : "Copy Details"}
                      </button>
                    </div>
                    <p className="text-xs text-orange-700 leading-relaxed">
                      The model API call failed before returning any content. This can be caused by quota limits, authentication errors, or provider outages.
                    </p>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-3">
                       <div className="p-2 bg-white rounded border border-orange-100">
                          <span className="block text-[10px] text-orange-400 mb-0.5">Status Code</span>
                          <span className="font-bold text-xs text-orange-800">{result.generationDiagnostics?.statusCode || "N/A"}</span>
                       </div>
                       <div className="p-2 bg-white rounded border border-orange-100">
                          <span className="block text-[10px] text-orange-400 mb-0.5">Provider Status</span>
                          <span className="font-bold text-xs text-orange-800">{result.generationDiagnostics?.providerStatus || "UNKNOWN"}</span>
                       </div>
                       <div className="p-2 bg-white rounded border border-orange-100">
                          <span className="block text-[10px] text-orange-400 mb-0.5">Retryable</span>
                          <span className="font-bold text-xs text-orange-800">{result.generationDiagnostics?.retryable ? "Yes" : "No"}</span>
                       </div>
                       <div className="p-2 bg-white rounded border border-orange-100">
                          <span className="block text-[10px] text-orange-400 mb-0.5">API Retry Count</span>
                          <span className="font-bold text-xs text-orange-800">{result.generationDiagnostics?.apiRetryCount ?? 0}</span>
                       </div>
                    </div>
                    {result.generationDiagnostics?.rawMessageSummary && (
                      <div className="mt-3">
                         <span className="block text-[10px] font-bold text-orange-800 mb-1">Raw Message Summary:</span>
                         <p className="text-xs text-orange-600 font-mono bg-white p-2 rounded border border-orange-100 break-words whitespace-pre-wrap">
                           {result.generationDiagnostics.rawMessageSummary}
                         </p>
                      </div>
                    )}
                    {result.generationDiagnostics?.attempts && result.generationDiagnostics.attempts.length > 0 && (
                      <div className="mt-4 border border-orange-200 rounded overflow-hidden">
                        <div className="bg-orange-100/50 px-3 py-2 text-[10px] font-bold text-orange-800 border-b border-orange-200">
                           Provider Call Attempts
                        </div>
                        <table className="w-full text-left text-[10px]">
                           <thead className="bg-orange-50 text-orange-500 uppercase">
                              <tr>
                                 <th className="px-3 py-2">Attempt</th>
                                 <th className="px-3 py-2">Model</th>
                                 <th className="px-3 py-2">Status</th>
                                 <th className="px-3 py-2">Message</th>
                              </tr>
                           </thead>
                           <tbody className="divide-y divide-orange-100 bg-white">
                              {result.generationDiagnostics.attempts.map((att: any, idx: number) => (
                                 <tr key={idx}>
                                    <td className="px-3 py-2 font-bold text-orange-700">{att.attempt}</td>
                                    <td className="px-3 py-2 text-orange-600">{att.modelName}</td>
                                    <td className="px-3 py-2 text-orange-600">{att.statusCode || "N/A"} {att.providerStatus ? `(${att.providerStatus})` : ''}</td>
                                    <td className="px-3 py-2 text-orange-500 truncate max-w-[150px]" title={att.errorMessageSummary}>{att.errorMessageSummary}</td>
                                 </tr>
                              ))}
                           </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {result.success === false && result.failureKind === "jsonParseError" && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 space-y-4">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-red-100 text-red-600 rounded-full shrink-0">
                    <AlertCircle className="w-5 h-5" />
                  </div>
                  <div className="space-y-1 w-full">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-bold text-red-900">Execution Failure: Invalid JSON</h3>
                      <button
                        onClick={() => handleCopy(JSON.stringify(result, null, 2), 'parse-error')}
                        className="text-[10px] font-bold text-red-600 hover:text-red-700 flex items-center gap-1 bg-red-100/50 px-2 py-1 rounded"
                      >
                        {copied === 'parse-error' ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                        {copied === 'parse-error' ? "Copied!" : "Copy Details"}
                      </button>
                    </div>
                    <p className="text-xs text-red-700 leading-relaxed">
                      The model returned output that could not be parsed as valid JSON.
                      This typically happens with prompted JSON models like Gemma when they fail to follow the schema strictly.
                    </p>
                    {result.parseDiagnostics?.parseErrorMessage && (
                      <p className="text-xs text-red-600 font-mono bg-red-100 p-2 rounded mt-2">
                        {result.parseDiagnostics.parseErrorMessage}
                      </p>
                    )}
                  </div>
                </div>

                {result.parseDiagnostics?.attempts && result.parseDiagnostics.attempts.length > 0 && (
                  <div className="bg-white rounded border border-red-100 overflow-hidden">
                    <div className="bg-red-100/50 px-3 py-2 text-[10px] font-bold text-red-800 border-b border-red-100">
                      Parse & Recovery Attempts ({result.analysisRun?.execution?.jsonRecovery?.retryCount ? `Retry Enabled, ${result.analysisRun.execution.jsonRecovery.retryCount} Retries` : 'No Retries'})
                    </div>
                    <div className="divide-y divide-red-50">
                      {result.parseDiagnostics.attempts.map((attempt: any, i: number) => (
                        <div key={i} className="px-3 py-2 flex items-center justify-between text-[11px]">
                          <span className="font-mono text-slate-600">{attempt.mode}</span>
                          <span className={`font-bold ${attempt.success ? 'text-emerald-600' : 'text-red-500'}`}>
                            {attempt.success ? 'Success' : 'Failed'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {result.parseDiagnostics?.rawOutputPreview && (
                  <details className="text-xs bg-white rounded border border-red-100 group">
                    <summary className="px-3 py-2 font-bold text-red-800 cursor-pointer hover:bg-red-50 transition-colors flex items-center justify-between select-none">
                      <span>Raw Output Preview ({result.parseDiagnostics.rawOutputLength} chars)</span>
                      <span className="text-red-400 group-open:rotate-180 transition-transform">▼</span>
                    </summary>
                    <div className="p-3 border-t border-red-100 bg-slate-50 font-mono text-[10px] whitespace-pre-wrap text-slate-700 overflow-x-auto">
                      {result.parseDiagnostics.rawOutputPreview}
                    </div>
                  </details>
                )}
              </div>
            )}

            {result.success === false && (result.failureKind === "nonJsonResponse" || result.failureKind === "invalidJsonResponse") && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 space-y-4">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-red-100 text-red-600 rounded-full shrink-0">
                    <AlertCircle className="w-5 h-5" />
                  </div>
                  <div className="space-y-1 w-full font-sans">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-bold text-red-900">
                        {result.failureKind === "nonJsonResponse" 
                          ? "Execution Failure: Non-JSON Response Received" 
                          : "Execution Failure: Invalid JSON Response Received"}
                      </h3>
                      <button
                        onClick={() => handleCopy(JSON.stringify(result, null, 2), 'non-json-error')}
                        className="text-[10px] font-bold text-red-600 hover:text-red-700 flex items-center gap-1 bg-red-100/50 px-2 py-1 rounded"
                      >
                        {copied === 'non-json-error' ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                        {copied === 'non-json-error' ? "Copied!" : "Copy Details"}
                      </button>
                    </div>
                    <p className="text-xs text-red-700 leading-relaxed mt-1">
                      {result.failureKind === "nonJsonResponse"
                        ? "The API returned a response that is not formatted as JSON. This usually means '/api/...' is being served by the frontend/static fallback instead of the API server."
                        : "The API returned a response that is supposed to be JSON, but cannot be parsed. This usually happens if the backend crashed mid-response, or returned an unexpected truncated stream."}
                    </p>
                    
                    {result.responseDiagnostics && (
                      <div className="mt-4 space-y-3">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                           <div className="p-2 bg-white rounded border border-red-100">
                              <span className="block text-[10px] text-red-400 mb-0.5 font-bold uppercase">HTTP Status</span>
                              <span className="font-bold text-xs text-red-800">{result.responseDiagnostics.status} ({result.responseDiagnostics.statusText || "N/A"})</span>
                           </div>
                           <div className="p-2 bg-white rounded border border-red-100">
                              <span className="block text-[10px] text-red-400 mb-0.5 font-bold uppercase">Content Type</span>
                              <span className="font-bold text-xs text-red-800 truncate block" title={result.responseDiagnostics.contentType}>{result.responseDiagnostics.contentType || "N/A"}</span>
                           </div>
                           <div className="p-2 bg-white rounded border border-red-100">
                              <span className="block text-[10px] text-red-400 mb-0.5 font-bold uppercase">Body Length</span>
                              <span className="font-bold text-xs text-red-800">{result.responseDiagnostics.bodyLength} chars</span>
                           </div>
                           <div className="p-2 bg-white rounded border border-red-100">
                              <span className="block text-[10px] text-red-400 mb-0.5 font-bold uppercase">HTML Title</span>
                              <span className="font-bold text-xs text-red-800 truncate block" title={result.responseDiagnostics.htmlTitle}>{result.responseDiagnostics.htmlTitle || "None Detected"}</span>
                           </div>
                        </div>

                        <div className="p-2 bg-white rounded border border-red-100">
                           <span className="block text-[10px] text-red-400 mb-0.5 font-bold uppercase">Request URL</span>
                           <span className="font-mono text-xs text-slate-600 break-all">{result.responseDiagnostics.url}</span>
                        </div>

                        {result.responseDiagnostics.parseErrorMessage && (
                          <div className="p-2 bg-white rounded border border-red-100">
                             <span className="block text-[10px] text-red-400 mb-0.5 font-bold uppercase">JSON Parse Error</span>
                             <span className="font-mono text-xs text-red-600">{result.responseDiagnostics.parseErrorMessage}</span>
                          </div>
                        )}

                        {result.responseDiagnostics.bodyPreview && (
                          <details className="text-xs bg-white rounded border border-red-100 group mt-2" open>
                            <summary className="px-3 py-2 font-bold text-red-800 cursor-pointer hover:bg-red-50 transition-colors flex items-center justify-between select-none">
                              <span>Response Body Preview (Max 4000 chars)</span>
                              <span className="text-red-400 group-open:rotate-180 transition-transform">▼</span>
                            </summary>
                            <div className="p-3 border-t border-red-100 bg-slate-50 font-mono text-[10px] whitespace-pre-wrap text-slate-700 overflow-x-auto max-h-96 overflow-y-auto">
                              {result.responseDiagnostics.bodyPreview}
                            </div>
                          </details>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            <div className="bg-slate-50 rounded-lg p-3 border border-slate-200 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <div className="flex flex-wrap items-center gap-4 text-[11px]">
                  <div className="flex items-center gap-1 text-slate-500">
                    <Activity className="w-3.5 h-3.5" />
                    <span>Model: <span className="font-bold text-slate-700">{result.analysisRun?.model?.name || result.usedModelName}</span></span>
                  </div>
                  <div className="flex items-center gap-1 text-slate-500">
                    <Check className="w-3.5 h-3.5" />
                    <span>Provider: <span className="font-bold text-slate-700">{result.analysisRun?.model?.providerFamily || result.providerFamily}</span></span>
                  </div>
                  <div className="flex items-center gap-1 text-slate-500">
                    <Info className="w-3.5 h-3.5" />
                    <span>Execution: <span className="font-bold text-slate-700">{result.analysisRun?.execution?.structuredExecutionMode || result.effectiveStructuredExecutionMode}</span></span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleCopy(JSON.stringify(result, null, 2), 'full')}
                    className="text-[11px] font-bold text-slate-500 hover:text-slate-700 flex items-center gap-1"
                  >
                    {copied === 'full' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    {copied === 'full' ? "Copied!" : "Copy Full Response"}
                  </button>
                  {result.visualAnalysis && (
                    <button
                      onClick={() => handleCopy(JSON.stringify(result.visualAnalysis, null, 2), 'all')}
                      className="text-[11px] font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
                    >
                      {copied === 'all' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      {copied === 'all' ? "Copied!" : "Copy Result JSON"}
                    </button>
                  )}
                </div>
              </div>
              
              {result.analysisRun && (
                <div className="border-t border-slate-200 pt-3 flex flex-wrap gap-x-6 gap-y-2 text-[10px] text-slate-500">
                   <div className="flex items-center gap-1">
                     <span className="font-semibold">Run ID:</span>
                     <span className="font-mono">{result.analysisRun.runId?.split('-')[0]}</span>
                   </div>
                   <div className="flex items-center gap-1">
                     <span className="font-semibold">Time:</span>
                     <span>{result.analysisRun.timestamp ? new Date(result.analysisRun.timestamp).toLocaleTimeString() : ''}</span>
                   </div>
                   <div className="flex items-center gap-1">
                     <span className="font-semibold">Schema:</span>
                     <span className="font-mono">{result.analysisRun.schema?.resultSchemaVersion}</span>
                   </div>
                   <div className="flex items-center gap-1">
                     <span className="font-semibold">Prompt:</span>
                     <span className="font-mono">{result.analysisRun.prompt?.visualPromptVersion}</span>
                   </div>
                   <div className="flex items-center gap-1">
                     <span className="font-semibold">Generation:</span>
                     <span>T={result.analysisRun.generationConfig?.temperature} / P={result.analysisRun.generationConfig?.topP} / K={result.analysisRun.generationConfig?.topK}</span>
                   </div>
                </div>
              )}
            </div>

            {isPublicResult && result.expectedMetadata && result.visualAnalysis && (
              <div className="bg-indigo-50/50 border border-indigo-100 p-4 rounded-xl space-y-4">
                <h4 className="text-xs font-bold text-indigo-900 uppercase tracking-wider flex items-center gap-2">
                  <Activity className="w-4 h-4 text-indigo-600" /> Expected vs Detected Schema Comparison
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs">
                  {/* Image Kind Comparison */}
                  <div className="bg-white p-3 rounded-lg border border-indigo-100/80 space-y-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Image Kind</span>
                    <div className="flex flex-col gap-1 mt-1">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500">Expected:</span>
                        <span className="font-mono font-semibold text-slate-700">{result.expectedMetadata.imageKind}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500">Detected:</span>
                        <span className={`font-mono font-semibold ${compareExpectedImageKind(result.expectedMetadata, result.visualAnalysis.visualInfo?.imageKind).status === 'exact' ? 'text-emerald-600' : (compareExpectedImageKind(result.expectedMetadata, result.visualAnalysis.visualInfo?.imageKind).status === 'acceptable' ? 'text-indigo-600' : 'text-amber-600')}`}>
                          {result.visualAnalysis.visualInfo?.imageKind || 'none'}
                        </span>
                      </div>
                      {(() => {
                        const status = compareExpectedImageKind(result.expectedMetadata, result.visualAnalysis.visualInfo?.imageKind).status;
                        if (status === 'exact') return <span className="text-[10px] text-emerald-600 font-bold flex items-center gap-1 mt-1"><CheckCircle className="w-3 h-3" /> Exact Match</span>;
                        if (status === 'acceptable') return <span className="text-[10px] text-indigo-600 font-bold flex items-center gap-1 mt-1"><CheckCircle className="w-3 h-3" /> Acceptable Match</span>;
                        return <span className="text-[10px] text-amber-500 font-bold flex items-center gap-1 mt-1"><AlertCircle className="w-3 h-3" /> Diverged</span>;
                      })()}
                    </div>
                  </div>

                  {/* Element Categories Comparison */}
                  <div className="bg-white p-3 rounded-lg border border-indigo-100/80 space-y-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Categories Coverage</span>
                    <div className="space-y-1.5 mt-1">
                      <div className="flex flex-wrap gap-1">
                        {(() => {
                          const detected = (result.visualAnalysis.visualInfo?.visibleElements || []).map((el: any) => el.category);
                          const comp = compareExpectedCategories(result.expectedMetadata, detected);
                          return (
                            <>
                              <span className="text-slate-400 block text-[10px] w-full mb-1">Status:</span>
                              {comp.exact.map(c => <span key={`ex-${c}`} className="px-1.5 py-0.5 rounded text-[9px] font-mono bg-emerald-50 text-emerald-700 border border-emerald-200" title="Exact match">{c} ✓</span>)}
                              {comp.acceptable.map(c => <span key={`ac-${c}`} className="px-1.5 py-0.5 rounded text-[9px] font-mono bg-indigo-50 text-indigo-700 border border-indigo-200" title="Acceptable alternative">{c} ~</span>)}
                              {comp.missing.map(c => <span key={`mi-${c}`} className="px-1.5 py-0.5 rounded text-[9px] font-mono bg-rose-50 text-rose-700 border border-rose-200" title="Missing expected category">{c} ✕</span>)}
                              {comp.extra.length > 0 && <span className="text-slate-400 block text-[10px] w-full mt-1 mb-1 border-t border-slate-100 pt-1">Additional Detected:</span>}
                              {comp.extra.map((c, i) => <span key={`xt-${i}`} className="px-1.5 py-0.5 rounded text-[9px] font-mono bg-slate-50 text-slate-500 border border-slate-200">{c}</span>)}
                            </>
                          );
                        })()}
                      </div>
                    </div>
                  </div>

                  {/* Visible Labels Comparison */}
                  <div className="bg-white p-3 rounded-lg border border-indigo-100/80 space-y-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Key Labels Match</span>
                    <div className="space-y-1.5 mt-1">
                      <div className="flex flex-wrap gap-1">
                        {(() => {
                          const labels = (result.visualAnalysis.visualInfo?.visibleElements || []).map((el: any) => el.label).filter(Boolean);
                          const attributes = (result.visualAnalysis.visualInfo?.visibleElements || []).flatMap((el: any) => el.attributes || []).filter(Boolean);
                          const keywords = (result.visualAnalysis.indexing?.keywords || []).map((kw: any) => typeof kw === 'string' ? kw : kw?.value || "").filter(Boolean);
                          const visibleText = (result.visualAnalysis.visualInfo?.visibleText || []).map((txt: any) => typeof txt === 'string' ? txt : txt?.text || "").filter(Boolean);
                          const comp = compareExpectedLabels(result.expectedMetadata, {
                            labels,
                            attributes,
                            keywords,
                            visibleText
                          });
                          if (!result.expectedMetadata.visibleElementLabels?.length) return <span className="text-slate-400 italic text-[10px]">No expected labels</span>;
                          return (
                            <>
                              {comp.exact.map(l => <span key={`ex-${l}`} className="px-1.5 py-0.5 rounded text-[9px] bg-emerald-50 text-emerald-700 border border-emerald-200" title="Exact match">{l} ✓</span>)}
                              {comp.acceptable.map(l => <span key={`ac-${l}`} className="px-1.5 py-0.5 rounded text-[9px] bg-indigo-50 text-indigo-700 border border-indigo-200" title="Acceptable alias match">{l} ~</span>)}
                              {comp.missing.map(l => <span key={`mi-${l}`} className="px-1.5 py-0.5 rounded text-[9px] bg-rose-50 text-rose-700 border border-rose-200" title="Missing expected label">{l} ✕</span>)}
                            </>
                          );
                        })()}
                      </div>
                    </div>
                  </div>
                  
                  {/* Expected Visible Text */}
                  {result.expectedMetadata.visibleText && result.expectedMetadata.visibleText.length > 0 && (
                    <div className="bg-white p-3 rounded-lg border border-indigo-100/80 space-y-1">
                      <span className="text-[10px] font-bold text-slate-400 uppercase">Visible Text Match</span>
                      <div className="space-y-1.5 mt-1">
                        <div className="flex flex-wrap gap-1">
                          {(() => {
                            const detected = (result.visualAnalysis.visualInfo?.visibleText || []).map((t: any) => t.text);
                            const comp = compareExpectedVisibleText(result.expectedMetadata, detected);
                            return (
                              <>
                                {comp.matched.map(t => <span key={`ex-${t}`} className="px-1.5 py-0.5 rounded text-[9px] bg-emerald-50 text-emerald-700 border border-emerald-200 font-mono" title="Matched text">"{t}" ✓</span>)}
                                {comp.missing.map(t => <span key={`mi-${t}`} className="px-1.5 py-0.5 rounded text-[9px] bg-rose-50 text-rose-700 border border-rose-200 font-mono" title="Missing expected text">"{t}" ✕</span>)}
                              </>
                            );
                          })()}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
                {result.expectedMetadata.notes && (
                  <div className="text-[10px] text-indigo-700/80 mt-2 bg-indigo-50/50 p-2 rounded flex gap-1.5 items-start">
                    <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                    <span>{result.expectedMetadata.notes}</span>
                  </div>
                )}
              </div>
            )}

            {result.qualityIssues && result.qualityIssues.length > 0 && (
              <div className="bg-amber-50 border border-amber-200 p-4 rounded-lg">
                <h4 className="text-xs font-bold text-amber-800 mb-2 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" /> 品質・バリデーション警告 (スコア: {result.qualityScore})
                </h4>
                <ul className="list-disc pl-5 text-xs text-amber-700 space-y-1">
                  {result.qualityIssues.map((iss: any, idx: number) => (
                    <li key={idx}>[{iss.severity.toUpperCase()}] {iss.message}</li>
                  ))}
                </ul>
              </div>
            )}

            {result.visualAnalysis && (
              result.schemaVersion === "custom" ? (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                  <div className="lg:col-span-4 space-y-6">
                    <div>
                      <h4 className="text-xs font-bold text-slate-500 uppercase mb-2">Image Preview</h4>
                      {isDriveResult && <ImagePreview fileId={result.metadata?.id} token={token} />}
                      {isPublicResult && <PublicSamplePreview sampleId={result.sampleMetadata?.id} />}
                    </div>
                  </div>
                  <div className="lg:col-span-8 space-y-6">
                    <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
                      <div className="flex items-center gap-2 text-emerald-800 font-bold text-xs">
                        <CheckCircle className="w-4 h-4" /> Custom Response Schema Recognized
                      </div>
                      <p className="text-[11px] text-emerald-700 mt-1 leading-relaxed">
                        モデルはユーザーのカスタムJSONスキーマ指示を認識し、そのフォーマットに沿ったデータを生成しました。バリデーションチェックをパスしました。
                      </p>
                    </div>

                    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                      <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-700">Custom Structured JSON Output</span>
                        <button
                          onClick={() => handleCopy(JSON.stringify(result.visualAnalysis, null, 2), 'custom-json')}
                          className="text-slate-400 hover:text-indigo-600 transition-colors"
                        >
                          {copied === 'custom-json' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                      <div className="p-4 bg-slate-950">
                        <pre className="text-xs text-slate-300 font-mono overflow-x-auto whitespace-pre-wrap leading-relaxed">
                          {JSON.stringify(result.visualAnalysis, null, 2)}
                        </pre>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                <div className="lg:col-span-4 space-y-6">
                  <div>
                    <h4 className="text-xs font-bold text-slate-500 uppercase mb-2">Image Preview</h4>
                    {isDriveResult && <ImagePreview fileId={result.metadata?.id} token={token} />}
                    {isPublicResult && <PublicSamplePreview sampleId={result.sampleMetadata?.id} />}
                  </div>

                  <div>
                    <h4 className="text-xs font-bold text-slate-500 uppercase mb-2">Caption & Description</h4>
                    <div className="bg-slate-50 rounded-lg p-3 text-sm relative group">
                      <button 
                        onClick={() => handleCopy(result.visualAnalysis.summary?.caption, 'caption')}
                        className="absolute right-2 top-2 p-1 text-slate-400 hover:text-indigo-600 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        {copied === 'caption' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                      <p className="font-bold text-slate-800 pr-6">{result.visualAnalysis.summary?.caption}</p>
                      <p className="text-slate-600 mt-2 text-xs leading-relaxed">{result.visualAnalysis.summary?.description}</p>
                    </div>
                  </div>

                  <div>
                    <h4 className="text-xs font-bold text-slate-500 uppercase mb-2 flex items-center gap-2">
                      <Activity className="w-4 h-4" /> Visual Info
                    </h4>
                    <div className="bg-slate-50 rounded-lg p-3 text-sm space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500 text-[11px]">Image Kind:</span>
                        <span className="font-mono text-indigo-600 font-bold text-xs">{result.visualAnalysis.visualInfo?.imageKind} ({(result.visualAnalysis.visualInfo?.imageKindConfidence * 100).toFixed(1)}%)</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block mb-1 text-[11px]">Scene Description:</span>
                        <p className="text-slate-700 text-xs leading-relaxed">{result.visualAnalysis.visualInfo?.sceneDescription}</p>
                      </div>
                      {result.visualAnalysis.visualInfo?.sceneContext && (
                        <div className="pt-2 border-t border-slate-100">
                          <span className="text-slate-500 block mb-1.5 text-[11px]">Scene Context:</span>
                          <div className="flex flex-wrap gap-1">
                            {['environment', 'cover', 'weather', 'lighting', 'accessibility', 'roadwayContext', 'placeType'].map(k => {
                              const val = result.visualAnalysis.visualInfo.sceneContext[k];
                              if (!val || val === 'unknown') return null;
                              return <span key={k} className="px-1.5 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-100 rounded text-[9px] font-mono whitespace-nowrap">{val}</span>;
                            })}
                          </div>
                          {result.visualAnalysis.visualInfo.sceneContext.description && (
                            <p className="text-slate-500 text-[10px] mt-1.5 italic">{result.visualAnalysis.visualInfo.sceneContext.description}</p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {result.visualAnalysis.visualInfo?.uncertainties?.length > 0 && (
                    <div>
                      <h4 className="text-xs font-bold text-slate-500 uppercase mb-2">Uncertainties</h4>
                      <ul className="list-disc pl-5 text-xs text-slate-600 space-y-1">
                        {result.visualAnalysis.visualInfo.uncertainties.map((u: string, i: number) => <li key={i}>{u}</li>)}
                      </ul>
                    </div>
                  )}

                  {result.visualAnalysis.indexing?.keywords?.length > 0 && (
                    <div>
                      <h4 className="text-xs font-bold text-slate-500 uppercase mb-2">Keywords</h4>
                      <div className="flex flex-wrap gap-1.5">
                        {result.visualAnalysis.indexing.keywords.map((kw: any, i: number) => (
                          <span key={i} className="px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded-full text-[10px] font-bold border border-indigo-100" title={`Confidence: ${kw.confidence}, Importance: ${kw.importance}`}>
                            {kw.value}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="lg:col-span-8 space-y-6">
                  <div>
                    <h4 className="text-xs font-bold text-slate-500 uppercase mb-2 flex items-center justify-between">
                      <span>Visible Elements</span>
                      <span className="text-[10px] lowercase font-normal">{result.visualAnalysis.visualInfo?.visibleElements?.length || 0} elements detected</span>
                    </h4>
                    <div className="bg-white rounded-lg overflow-hidden border border-slate-200">
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-[11px]">
                          <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200">
                            <tr>
                              <th className="px-3 py-2 min-w-[120px]">Label</th>
                              <th className="px-3 py-2">Category</th>
                              <th className="px-3 py-2">Attributes / Evidence</th>
                              <th className="px-3 py-2 text-right">Confidence</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {(result.visualAnalysis.visualInfo?.visibleElements || []).map((el: any, idx: number) => (
                              <tr key={idx} className="hover:bg-slate-50 transition-colors">
                                <td className="px-3 py-2">
                                  <div className="flex flex-col">
                                    <div className="flex items-center gap-1.5">
                                      <span className="font-bold text-slate-800">{el.label}</span>
                                      {el.primary && <span className="px-1 bg-indigo-100 text-indigo-700 rounded-[2px] text-[8px] font-black uppercase">Primary</span>}
                                      {el.count > 1 && <span className="text-slate-400 font-normal">x{el.count}</span>}
                                    </div>
                                    {el.locationHint && <span className="text-[9px] text-slate-400 mt-0.5">Loc: {el.locationHint}</span>}
                                  </div>
                                </td>
                                <td className="px-3 py-2">
                                  <span className="px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded text-[10px] font-mono whitespace-nowrap">{el.category}</span>
                                </td>
                                <td className="px-3 py-2">
                                  <div className="flex flex-col gap-1">
                                    {el.attributes?.length > 0 && (
                                      <div className="flex flex-wrap gap-1">
                                        {el.attributes.map((a: string, i: number) => (
                                          <span key={i} className="px-1 bg-slate-100 text-slate-500 rounded-[2px] text-[9px] italic">{a}</span>
                                        ))}
                                      </div>
                                    )}
                                    {el.stateContext && (
                                      <div className="flex flex-wrap gap-1 mt-0.5">
                                        {['containment', 'exposure', 'placement', 'usage', 'interaction', 'condition', 'role'].map(k => {
                                          const val = el.stateContext[k];
                                          if (!val || val === 'unknown') return null;
                                          return <span key={k} className="px-1 bg-amber-50 text-amber-700 border border-amber-100 rounded-[2px] text-[9px]">{val}</span>;
                                        })}
                                      </div>
                                    )}
                                    {el.stateContext?.description && (
                                      <span className="text-[9px] text-slate-400 italic block mt-0.5">{el.stateContext.description}</span>
                                    )}
                                    {el.evidence && <span className="text-[10px] text-slate-500 italic block mt-0.5">Evidence: {el.evidence}</span>}
                                    {!el.attributes?.length && !el.stateContext && !el.evidence && <span className="text-slate-300">-</span>}
                                  </div>
                                </td>
                                <td className="px-3 py-2 text-right">
                                  <div className="flex items-center justify-end gap-2">
                                    <div className="w-12 h-1 bg-slate-100 rounded-full overflow-hidden hidden sm:block">
                                      <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${el.confidence * 100}%` }} />
                                    </div>
                                    <span className="font-mono text-slate-600 font-bold w-7 text-right">{(el.confidence * 100).toFixed(0)}%</span>
                                  </div>
                                </td>
                              </tr>
                            ))}
                            {(!result.visualAnalysis.visualInfo?.visibleElements || result.visualAnalysis.visualInfo.visibleElements.length === 0) && (
                              <tr><td colSpan={4} className="px-3 py-4 text-center text-slate-400 italic">No visible elements detected</td></tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h4 className="text-xs font-bold text-slate-500 uppercase mb-2 flex items-center justify-between">
                      <span>Visible Text</span>
                      <button 
                        onClick={() => handleCopy((result.visualAnalysis.visualInfo?.visibleText || []).map((t: any) => t.text).join("\n"), 'text')}
                        className="text-[10px] font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
                      >
                        {copied === 'text' ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                        Copy All Text
                      </button>
                    </h4>
                    <div className="bg-white rounded-lg overflow-hidden border border-slate-200">
                      <table className="w-full text-left text-[11px]">
                        <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200">
                          <tr>
                            <th className="px-3 py-2">Extracted Text</th>
                            <th className="px-3 py-2">Lang / Location</th>
                            <th className="px-3 py-2 text-right">Confidence</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {(result.visualAnalysis.visualInfo?.visibleText || []).map((txt: any, idx: number) => (
                            <tr key={idx} className="hover:bg-slate-50 transition-colors">
                              <td className="px-3 py-2 text-slate-800 font-mono whitespace-pre-wrap leading-relaxed">{txt.text}</td>
                              <td className="px-3 py-2">
                                <div className="flex flex-col gap-1">
                                  <span className="px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded text-[9px] font-mono w-fit uppercase">{txt.language || "-"}</span>
                                  {txt.locationHint && <span className="text-[9px] text-slate-400 italic">Loc: {txt.locationHint}</span>}
                                </div>
                              </td>
                              <td className="px-3 py-2 text-right">
                                <span className="font-mono text-slate-600 font-bold">{(txt.confidence * 100).toFixed(0)}%</span>
                              </td>
                            </tr>
                          ))}
                          {(!result.visualAnalysis.visualInfo?.visibleText || result.visualAnalysis.visualInfo.visibleText.length === 0) && (
                            <tr><td colSpan={3} className="px-3 py-4 text-center text-slate-400 italic">No visible text detected</td></tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </div>
            )
          )}

            {result.requestPreview && (
              <details className="bg-slate-100 rounded-lg border border-slate-200 overflow-hidden group">
                <summary className="px-4 py-2 text-xs font-bold text-slate-600 cursor-pointer hover:bg-slate-200 transition-colors flex items-center justify-between">
                  <span>Debug: Request Preview (Opt-in)</span>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={(e) => { e.preventDefault(); handleCopy(JSON.stringify(result.requestPreview, null, 2), 'preview'); }}
                      className="text-indigo-600 hover:text-indigo-700 p-1 bg-white rounded border border-slate-200"
                    >
                      {copied === 'preview' ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                    </button>
                  </div>
                </summary>
                <div className="p-4 bg-slate-950">
                  <pre className="text-[10px] text-slate-400 font-mono overflow-x-auto whitespace-pre-wrap">
                    {JSON.stringify(result.requestPreview, null, 2)}
                  </pre>
                </div>
              </details>
            )}

            <details className="bg-slate-100 rounded-lg border border-slate-200 overflow-hidden">
              <summary className="px-4 py-2 text-xs font-bold text-slate-600 cursor-pointer hover:bg-slate-200 transition-colors">
                Validated Visual Analysis JSON (Normalized)
              </summary>
              <div className="p-4 bg-slate-950">
                <pre className="text-[10px] text-slate-400 font-mono overflow-x-auto">
                  {JSON.stringify(result.visualAnalysis, null, 2)}
                </pre>
              </div>
            </details>
          </div>
        </div>
      )}
      </>
      ) : null}

      {/* 📊 実験結果マトリクス (Matrix Results) */}
      {experimentViewTab === "matrix" && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4 mb-4">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowMatrixHelp(true)}
                  className="px-3 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 hover:border-slate-300 text-slate-700 rounded-lg text-xs font-bold shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                  title="マトリクスの詳細説明を表示"
                  id="btn-matrix-help"
                >
                  <Info className="w-4 h-4 text-indigo-500 animate-pulse" />
                  マトリクスの詳細説明・使い方
                </button>
              </div>
              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <button
                  onClick={handleExportMatrixCSV}
                  className="px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded text-xs font-bold shadow-sm flex items-center gap-1.5 transition-colors"
                >
                  <Download className="w-4 h-4 text-slate-500" />
                  CSVをダウンロード
                </button>
                <button
                  onClick={handleClearMatrixResults}
                  className="px-3 py-1.5 bg-white hover:bg-rose-50 text-rose-600 border border-slate-200 hover:border-rose-200 rounded text-xs font-bold shadow-sm flex items-center gap-1.5 transition-colors"
                >
                  <Trash2 className="w-4 h-4 text-rose-500" />
                  履歴をリセット
                </button>
              </div>
            </div>

            {/* Matrix Table */}
            <div className="overflow-x-auto border border-slate-200 rounded-lg shadow-inner">
              <table className="w-full text-xs text-left border-collapse min-w-[1000px]">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold divide-x divide-slate-200">
                    <th className="p-3 sticky left-0 bg-slate-50 z-10 w-[240px] max-w-[30vw] overflow-hidden truncate">サンプル (Sample)</th>
                    {MATRIX_COLUMNS.map((col, idx) => (
                      <th key={idx} className="p-3 text-center min-w-[110px]" title={`${col.model} (${col.mode})`}>
                        <div className="font-bold text-slate-800 text-[10.5px] leading-tight">{col.label}</div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {PUBLIC_VISUAL_SAMPLES.map((sample) => (
                    <tr key={sample.id} className="hover:bg-slate-50/50 transition-colors divide-x divide-slate-100">
                      <td className="p-3 font-medium text-slate-900 sticky left-0 bg-white z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] w-[240px] max-w-[30vw] overflow-hidden">
                        <div className="flex items-center gap-2 min-w-0">
                          {(sample as any).thumbnailRoute && (
                            <img
                              src={(sample as any).thumbnailRoute}
                              alt={sample.title}
                              referrerPolicy="no-referrer"
                              className="w-7 h-7 rounded object-cover border border-slate-200 shrink-0"
                            />
                          )}
                          <div className="min-w-0">
                            <div className="font-bold text-slate-800 truncate text-[11px]" title={sample.title}>
                              {sample.title}
                            </div>
                            <div className="text-[9px] text-slate-400 font-mono truncate">{sample.id}</div>
                          </div>
                        </div>
                      </td>
                      {MATRIX_COLUMNS.map((col, colIdx) => {
                        const key = `${sample.id}|${col.model}|${col.mode}`;
                        const cell = matrixResults[key];
                        const isRunning = runningCellKey === key;
                        
                        let cellBg = "bg-white";
                        let cellIcon = null;
                        let cellTooltip = "未実行 (クリックしてクイックテスト)";

                        if (cell) {
                          if (cell.success) {
                            if (cell.overallStatus === 'pass') {
                              cellBg = "bg-emerald-50/60 hover:bg-emerald-100/70";
                              cellIcon = <CheckCircle className="w-4 h-4 text-emerald-600" />;
                              cellTooltip = `Pass (比較クリア) - クリックして詳細を表示`;
                            } else if (cell.overallStatus === 'warning') {
                              cellBg = "bg-amber-50/60 hover:bg-amber-100/70";
                              cellIcon = <AlertTriangle className="w-4 h-4 text-amber-600" />;
                              cellTooltip = `Warning (一部差分あり) - クリックして詳細を表示`;
                            } else if (cell.overallStatus === 'fail') {
                              cellBg = "bg-rose-50/60 hover:bg-rose-100/70";
                              cellIcon = <XCircle className="w-4 h-4 text-rose-600" />;
                              cellTooltip = `Fail (不合格) - クリックして詳細を表示`;
                            } else {
                              cellBg = "bg-emerald-50/30 hover:bg-emerald-50/60";
                              cellIcon = <Check className="w-4 h-4 text-emerald-500" />;
                              cellTooltip = `成功 - クリックして詳細を表示`;
                            }
                          } else {
                            cellBg = "bg-rose-50/40 hover:bg-rose-100/50";
                            cellIcon = <XCircle className="w-4 h-4 text-rose-500" />;
                            cellTooltip = `解析失敗: ${cell.error || 'Unknown Error'} - クリックして詳細表示`;
                          }
                        }

                        return (
                          <td
                            key={colIdx}
                            onClick={() => {
                              setSelectedMatrixCell({
                                sampleId: sample.id,
                                model: col.model,
                                mode: col.mode,
                                result: cell
                              });
                            }}
                            className={`p-3 text-center cursor-pointer transition-colors relative group h-12 ${cellBg}`}
                            title={cellTooltip}
                          >
                            <div className="flex items-center justify-center h-full">
                              {isRunning ? (
                                <Loader2 className="w-4 h-4 text-indigo-500 animate-spin" />
                              ) : cellIcon ? (
                                cellIcon
                              ) : (
                                <span className="text-slate-300 group-hover:text-slate-400 font-mono text-[10px]">+</span>
                              )}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Detailed Card for Selected Cell */}
          {selectedMatrixCell && (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-200">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div>
                  <h4 className="font-bold text-slate-800 text-sm">
                    セル詳細診断: {PUBLIC_VISUAL_SAMPLES.find(s => s.id === selectedMatrixCell.sampleId)?.title || selectedMatrixCell.sampleId}
                  </h4>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    モデル: <span className="font-mono text-slate-600">{selectedMatrixCell.model}</span> ({selectedMatrixCell.mode === 'json_object' ? 'JSON' : 'Prompt'})
                  </p>
                </div>
                <button
                  onClick={() => setSelectedMatrixCell(null)}
                  className="text-xs text-slate-400 hover:text-slate-600 font-semibold"
                >
                  閉じる
                </button>
              </div>

              {selectedMatrixCell.result ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                  <div className="space-y-3">
                    <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 space-y-1.5">
                      <div className="text-slate-400 font-medium">基本メタデータ</div>
                      <div>
                        <strong>ステータス:</strong>{" "}
                        <span className={`font-bold ${selectedMatrixCell.result.success ? "text-emerald-600" : "text-rose-600"}`}>
                          {selectedMatrixCell.result.success ? "成功" : "失敗"}
                        </span>
                      </div>
                      {selectedMatrixCell.result.overallStatus && (
                        <div>
                          <strong>評価:</strong>{" "}
                          <span className={`font-bold uppercase ${
                            selectedMatrixCell.result.overallStatus === 'pass' ? "text-emerald-600" : 
                            selectedMatrixCell.result.overallStatus === 'warning' ? "text-amber-600" : "text-rose-600"
                          }`}>
                            {selectedMatrixCell.result.overallStatus}
                          </span>
                        </div>
                      )}
                      <div>
                        <strong>実行手段 (Source):</strong>{" "}
                        <span className="font-mono text-slate-600">{selectedMatrixCell.result.source}</span>
                      </div>
                      <div>
                        <strong>日時:</strong>{" "}
                        <span className="text-slate-500">{new Date(selectedMatrixCell.result.timestamp).toLocaleString()}</span>
                      </div>
                    </div>

                    {selectedMatrixCell.result.error && (
                      <div className="bg-rose-50 border border-rose-100 p-3 rounded-lg text-rose-900 space-y-1">
                        <div className="font-bold flex items-center gap-1">
                          <AlertCircle className="w-4 h-4 text-rose-500" />
                          エラーメッセージ
                        </div>
                        <div className="font-mono text-[11px] break-all whitespace-pre-wrap">
                          {selectedMatrixCell.result.error}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="space-y-3 flex flex-col justify-between">
                    <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 flex-1 space-y-1.5">
                      <div className="text-slate-400 font-medium">クイックアクション (Quick Actions)</div>
                      <p className="text-[11px] text-slate-500">
                        この特定のセル（モデルとサンプルの組み合わせ）に対して、今すぐクライアント（ブラウザ）経由で解析テストを実行し、マトリクスの結果をその場で更新できます。
                      </p>
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={() => handleRunSingleCell(selectedMatrixCell.sampleId, selectedMatrixCell.model, selectedMatrixCell.mode)}
                        disabled={!!runningCellKey}
                        className="flex-1 py-2 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg transition-colors flex items-center justify-center gap-1.5 shadow-sm disabled:opacity-50"
                      >
                        {runningCellKey === `${selectedMatrixCell.sampleId}|${selectedMatrixCell.model}|${selectedMatrixCell.mode}` ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" /> 実行中...
                          </>
                        ) : (
                          <>
                            <Play className="w-4 h-4" /> 今すぐテスト実行 (Run Test)
                          </>
                        )}
                      </button>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(JSON.stringify(selectedMatrixCell.result, null, 2));
                          alert("セルの詳細JSONをコピーしました！");
                        }}
                        className="py-2 px-3 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg font-medium transition-colors flex items-center justify-center gap-1 shadow-sm"
                        title="JSONをコピー"
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-slate-50 p-6 rounded-lg text-center border border-dashed text-xs text-slate-500 space-y-3">
                  <p>このセルの組み合わせ結果はまだ記録されていません。</p>
                  <button
                    onClick={() => handleRunSingleCell(selectedMatrixCell.sampleId, selectedMatrixCell.model, selectedMatrixCell.mode)}
                    disabled={!!runningCellKey}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg transition-colors shadow-sm disabled:opacity-50 text-xs"
                  >
                    {runningCellKey === `${selectedMatrixCell.sampleId}|${selectedMatrixCell.model}|${selectedMatrixCell.mode}` ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" /> 実行中...
                      </>
                    ) : (
                      <>
                        <Play className="w-3.5 h-3.5" /> 今すぐテスト実行
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {showBatchArtifactHelp && (
        <BatchArtifactHelpDialog onClose={() => setShowBatchArtifactHelp(false)} />
      )}

      {showMatrixHelp && (
        <MatrixHelpDialog onClose={() => setShowMatrixHelp(false)} />
      )}
    </div>
  );
}

function MatrixHelpDialog({ onClose }: { onClose: () => void }) {
  // Close on Escape key press
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-[2px] transition-opacity animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="matrix-help-title"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Info className="w-5 h-5 text-indigo-600 animate-pulse" />
            <h3 id="matrix-help-title" className="text-base font-bold text-slate-800">
              共通実験結果マトリクス (Merged Experiment Matrix) の詳細説明
            </h3>
          </div>
          <button 
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-50 transition-colors"
            aria-label="閉じる"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 overflow-y-auto text-sm leading-relaxed text-slate-600">
          {/* Section 1: Overview */}
          <div className="space-y-2">
            <h4 className="font-bold text-slate-800 text-sm flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 shrink-0" />
              1. 共通実験結果マトリクスの目的と役割
            </h4>
            <p className="text-xs text-slate-600 pl-4">
              本マトリクスは、画像解析・レグレッション検証のすべての実行履歴をマージした横断的な品質比較ダッシュボードです。
              クライアント側のブラウザ上で実行された<strong>手動検証（単一実行・バッチ実行）</strong>の結果と、Node.jsバックグラウンドで処理される<strong>サーバーサイドの一括ジョブ実行</strong>の結果がすべて統合され、モデルごと・検証用サンプル（ファイル形式）ごとの検証結果を同一画面上で横並びに比較できます。
            </p>
          </div>

          {/* Section 2: Merging Behavior */}
          <div className="space-y-2">
            <h4 className="font-bold text-slate-800 text-sm flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-purple-500 shrink-0" />
              2. 検証結果の自動マージ・上書きロジック
            </h4>
            <div className="text-xs text-slate-600 pl-4 space-y-1">
              <p>検証結果は「サンプルID ✕ モデル名 ✕ 出力モード（JSON ModeまたはPlain Text）」の組み合わせを一意のキーとして管理されます：</p>
              <ul className="list-disc pl-4 space-y-1">
                <li><strong>最新の実行結果が自動適用:</strong> 同一の条件で再検証が行われた場合、過去の古いステータスや判定結果は自動的に最新の実行結果へアップデートされます。</li>
                <li><strong>持続的なローカルストレージ保存:</strong> マージされた統計情報はブラウザのlocalStorageをベースに自動永続化されるため、タブを閉じたりリロードしたりしても検証の蓄積データが消えることはありません。</li>
              </ul>
            </div>
          </div>

          {/* Section 3: Cell Statuses */}
          <div className="space-y-2">
            <h4 className="font-bold text-slate-800 text-sm flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" />
              3. マトリクスセルのステータスとカラー判定基準
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pl-4 pt-1">
              <div className="p-3 bg-emerald-50/50 rounded-lg border border-emerald-100 space-y-1">
                <span className="text-xs font-bold text-emerald-800 flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  成功 (Success)
                </span>
                <p className="text-[11px] text-slate-500">
                  AIモデルの出力したレスポンスが、定義されたJSONスキーマに100%適合し、画像の分類判定、カテゴリタグ、抽出ラベル、および可視テキストがすべて期待基準（適合カバレッジ）をクリアしてパスした状態です。
                </p>
              </div>
              <div className="p-3 bg-rose-50/50 rounded-lg border border-rose-100 space-y-1">
                <span className="text-xs font-bold text-rose-800 flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-rose-500" />
                  失敗 (Failure)
                </span>
                <p className="text-[11px] text-slate-500">
                  以下のいずれかの不適合を検出した状態を示します。詳細な失敗理由はセルをクリックすることで即時トレースが可能です：
                </p>
                <ul className="list-disc pl-4 text-[10px] text-slate-500 space-y-0.5">
                  <li><strong>Model Generation Failed:</strong> API接続エラーや画像フォーマット非互換。</li>
                  <li><strong>Invalid JSON:</strong> モデルが正しいJSONスキーマを出力できなかった。</li>
                  <li><strong>Comparison Mismatch:</strong> 人間の定義した期待値とAIの検出値に著しいズレや欠損がある場合。</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Section 4: Key Operations */}
          <div className="space-y-2">
            <h4 className="font-bold text-slate-800 text-sm flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shrink-0" />
              4. 効率的なデバッグ機能と対応アクション
            </h4>
            <ul className="text-xs text-slate-600 pl-8 list-decimal space-y-1.5">
              <li><strong>セルをクリックしてその場で再テスト実行:</strong> 表内の気になるセルを直接クリックすると、モーダル上で詳細な検証ログや生のJSON出力をトレース可能です。さらに「今すぐテスト実行」をクリックすることで、個別のサンプル・モデルの組み合わせだけをピンポイントで再テストし、判定を最新化できます。</li>
              <li><strong>CSVデータエクスポートによる定量評価:</strong> 画面右上の「CSVをダウンロード」機能を使うと、マトリクス内のすべての適合ステータス、カバレッジパーセンテージ、エラー原因などの一覧をCSV出力できます。スプレッドシートやExcel、BIツール等にインポートして、モデルごとの定量比較や精度推移グラフを簡単に生成できます。</li>
              <li><strong>履歴のリセット:</strong> 表内のすべての実行済みデータをクリーンアップし、空の状態に戻します（テストサンプル自体は削除されません）。</li>
            </ul>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 flex justify-end bg-slate-50">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg shadow-sm transition-colors cursor-pointer"
          >
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
}

function BatchArtifactHelpDialog({ onClose }: { onClose: () => void }) {
  // Close on Escape key press
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-[2px] transition-opacity animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="batch-artifact-help-title"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <HelpCircle className="w-5 h-5 text-indigo-600" />
            <h3 id="batch-artifact-help-title" className="text-base font-bold text-slate-800">
              JSON出力の種類
            </h3>
          </div>
          <button 
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-50 transition-colors"
            aria-label="閉じる"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 overflow-y-auto">
          {/* Intro description */}
          <div className="bg-indigo-50/50 p-4 rounded-lg border border-indigo-100 text-xs text-indigo-950 leading-relaxed space-y-2">
            <h4 className="font-bold text-indigo-900">どれをコピーすればよいか</h4>
            <p>
              通常は <strong>ChatGPT Summary</strong> をコピーしてください。
              判定理由や検出内容の詳細を確認したい場合だけ <strong>ChatGPT Diagnostic</strong> を使います。
              失敗が出た場合は <strong>Failures Only JSON</strong> が最も適しています。
              <strong>Full Batch JSON</strong> は保存用で、原則としてダウンロードしてください。
            </p>
          </div>

          <div className="space-y-4">
            {/* 1. ChatGPT Summary */}
            <div className="p-4 rounded-lg border border-emerald-100 bg-emerald-50/30 space-y-2">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                <h4 className="text-xs font-bold text-emerald-900">1. ChatGPT Summary (推奨要約版)</h4>
              </div>
              <ul className="text-xs text-slate-600 space-y-1 list-disc pl-4 leading-relaxed">
                <li>一番軽い要約版で、ChatGPT に貼る標準形式です。</li>
                <li><strong>含まれる情報:</strong> sampleId、title、success、qualityStatus、reviewStatus、expectedImageKind、detectedImageKind、overallCoverage、および categories / labels / visibleText の不足情報。</li>
                <li><strong>含まれない情報:</strong> APIからの生のレスポンス(responseRaw), 詳細な visibleElements の属性、response body preview、構文解析の詳細(parse diagnostics)などは除外され、軽量に保たれます。</li>
                <li><strong>用途:</strong> 通常はまずこれをコピーして ChatGPT に貼って評価結果を送信します。</li>
              </ul>
            </div>

            {/* 2. ChatGPT Diagnostic */}
            <div className="p-4 rounded-lg border border-indigo-100 bg-indigo-50/20 space-y-2">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-indigo-500" />
                <h4 className="text-xs font-bold text-indigo-900">2. ChatGPT Diagnostic (診断用詳細版)</h4>
              </div>
              <ul className="text-xs text-slate-600 space-y-1 list-disc pl-4 leading-relaxed">
                <li>Summary だけでは理由が分からないときに使う診断用の詳細版です。</li>
                <li><strong>含まれる情報:</strong> 期待されるメタデータ(expected metadata)、詳細な比較サマリー(comparisonSummary)、検出された要素(detected visibleElements)、検出テキスト(visibleText)、キーワード、各種診断情報(input/parse/response diagnostics)。</li>
                <li><strong>除外される情報:</strong> 成功時の巨大な response body preview などは除外されます。</li>
                <li><strong>用途:</strong> なぜ needsReview / failure になったか確認する、期待値と検出値のズレを確認する、comparison matcher の挙動を検証するときに使います。</li>
              </ul>
            </div>

            {/* 3. Failures Only JSON */}
            <div className="p-4 rounded-lg border border-red-100 bg-red-50/20 space-y-2">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
                <h4 className="text-xs font-bold text-red-900">3. Failures Only JSON (失敗データ抽出版)</h4>
              </div>
              <ul className="text-xs text-slate-600 space-y-1 list-disc pl-4 leading-relaxed">
                <li>評価実行中に失敗(生成エラー、APIエラー、JSONパースエラー、検証エラーなど)が発生したサンプルだけを抜き出す JSON です。</li>
                <li>全件成功している場合はほぼ空になります。</li>
                <li><strong>用途:</strong> エラーが発生した際に、これをコピーして ChatGPT に貼ることで、失敗原因の分析や修正がスムーズになります。</li>
              </ul>
            </div>

            {/* 4. Full Batch JSON (全件完全版) */}
            <div className="p-4 rounded-lg border border-slate-200 bg-slate-50/50 space-y-2">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-slate-500" />
                <h4 className="text-xs font-bold text-slate-900">4. Full Batch JSON (全件完全版)</h4>
              </div>
              <ul className="text-xs text-slate-600 space-y-1 list-disc pl-4 leading-relaxed">
                <li>評価した全件の完全なデータです。生のレスポンス(raw response)、analysisRun、詳細な診断情報(input/output diagnostics)、比較結果など、最も多くの情報が含まれます。</li>
                <li><strong>ダウンロード推奨:</strong> コピーするとサイズが非常に大きくなりやすく、途中で途切れる可能性があるため、基本的には「ダウンロード」して保存してください。</li>
              </ul>
            </div>
          </div>

          {/* Additional note about endSentinel */}
          <div className="border-t border-slate-100 pt-4 space-y-2 text-xs text-slate-500 leading-relaxed">
            <h5 className="font-bold text-slate-700 font-sans">📌 コピーの途中切れ確認 (endSentinel)</h5>
            <p>
              各 JSON 出力の末尾には、データの完全性を担保するための <strong>"artifactIntegrity.endSentinel"</strong> というフィールドが含まれています。
              ChatGPT などに貼り付けた後、末尾にこの sentinel が見えていれば、データが途切れることなく正常にコピー＆ペーストされたことを確認できます。
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 flex justify-end bg-slate-50">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-slate-700 hover:text-slate-800 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg shadow-sm transition-colors"
          >
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
}

