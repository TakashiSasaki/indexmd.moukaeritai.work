import React, { useState, useEffect, useMemo } from 'react';
import { Search, Image as ImageIcon, AlertCircle, CheckCircle, RefreshCw, Activity, Check, Copy, Download, ExternalLink, Info, Trash2, Terminal, ChevronDown, ChevronUp, Clock, ArrowRight, HelpCircle } from 'lucide-react';
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
import { buildBatchReportForChat, buildFailuresOnlyReport } from '../lib/visualAnalysis/publicSamples/reportBuilder';
import { sanitizeDebugResponseForLocalStorage } from '../lib/visualAnalysis/debugLogSanitizer';
import { stringifyJsonArtifact, downloadJsonArtifact, fnv1a32 } from '../lib/visualAnalysis/publicSamples/artifactUtils';

export interface ImageDebugLog {
  id: string;
  timestamp: string;
  mode: "drive" | "public";
  requestPayload: {
    fileId?: string;
    sampleId?: string;
    modelName: string;
    includeRequestPreview?: boolean;
    jsonMode?: string;
  };
  responseRaw: any;
  success: boolean;
  errorMessage?: string;
}

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
  const [mode, setMode] = useState<"drive" | "public">(() => {
    const saved = localStorage.getItem("image_experiment_mode");
    return (saved === "drive" || saved === "public") ? saved : "drive";
  });

  // Drive mode state
  const [fileId, setFileId] = useState(() => {
    return localStorage.getItem("image_experiment_file_id") || "";
  });
  const [debouncedFileId, setDebouncedFileId] = useState("");

  useEffect(() => {
    const trimmed = fileId.trim();
    if (!trimmed) {
      setDebouncedFileId("");
      return;
    }
    const handler = setTimeout(() => {
      setDebouncedFileId(trimmed);
    }, 600);
    return () => clearTimeout(handler);
  }, [fileId]);

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
  const [result, setResult] = useState<any>(null);
  const [modelName, setModelName] = useState<string>(() => {
    return localStorage.getItem("image_experiment_model_name") || config.gemini_model || "gemini-3.5-flash";
  });
  const [copied, setCopied] = useState<string | null>(null);
  const [includePreview, setIncludePreview] = useState(false);
  const [retryOnInvalidJson, setRetryOnInvalidJson] = useState(false);
  const [customInstruction, setCustomInstruction] = useState<string>("");
  const [showPreviewHelp, setShowPreviewHelp] = useState(false);

  // Debug logs history state
  const [debugLogs, setDebugLogs] = useState<ImageDebugLog[]>([]);

  // Batch evaluation state
  const [isBatchRunning, setIsBatchRunning] = useState<boolean>(false);
  const [batchProgress, setBatchProgress] = useState<{ current: number, total: number } | null>(null);
  const [batchSummary, setBatchSummary] = useState<PublicSampleBatchRunSummary | null>(null);

  const chatReport = useMemo(() => batchSummary ? buildBatchReportForChat(batchSummary) : null, [batchSummary]);
  const failuresReport = useMemo(() => batchSummary ? buildFailuresOnlyReport(batchSummary) : null, [batchSummary]);
  
  const chatReportStats = useMemo(() => {
    if (!chatReport) return null;
    return stringifyJsonArtifact(chatReport);
  }, [chatReport]);

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

  // Load debug logs on mount
  useEffect(() => {
    const existing = localStorage.getItem("image_experiment_debug_logs");
    if (existing) {
      try {
        setDebugLogs(JSON.parse(existing));
      } catch (e) {
        console.error("Failed to parse image debug logs", e);
      }
    }
  }, []);

  const saveDebugLog = (
    logMode: "drive" | "public",
    payload: any,
    responseRaw: any,
    success: boolean,
    errorMessage?: string
  ) => {
    try {
      const sanitizedResponse = sanitizeDebugResponseForLocalStorage(logMode, responseRaw, { storeRawOutputPreviewInDrive });
      const newLog: ImageDebugLog = {
        id: Math.random().toString(36).substring(2, 11),
        timestamp: new Date().toISOString(),
        mode: logMode,
        requestPayload: payload,
        responseRaw: sanitizedResponse,
        success,
        errorMessage
      };

      setDebugLogs(prevLogs => {
        const updated = [newLog, ...prevLogs];
        if (updated.length > 30) {
          updated.splice(30);
        }
        localStorage.setItem("image_experiment_debug_logs", JSON.stringify(updated));
        return updated;
      });
    } catch (e) {
      console.error("Failed to save log", e);
    }
  };

  const handleClearLogs = () => {
    localStorage.removeItem("image_experiment_debug_logs");
    setDebugLogs([]);
    onAddLog("info", "Image experiment debug records cleared");
  };

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
    localStorage.setItem("image_experiment_mode", mode);
  }, [mode]);

  useEffect(() => {
    localStorage.setItem("image_experiment_file_id", fileId);
  }, [fileId]);

  useEffect(() => {
    if (selectedSampleId) {
      localStorage.setItem("image_experiment_selected_sample_id", selectedSampleId);
    } else {
      localStorage.removeItem("image_experiment_selected_sample_id");
    }
  }, [selectedSampleId]);

  useEffect(() => {
    localStorage.setItem("image_experiment_model_name", modelName);
  }, [modelName]);

  useEffect(() => {
    if (mode === "public" && samples.length === 0) {
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
  }, [mode, samples.length, onAddLog, selectedSampleId]);

  const filteredSamples = samples;

  useEffect(() => {
    if (mode === "public" && samples.length > 0) {
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
  }, [filteredSamples, mode, samples.length, selectedSampleId]);

  const handleAnalyzeDrive = async () => {
    if (!fileId.trim()) {
      onAddLog("warn", "File ID is required");
      return;
    }
    
    setLoading(true);
    setResult(null);
    const payload = {
      fileId: fileId.trim(),
      modelName,
      includeRequestPreview: includePreview,
      jsonMode: config.json_mode,
      customInstruction: customInstruction.trim(),
      retryOnInvalidJson
    };

    try {
      const res = await fetch("/api/drive/debug/analyze-image", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      if (res.status === 401) {
        onSessionExpiry();
        saveDebugLog("drive", payload, { error: "Session expired (401)" }, false, "Session expired (401)");
        return;
      }

      let data;
      try {
        data = await res.json();
      } catch (e) {
        throw new Error("Failed to parse server response");
      }

      setResult(data);
      if (!res.ok) {
        onAddLog("error", "Image analysis failed", data.error || "Failed to analyze image");
        saveDebugLog("drive", payload, data, false, data.error || "Failed to analyze image");
      } else {
        onAddLog("success", "Image analyzed successfully");
        saveDebugLog("drive", payload, data, true);
      }
    } catch (err: any) {
      onAddLog("error", "Image analysis failed", err.message);
      saveDebugLog("drive", payload, null, false, err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAnalyzePublic = async () => {
    if (!selectedSampleId) {
      onAddLog("warn", "Please select a public sample.");
      return;
    }

    setLoading(true);
    setResult(null);
    const payload = {
      sampleId: selectedSampleId,
      modelName,
      includeRequestPreview: includePreview,
      jsonMode: config.json_mode,
      customInstruction: customInstruction.trim(),
      retryOnInvalidJson
    };

    try {
      const res = await fetch("/api/visual/public-samples/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });

      if (res.status === 401) {
        onSessionExpiry();
        saveDebugLog("public", payload, { error: "Session expired (401)" }, false, "Session expired (401)");
        return;
      }

      let data;
      try {
        data = await res.json();
      } catch (e) {
        throw new Error("Failed to parse server response");
      }

      setResult(data);
      if (!res.ok) {
        onAddLog("error", `[Image Analysis] Error: ${data.error || "Failed to analyze public sample"}`);
        saveDebugLog("public", payload, data, false, data.error || "Failed to analyze public sample");
        setSampleStatuses(prev => ({ ...prev, [selectedSampleId]: "failure" }));
      } else {
        onAddLog(data.success ? "success" : "warn", `[Image Analysis] Complete for sample ${selectedSampleId}`);
        saveDebugLog("public", payload, data, data.success);
        setSampleStatuses(prev => ({ ...prev, [selectedSampleId]: data.success ? "success" : "failure" }));
      }
    } catch (err: any) {
      onAddLog("error", `[Image Analysis] Error: ${err.message}`);
      saveDebugLog("public", payload, null, false, err.message);
      setSampleStatuses(prev => ({ ...prev, [selectedSampleId]: "failure" }));
    } finally {
      setLoading(false);
    }
  };

  const handleRunBatch = async () => {
    const targetSamples = samples.filter(s => selectedSampleIds[s.id]);
    if (targetSamples.length === 0) {
      onAddLog("warn", "実行対象のサンプルが選択されていません。");
      alert("実行対象のサンプルが選択されていません。チェックボックスで選択してください。");
      return;
    }

    setIsBatchRunning(true);
    setBatchSummary(null);
    setResult(null); // Clear single result
    const total = targetSamples.length;
    setBatchProgress({ current: 0, total });

    const items: PublicSampleBatchRunItem[] = [];
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

    const newStatuses = { ...sampleStatuses };

    for (let i = 0; i < total; i++) {
        const sample = targetSamples[i];
        setBatchProgress({ current: i + 1, total });
        try {
            const res = await fetch('/api/visual/public-samples/analyze', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                sampleId: sample.id,
                modelName: modelName,
                jsonMode: config.json_mode,
                retryOnInvalidJson: retryOnInvalidJson,
                includeRequestPreview: false, // Force false for batch
                customInstruction: customInstruction.trim()
              })
            });
            
            if (res.status === 401) {
              onSessionExpiry();
              throw new Error("Session expired (401)");
            }

            const data = await res.json();
            
            const item: PublicSampleBatchRunItem = {
              sampleId: sample.id,
              title: sample.title,
              success: data.success,
              qualityStatus: data.qualityStatus,
              qualityScore: data.qualityScore,
              qualityIssues: data.qualityIssues,
              analysisRun: data.analysisRun,
              parseDiagnostics: data.parseDiagnostics,
              generationDiagnostics: data.generationDiagnostics,
              inputDiagnostics: data.inputDiagnostics,
              failureKind: data.failureKind,
              error: data.error,
              responseRaw: data
            };

            if (data.success) {
                successCount++;
                newStatuses[sample.id] = "success";
                if (data.qualityStatus === 'valid') validCount++;
                if (data.qualityStatus === 'validLowQuality') validLowQualityCount++;
                
                // compute comparison
                const comp = evaluateSampleComparison(sample, data);
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
                if (data.failureKind === 'jsonParseError' || (data.parseDiagnostics && !data.parseDiagnostics.success && data.parseDiagnostics.attempts)) {
                    invalidJsonCount++;
                }
            }
            items.push(item);
        } catch (e: any) {
            failureCount++;
            reviewFailCount++;
            newStatuses[sample.id] = "failure";
            items.push({
               sampleId: sample.id,
               title: sample.title,
               success: false,
               error: e.message
            });
        }
        setSampleStatuses({ ...newStatuses });
    }

    const summary: PublicSampleBatchRunSummary = {
        runId: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        modelName,
        jsonMode: config.json_mode,
        retryOnInvalidJson,
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
        <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-100 text-indigo-600 rounded-lg">
              <ImageIcon className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-800">画像解析実験 (Visual Analysis RC Verification)</h2>
              <p className="text-[11px] text-slate-500">Test the visual analysis schema against Drive images or public samples.</p>
            </div>
          </div>
          <div className="flex items-center p-1 bg-slate-200 rounded-lg">
            <button
              onClick={() => { setMode("drive"); setResult(null); }}
              className={`px-3 py-1.5 text-xs font-bold rounded-md transition-colors ${mode === "drive" ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
            >
              Drive Image
            </button>
            <button
              onClick={() => { setMode("public"); setResult(null); }}
              className={`px-3 py-1.5 text-xs font-bold rounded-md transition-colors ${mode === "public" ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
            >
              Public Sample
            </button>
          </div>
        </div>
        <div className="p-5">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left side: Inputs */}
            <div className="lg:col-span-12 space-y-4">
              {mode === "drive" ? (
                <div className="flex flex-col gap-4">
                  <div className="space-y-1 w-full">
                    <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Drive File ID</label>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input
                        type="text"
                        placeholder="Google Drive Image File ID (e.g. 1A2B3C...)"
                        value={fileId}
                        onChange={(e) => setFileId(e.target.value)}
                        className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      />
                    </div>
                  </div>
                  <div className="space-y-1 w-full mt-2">
                    <label className="flex items-center gap-2 cursor-pointer group">
                      <input 
                        type="checkbox" 
                        checked={storeRawOutputPreviewInDrive} 
                        onChange={(e) => setStoreRawOutputPreviewInDrive(e.target.checked)}
                        className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                      />
                      <span className="text-[11px] text-slate-600 group-hover:text-slate-900 transition-colors flex items-center gap-1">
                        Store raw output preview in Drive debug logs
                        <Info className="w-3.5 h-3.5 text-slate-400" title="If unchecked, sensitive OCR text and JSON raw outputs are redacted when saved to localStorage." />
                      </span>
                    </label>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Quick Selection Actions & Thumbnail Grid Panel */}
                  <div className="flex flex-col gap-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                      <div>
                        <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                          サンプル画像選択パネル (Public Sample Panel)
                        </h3>
                        <p className="text-[10px] text-slate-500 mt-0.5">
                          チェックボックスで解析対象のサンプルを選択し、解析を実行してください。
                        </p>
                      </div>

                      <div className="flex flex-wrap gap-1.5 shrink-0">
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
                              <div className="w-8 h-8 rounded overflow-hidden border border-slate-200 bg-slate-100 shrink-0 relative flex items-center justify-center">
                                {thumbUrl ? (
                                  <img
                                    src={thumbUrl}
                                    alt={s.title}
                                    referrerPolicy="no-referrer"
                                    className="w-full h-full object-cover transition-transform group-hover:scale-105"
                                  />
                                ) : (
                                  <ImageIcon className="w-3.5 h-3.5 text-slate-400" />
                                )}
                              </div>

                              {/* Text info */}
                              <div className="min-w-0 flex-1 flex flex-col justify-center">
                                <span className={`font-bold leading-tight truncate text-[10.5px] block ${
                                  isHighlighted ? "text-indigo-900" : "text-slate-700"
                                }`} title={s.title}>
                                  {s.title}
                                </span>
                                <span className="text-[8.5px] text-slate-400 font-medium truncate block capitalize leading-none mt-0.5">
                                  {s.category}
                                </span>
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
              )}

              <div className="mt-4">
                {/* Custom Instruction section removed as requested */}
              </div>

              <div className="flex flex-col md:flex-row gap-4 items-end pt-2">
                <div className="flex flex-col gap-1 w-full md:w-auto flex-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">AI Model</label>
                  <select
                    value={modelName}
                    onChange={(e) => setModelName(e.target.value)}
                    className={`w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-slate-50 min-w-[220px] h-[38px] ${visualCap.recommendation === 'experimental' ? 'border-amber-300 ring-1 ring-amber-100' : ''}`}
                  >
                    <option value="gemini-3.5-flash">Gemini 3.5 Flash (Recommended)</option>
                    <option value="gemini-flash-latest">Gemini Flash Latest</option>
                    <option value="gemini-3.1-flash-lite">Gemini 3.1 Flash Lite (Recommended)</option>
                    <option value="gemini-1.5-pro">Gemini 1.5 Pro (Experimental)</option>
                    <option value="gemma-4-31b-it">Gemma 4 31B IT (Not Recommended)</option>
                    <option value="gemma-4-26b-a4b-it">Gemma 4 26B (Not Recommended)</option>
                  </select>
                  <div className="flex items-center justify-between px-1">
                    {visualCap.recommendation === 'recommended' ? (
                      <span className="text-[10px] text-emerald-600 font-bold flex items-center gap-1">
                        <CheckCircle className="w-3 h-3" /> Recommended
                      </span>
                    ) : (
                      <span className="text-[10px] text-amber-600 font-bold flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" /> Experimental for Vision
                      </span>
                    )}
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
                  <div className="flex items-center gap-1.5 h-auto sm:h-[38px] py-1 sm:py-0 px-2 relative">
                    <label className="flex items-center gap-2 cursor-pointer group whitespace-nowrap" title="Useful for prompted JSON models. Off by default so raw model stability can be evaluated.">
                      <input 
                        type="checkbox" 
                        checked={retryOnInvalidJson} 
                        onChange={(e) => setRetryOnInvalidJson(e.target.checked)}
                        className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                      />
                      <span className="text-[11px] text-slate-600 group-hover:text-slate-900 transition-colors">
                        Retry on invalid JSON
                      </span>
                    </label>
                  </div>
                </div>
                <div className="flex flex-col md:flex-row gap-2 w-full md:w-auto mt-4 md:mt-0">
                  {mode === "public" ? (
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
                  ) : (
                    <button
                      onClick={handleAnalyzeDrive}
                      disabled={loading || !fileId.trim()}
                      className="px-6 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2 transition-colors h-[38px] flex-1 md:flex-none justify-center whitespace-nowrap shadow-sm animate-in fade-in zoom-in-95 duration-150"
                    >
                      {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <ImageIcon className="w-4 h-4" />}
                      {loading ? "解析中..." : "解析実行"}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {batchSummary && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-4">
          <div className="flex flex-col gap-2 border-b border-slate-100 pb-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <Activity className="w-4 h-4 text-indigo-600" /> Batch Regression Summary
              </h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-2">
              {/* 1. ChatGPT Report Section */}
              <div className="p-3 rounded-lg border border-indigo-100 bg-indigo-50/50 flex flex-col justify-between space-y-2">
                <div>
                  <div className="text-[11px] font-bold text-indigo-900">ChatGPT Compact Report</div>
                  <p className="text-[9px] text-slate-500 mt-0.5 leading-tight">Optimized format for paste diagnostics (excludes large previews).</p>
                  {chatReportStats && (
                    <div className="text-[9px] font-mono text-indigo-700/80 mt-1">
                      Size: {chatReportStats.byteLength} bytes ({chatReportStats.charLength} chars) | Hash: {chatReportStats.hash}
                    </div>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleCopy(chatReportStats?.text || "", 'batch-report-chat')}
                    className="text-[10px] font-bold text-indigo-600 hover:text-indigo-700 flex items-center justify-center gap-1 bg-white hover:bg-indigo-50 px-2 py-1.5 rounded border border-indigo-200 shadow-sm flex-1"
                  >
                    {copied === 'batch-report-chat' ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                    {copied === 'batch-report-chat' ? "Copied" : "Copy"}
                  </button>
                  <button
                    onClick={() => handleDownload(chatReport, `visual-analysis-chat-report-${Date.now()}.json`, 'batch-report-chat-dl')}
                    className="text-[10px] font-bold text-indigo-600 hover:text-indigo-700 flex items-center justify-center gap-1 bg-white hover:bg-indigo-50 px-2 py-1.5 rounded border border-indigo-200 shadow-sm"
                    title="Download as JSON file"
                  >
                    {copied === 'batch-report-chat-dl' ? <Check className="w-3 h-3" /> : <Download className="w-3 h-3" />}
                  </button>
                </div>
              </div>

              {/* 2. Failures Only Section */}
              <div className="p-3 rounded-lg border border-red-100 bg-red-50/50 flex flex-col justify-between space-y-2">
                <div>
                  <div className="text-[11px] font-bold text-red-900">Failures Only JSON</div>
                  <p className="text-[9px] text-slate-500 mt-0.5 leading-tight">Only contains samples that failed generation or validation.</p>
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

              {/* 3. Full Batch Section (Download recommended) */}
              <div className="p-3 rounded-lg border border-slate-200 bg-slate-50 flex flex-col justify-between space-y-2">
                <div>
                  <div className="text-[11px] font-bold text-slate-900 flex items-center gap-1">
                    Full Batch JSON <span className="text-[9px] text-slate-400 font-normal">(Download Recommended)</span>
                  </div>
                  <p className="text-[9px] text-slate-500 mt-0.5 leading-tight">Full execution logs, input/output previews and diagnostic frames.</p>
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
                        {!item.success && <span className="block font-normal text-red-600 mt-0.5">{item.error || 'Failed'}</span>}
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
                            onClick={() => handleCopy(JSON.stringify(item, null, 2), `item-${idx}`)}
                            className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-slate-100 rounded transition-colors"
                            title="Copy full item JSON"
                          >
                             {copied === `item-${idx}` ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                          </button>
                          <button
                            onClick={() => handleDownload(item, `visual-analysis-sample-${item.sampleId}-${Date.now()}.json`, `item-dl-${idx}`)}
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
                          const detected = (result.visualAnalysis.visualInfo?.visibleElements || []).map((el: any) => el.label).filter(Boolean);
                          const comp = compareExpectedLabels(result.expectedMetadata, detected);
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

      {/* Debug Logs History Section */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden mt-6">
        <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-slate-100 text-slate-600 rounded-lg">
              <Terminal className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-800">画像解析デバッグ履歴 (Debug Records History)</h2>
              <p className="text-[11px] text-slate-500">
                ローカルストレージに保存された過去の画像解析リクエストと生の応答データの履歴です。
              </p>
            </div>
          </div>
          {debugLogs.length > 0 && (
            <button
              onClick={handleClearLogs}
              className="px-2.5 py-1.5 bg-rose-50 text-rose-600 hover:bg-rose-100 rounded-lg text-xs font-bold transition-colors flex items-center gap-1 border border-rose-100"
              type="button"
            >
              <Trash2 className="w-3.5 h-3.5" /> 履歴クリア
            </button>
          )}
        </div>

        <div className="p-4">
          {debugLogs.length === 0 ? (
            <div className="text-center py-8 text-slate-400">
              <Clock className="w-8 h-8 mx-auto text-slate-300 mb-2" />
              <p className="text-xs">保存されたデバッグ履歴はありません。解析を実行するとここに自動保存されます。</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2">
              {debugLogs.map((log) => (
                <DebugLogItem key={log.id} log={log} onAddLog={onAddLog} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

interface DebugLogItemProps {
  log: ImageDebugLog;
  onAddLog: ImageExperimentProps["onAddLog"];
}

const DebugLogItem: React.FC<DebugLogItemProps> = ({ log, onAddLog }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [copiedSection, setCopiedSection] = useState<"request" | "response" | "all" | null>(null);

  const handleCopyText = (text: string, section: "request" | "response" | "all") => {
    navigator.clipboard.writeText(text);
    setCopiedSection(section);
    setTimeout(() => setCopiedSection(null), 2000);
    onAddLog("success", `Copied debug ${section} to clipboard`);
  };

  const formattedTime = new Date(log.timestamp).toLocaleString();

  return (
    <div className={`border rounded-lg overflow-hidden transition-colors ${log.success ? 'border-slate-200 bg-white' : 'border-rose-200 bg-rose-50/10'}`}>
      {/* Header */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-4 py-3 bg-slate-50/50 hover:bg-slate-50 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-left transition-colors"
        type="button"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <span className={`w-2 h-2 rounded-full shrink-0 ${log.success ? 'bg-emerald-500' : 'bg-rose-500'}`} />
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] font-bold text-slate-700 uppercase px-1.5 py-0.5 bg-slate-100 rounded border border-slate-200 shrink-0">
                {log.mode === "drive" ? "Drive" : "Public"}
              </span>
              <span className="text-xs font-mono font-bold text-slate-800 truncate max-w-[200px]" title={log.mode === "drive" ? log.requestPayload.fileId : log.requestPayload.sampleId}>
                {log.mode === "drive" ? log.requestPayload.fileId : log.requestPayload.sampleId}
              </span>
              <span className="text-[10px] text-slate-500 font-mono">({log.requestPayload.modelName})</span>
            </div>
            <div className="text-[10px] text-slate-400 mt-1 flex items-center gap-1">
              <Clock className="w-3 h-3" />
              <span>{formattedTime}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0 self-end sm:self-auto">
          {log.errorMessage && (
            <span className="text-[10px] font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded border border-rose-100 truncate max-w-[150px]" title={log.errorMessage}>
              {log.errorMessage}
            </span>
          )}
          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase shrink-0 ${log.success ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
            {log.success ? "Success" : "Failed"}
          </span>
          {isOpen ? <ChevronUp className="w-4 h-4 text-slate-400 shrink-0" /> : <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />}
        </div>
      </button>

      {/* Expanded view */}
      {isOpen && (
        <div className="p-4 bg-white border-t border-slate-100 space-y-4 animate-in fade-in duration-200">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Request Payload */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                  <ArrowRight className="w-3.5 h-3.5 text-indigo-500" /> Request Payload (Sent)
                </span>
                <button
                  onClick={() => handleCopyText(JSON.stringify(log.requestPayload, null, 2), "request")}
                  className="text-[10px] font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-indigo-50"
                  type="button"
                >
                  {copiedSection === "request" ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                  {copiedSection === "request" ? "Copied" : "Copy"}
                </button>
              </div>
              <div className="bg-slate-950 p-3 rounded-lg border border-slate-850 overflow-x-auto">
                <pre className="text-[10px] text-slate-300 font-mono leading-relaxed">
                  {JSON.stringify(log.requestPayload, null, 2)}
                </pre>
              </div>
            </div>

            {/* Response Raw */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                  <Activity className="w-3.5 h-3.5 text-emerald-500" /> Raw Response (Received)
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleCopyText(JSON.stringify(log.responseRaw, null, 2), "response")}
                    className="text-[10px] font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-indigo-50"
                    type="button"
                  >
                    {copiedSection === "response" ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                    {copiedSection === "response" ? "Copied" : "Copy"}
                  </button>
                </div>
              </div>
              <div className="bg-slate-950 p-3 rounded-lg border border-slate-850 overflow-x-auto max-h-[300px] overflow-y-auto">
                {log.responseRaw ? (
                  <pre className="text-[10px] text-slate-300 font-mono leading-relaxed">
                    {JSON.stringify(log.responseRaw, null, 2)}
                  </pre>
                ) : (
                  <span className="text-slate-500 text-xs italic p-1 block">No response body (An error occurred before receiving response)</span>
                )}
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-1">
            <button
              onClick={() => handleCopyText(JSON.stringify(log, null, 2), "all")}
              className="text-[10px] font-bold text-slate-600 hover:text-slate-900 flex items-center gap-1 px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-md hover:bg-slate-100 transition-colors"
              type="button"
            >
              {copiedSection === "all" ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              {copiedSection === "all" ? "Entire Record Copied!" : "Copy Full Debug Record JSON"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
