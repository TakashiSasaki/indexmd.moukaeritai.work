import React, { useState, useEffect, useMemo } from 'react';
import { Search, Image as ImageIcon, AlertCircle, CheckCircle, RefreshCw, Activity, Check, Copy, Download, ExternalLink, Info, Trash2, Terminal, ChevronDown, ChevronUp, Clock, ArrowRight, HelpCircle, Play, RotateCw } from 'lucide-react';
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
import { PublicSampleBatchRunSummary, PublicSampleBatchRunItem } from '../lib/visualAnalysis/publicSamples/batchTypes';
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
import { stringifyJsonArtifact, downloadJsonArtifact, fnv1a32 } from '../lib/visualAnalysis/publicSamples/artifactUtils';
import { safeFetch, safeFetchWithRetry, ResponseDiagnostics, SafeFetchRetryEvent } from '../lib/visualAnalysis/safeFetch';

interface ImageExperimentProps {
  token: string;
  config: AppConfig;
  onAddLog: (level: "info"|"success"|"warn"|"error", msg: string, details?: string) => void;
  onSessionExpiry: () => void;
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

export default function ImageExperiment({ token, config, onAddLog, onSessionExpiry }: ImageExperimentProps) {
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

  // Batch evaluation state
  const [isBatchRunning, setIsBatchRunning] = useState<boolean>(false);
  const [batchProgress, setBatchProgress] = useState<{ current: number, total: number } | null>(null);
  const [activeCheckpoint, setActiveCheckpoint] = useState<PublicSampleBatchCheckpoint | null>(null);
  const [hasIncompatibleCheckpoint, setHasIncompatibleCheckpoint] = useState<boolean>(false);
  const [batchSummary, setBatchSummary] = useState<PublicSampleBatchRunSummary | null>(() => {
    try {
      const saved = localStorage.getItem("image_experiment_last_batch_summary");
      return saved ? JSON.parse(saved) : null;
    } catch (e) {
      return null;
    }
  });

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
  
  // Public sample filtering state
  const [sampleFilter, setSampleFilter] = useState<"all" | "external" | "synthetic">("all");

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

  const filteredSamples = useMemo(() => {
    if (sampleFilter === "all") return samples;
    return samples.filter(s => {
      const isSynthetic = s.isSynthetic ?? (s.source?.provider === "localFixture");
      if (sampleFilter === "synthetic") return isSynthetic;
      if (sampleFilter === "external") return !isSynthetic;
      return true;
    });
  }, [samples, sampleFilter]);

  useEffect(() => {
    if (samples.length > 0) {
      if (filteredSamples.length === 0) {
        setSelectedSampleId("");
      } else if (!selectedSampleId || !filteredSamples.find(s => s.id === selectedSampleId)) {
        const savedId = localStorage.getItem("image_experiment_selected_sample_id");
        if (savedId && filteredSamples.find(s => s.id === savedId)) {
          setSelectedSampleId(savedId);
        } else {
          setSelectedSampleId(filteredSamples[0].id);
        }
      }
    }
  }, [filteredSamples, samples.length, selectedSampleId]);

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
        onRetry: (event: SafeFetchRetryEvent) => {
          onAddLog("warn", `[Image Analysis] サーバーウォームアップを検出しました。${event.delayMs / 1000}秒後にリトライします (Attempt ${event.attempt})...`);
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
      } else {
        setResult(data);
        if (!data.success) {
          onAddLog("error", `[Image Analysis] Error: ${data.error || "Failed to analyze public sample"}`);
          setSampleStatuses(prev => ({ ...prev, [selectedSampleId]: "failure" }));
        } else {
          onAddLog("success", `[Image Analysis] Complete for sample ${selectedSampleId}`);
          setSampleStatuses(prev => ({ ...prev, [selectedSampleId]: "success" }));
        }
      }
    } catch (err: any) {
      onAddLog("error", `[Image Analysis] Error: ${err.message}`);
      setSampleStatuses(prev => ({ ...prev, [selectedSampleId]: "failure" }));
    } finally {
      setLoading(false);
    }
  };

  const handleRunBatch = async (resumeMode: boolean = false, includeFailed: boolean = false) => {
    let targetSamples = samples.filter(s => selectedSampleIds[s.id]);
    
    let isResuming = false;
    let initialCheckpoint: PublicSampleBatchCheckpoint | null = null;
    
    if (resumeMode && activeCheckpoint) {
      isResuming = true;
      initialCheckpoint = activeCheckpoint;
      const idsToRun = includeFailed
        ? [...activeCheckpoint.pendingSampleIds, ...activeCheckpoint.failedSampleIds]
        : [...activeCheckpoint.pendingSampleIds];
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

    // Pre-batch health check
    onAddLog("info", "バッチ開始前にヘルスチェックを実行しています...");
    const hcResult = await safeFetchWithRetry<any>("/api/visual/health", undefined, {
      maxAttempts: 3,
      onRetry: (event: SafeFetchRetryEvent) => {
        onAddLog("warn", `[Health Check] サーバーウォームアップを検出しました。${event.delayMs / 1000}秒後にリトライします (Attempt ${event.attempt})...`);
      }
    });
    
    if (!hcResult.success || !hcResult.data?.ok) {
      setIsBatchRunning(false);
      setHealthCheckFailed(true);
      setHealthCheckDiagnostics(hcResult.responseDiagnostics || null);
      setHealthCheckError(hcResult.error || "ヘルスチェック応答が不正です。");
      onAddLog("error", `ヘルスチェックに失敗しました。バッチ処理は開始されません。: ${hcResult.error}`);
      return;
    }

    onAddLog("success", "ヘルスチェックに成功しました。バッチ解析を開始します。");

    // Initialize or restore state
    let total = isResuming && initialCheckpoint ? initialCheckpoint.targetSampleIds.length : targetSamples.length;
    let currentProgress = isResuming && initialCheckpoint 
      ? (includeFailed 
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
      if (includeFailed) {
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
    
    let currentCheckpoint: PublicSampleBatchCheckpoint;
    
    if (isResuming && initialCheckpoint) {
       currentCheckpoint = { 
         ...initialCheckpoint, 
         status: 'running',
         ...(includeFailed ? {
           pendingSampleIds: [...initialCheckpoint.pendingSampleIds, ...initialCheckpoint.failedSampleIds],
           failedSampleIds: [],
           completedSampleIds: initialCheckpoint.completedSampleIds.filter(id => !initialCheckpoint!.failedSampleIds.includes(id)),
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
         saveActiveBatchCheckpoint(currentCheckpoint);
       } catch (err) {
         console.warn("Failed to save initial checkpoint to localStorage", err);
       }
       setActiveCheckpoint(currentCheckpoint);
    } else {
       const initialTargetIds = targetSamples.map(s => s.id);
       currentCheckpoint = {
         checkpointVersion: "public-sample-batch-checkpoint.v0.1.0",
         runId: crypto.randomUUID(),
         createdAt: new Date().toISOString(),
         updatedAt: new Date().toISOString(),
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
         }
       };
       try {
         saveActiveBatchCheckpoint(currentCheckpoint);
       } catch (err) {
         console.warn("Failed to save initial checkpoint to localStorage", err);
         onAddLog("warn", "警告: ローカルストレージへのチェックポイント保存に失敗しました。解析は続行されます。");
       }
       setActiveCheckpoint(currentCheckpoint);
    }

    for (let i = 0; i < targetSamples.length; i++) {
        const sample = targetSamples[i];
        currentProgress++;
        setBatchProgress({ current: currentProgress, total });
        
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
              onRetry: (event: SafeFetchRetryEvent) => {
                onAddLog("warn", `[Batch ${sample.id}] サーバーウォームアップを検出しました。${event.delayMs / 1000}秒後にリトライします (Attempt ${event.attempt})...`);
              }
            });
            
            if (sfResult.responseDiagnostics?.status === 401) {
              onSessionExpiry();
              throw new Error("Session expired (401)");
            }

            const data = sfResult.data || {};
            
            item = {
              sampleId: sample.id,
              title: sample.title,
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
                  expectedElementCategories: expectedMetadata?.elementCategories ?? sample.expectedElementCategories,
                  expectedVisibleElementLabels: expectedMetadata?.visibleElementLabels ?? sample.expectedVisibleElementLabels,
                  expectedVisibleElementLabelAliases: expectedMetadata?.visibleElementLabelAliases ?? sample.expectedVisibleElementLabelAliases,
                  expectedVisibleText: expectedMetadata?.visibleText ?? sample.expectedVisibleText
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
               error: e.message
            };
            items.push(item);
        }
        setSampleStatuses({ ...newStatuses });
        
        // Update and save checkpoint after each sample
        currentCheckpoint = {
          ...currentCheckpoint,
          updatedAt: new Date().toISOString(),
          completedSampleIds: [...currentCheckpoint.completedSampleIds, sample.id],
          pendingSampleIds: currentCheckpoint.pendingSampleIds.filter(id => id !== sample.id),
          failedSampleIds: item.success ? currentCheckpoint.failedSampleIds : [...currentCheckpoint.failedSampleIds, sample.id],
          items: [...items], // copy to trigger updates if used directly
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
          saveActiveBatchCheckpoint(currentCheckpoint);
        } catch (err) {
          console.warn("Failed to save checkpoint progress to localStorage", err);
        }
        setActiveCheckpoint(currentCheckpoint);
    }

    const summary: PublicSampleBatchRunSummary = {
        runId: currentCheckpoint.runId,
        timestamp: new Date().toISOString(),
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
        items: sum.items.map(it => ({
          sampleId: it.sampleId,
          title: it.title,
          success: it.success,
          error: it.error,
          failureKind: it.failureKind,
          qualityStatus: it.qualityStatus,
          qualityScore: it.qualityScore,
          qualityIssues: it.qualityIssues,
          comparison: it.comparison ? {
            imageKind: it.comparison.imageKind,
            categories: it.comparison.categories,
            labels: it.comparison.labels,
            visibleText: it.comparison.visibleText,
            overallStatus: it.comparison.overallStatus,
            reviewStatus: it.comparison.reviewStatus,
            reviewReasons: it.comparison.reviewReasons
          } : undefined,
          execution: (it.analysisRun?.metadata ?? it.analysisRun) ? {
            modelName: (it.analysisRun?.metadata ?? it.analysisRun)?.model?.name || (it.analysisRun?.metadata ?? it.analysisRun)?.execution?.modelName,
            providerFamily: (it.analysisRun?.metadata ?? it.analysisRun)?.model?.providerFamily || (it.analysisRun?.metadata ?? it.analysisRun)?.execution?.providerFamily,
            jsonMode: (it.analysisRun?.metadata ?? it.analysisRun)?.execution?.jsonMode,
            jsonRecovery: (it.analysisRun?.metadata ?? it.analysisRun)?.execution?.jsonRecovery
          } : undefined
        }))
      };
    };

    const saved = localStorage.getItem("image_experiment_batch_runs");
    let runs = saved ? JSON.parse(saved) : [];
    runs.unshift(shrinkBatchRunSummaryForLocalStorage(summary));
    if (runs.length > 5) runs = runs.slice(0, 5);
    localStorage.setItem("image_experiment_batch_runs", JSON.stringify(runs));

    setIsBatchRunning(false);
    setBatchProgress(null);
    onAddLog("success", `Batch regression complete for ${total} samples.`);

    // If exactly 1 sample was processed in this subset run, also set single result so the user can see detail tabs immediately
    if (total === 1 && items[0].responseRaw) {
      setResult(items[0].responseRaw);
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto p-4 md:p-6">
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-5">
          {activeCheckpoint && !isBatchRunning && (
            <div className="mb-6 p-4 rounded-lg border border-amber-200 bg-amber-50">
              <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
                <div className="space-y-1">
                  <h3 className="text-sm font-bold text-amber-900 flex items-center gap-2">
                    <Activity className="w-4 h-4 text-amber-600" />
                    未完了のバッチ解析があります
                  </h3>
                  <p className="text-xs text-amber-700">
                    前回の実行が途中で中断されました。続きから再開できます。<br/>
                    <span className="font-semibold text-amber-800">※ チェックボックスの選択に関わらず、保存されたチェックポイントの対象サンプルで実行されます。</span><br/>
                    モデル: <span className="font-semibold">{activeCheckpoint.modelName}</span> ({activeCheckpoint.jsonMode})<br/>
                    進捗: {activeCheckpoint.completedSampleIds.length} / {activeCheckpoint.targetSampleIds.length} 完了
                    {activeCheckpoint.failedSampleIds.length > 0 && <span className="ml-2 text-red-600">({activeCheckpoint.failedSampleIds.length} エラー)</span>}
                  </p>
                </div>
                <div className="flex gap-2 w-full md:w-auto shrink-0">
                  <button
                    onClick={() => {
                      clearActiveBatchCheckpoint();
                      setActiveCheckpoint(null);
                    }}
                    disabled={isBatchRunning}
                    className="px-3 py-1.5 text-xs font-bold text-amber-700 hover:text-amber-800 bg-amber-100/50 hover:bg-amber-200/50 rounded-md transition-colors disabled:opacity-50"
                  >
                    破棄する
                  </button>
                   <button
                    onClick={() => handleRunBatch(true, false)}
                    disabled={isBatchRunning}
                    className="px-3 py-1.5 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-md transition-colors disabled:opacity-50 flex items-center gap-1 shadow-sm"
                  >
                    <Play className="w-3.5 h-3.5" /> 続きから再開
                  </button>
                  {activeCheckpoint.failedSampleIds.length > 0 && (
                    <button
                      onClick={() => handleRunBatch(true, true)}
                      disabled={isBatchRunning}
                      className="px-3 py-1.5 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-md transition-colors disabled:opacity-50 flex items-center gap-1 shadow-sm"
                    >
                      <RotateCw className="w-3.5 h-3.5" /> 失敗分も含めて再開
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {hasIncompatibleCheckpoint && !isBatchRunning && (
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
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                      {/* Top Batch Button (Mobile-friendly duplication) */}
                      <div className="flex-1 w-full sm:w-auto">
                        <button
                          type="button"
                          onClick={() => handleRunBatch()}
                          disabled={isBatchRunning || samples.length === 0 || loading}
                          className="w-full sm:w-auto px-4 py-1.5 bg-indigo-600 text-white rounded text-xs font-bold hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-1.5 transition-colors h-[32px] justify-center whitespace-nowrap shadow-sm"
                        >
                          {isBatchRunning ? (
                            <>
                              <Activity className="w-3.5 h-3.5 animate-pulse" /> 解析中 ({batchProgress?.current}/{batchProgress?.total})
                            </>
                          ) : (
                            <>
                              <Activity className="w-3.5 h-3.5" /> 選択サンプルの解析実行 (Run Selected)
                            </>
                          )}
                        </button>
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                        <select
                          value={sampleFilter}
                          onChange={(e) => setSampleFilter(e.target.value as any)}
                          className="px-2 py-1 bg-white border border-slate-200 rounded text-[10px] font-bold shadow-sm text-slate-700 outline-none"
                        >
                          <option value="all">All Samples</option>
                          <option value="external">External Only</option>
                          <option value="synthetic">Synthetic Only</option>
                        </select>
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

                    {filteredSamples.length > 0 ? (
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 gap-1.5 max-h-none overflow-visible pr-0">
                        {filteredSamples.map((s) => {
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
                <div className="flex flex-col md:flex-row gap-2 w-full md:w-auto mt-4 md:mt-0">
                  <button
                    onClick={handleRunBatch}
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
              </div>
            </div>
          </div>
        </div>
      </div>

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
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                   <div className="p-2 bg-white rounded border border-red-100">
                      <span className="block text-[10px] text-red-400 mb-0.5 font-bold uppercase">HTTP Status</span>
                      <span className="font-bold text-xs text-red-800">{healthCheckDiagnostics.status} ({healthCheckDiagnostics.statusText || "N/A"})</span>
                   </div>
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

      {showBatchArtifactHelp && (
        <BatchArtifactHelpDialog onClose={() => setShowBatchArtifactHelp(false)} />
      )}
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

