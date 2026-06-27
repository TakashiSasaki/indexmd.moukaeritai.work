import React, { useState, useEffect, useMemo } from 'react';
import { Search, Image as ImageIcon, AlertCircle, CheckCircle, RefreshCw, Activity, Check, Copy, ExternalLink, Info, Trash2, Terminal, ChevronDown, ChevronUp, Clock, ArrowRight, HelpCircle } from 'lucide-react';
import { AppConfig } from '../types';
import { getVisualModelCapability } from '../lib/modelCapabilities';

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
  const [categoryFilter, setCategoryFilter] = useState<string>(() => {
    return localStorage.getItem("image_experiment_category_filter") || "all";
  });
  const [licenseFilter, setLicenseFilter] = useState<string>(() => {
    return localStorage.getItem("image_experiment_license_filter") || "all";
  });
  const [isLoadingSamples, setIsLoadingSamples] = useState(false);

  // Shared state
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [modelName, setModelName] = useState<string>(() => {
    return localStorage.getItem("image_experiment_model_name") || config.gemini_model || "gemini-3.5-flash";
  });
  const [copied, setCopied] = useState<string | null>(null);
  const [includePreview, setIncludePreview] = useState(false);
  const [customInstruction, setCustomInstruction] = useState<string>("");
  const [showPreviewHelp, setShowPreviewHelp] = useState(false);

  // Debug logs history state
  const [debugLogs, setDebugLogs] = useState<ImageDebugLog[]>([]);

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
      const newLog: ImageDebugLog = {
        id: Math.random().toString(36).substring(2, 11),
        timestamp: new Date().toISOString(),
        mode: logMode,
        requestPayload: payload,
        responseRaw,
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

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
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
    localStorage.setItem("image_experiment_category_filter", categoryFilter);
  }, [categoryFilter]);

  useEffect(() => {
    localStorage.setItem("image_experiment_license_filter", licenseFilter);
  }, [licenseFilter]);

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
        })
        .catch(err => onAddLog("error", "Failed to fetch public samples", err.message))
        .finally(() => setIsLoadingSamples(false));
    }
  }, [mode, samples.length, onAddLog, selectedSampleId]);

  const filteredSamples = samples.filter(s => {
    if (categoryFilter !== "all" && s.category !== categoryFilter) return false;
    if (licenseFilter !== "all" && s.licenseKind !== licenseFilter) return false;
    return true;
  });

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
      customInstruction: customInstruction.trim()
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

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to analyze image");
      }
      setResult(data);
      onAddLog("success", "Image analyzed successfully");
      saveDebugLog("drive", payload, data, true);
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
      customInstruction: customInstruction.trim()
    };

    try {
      const res = await fetch("/api/visual/public-samples/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });

      const data = await res.json();

      if (!res.ok) {
        if (res.status === 401) onSessionExpiry();
        throw new Error(data.error || "Failed to analyze public sample");
      }

      setResult(data);
      onAddLog(data.success ? "success" : "warn", `[Image Analysis] Complete for sample ${selectedSampleId}`);
      saveDebugLog("public", payload, data, data.success);
    } catch (err: any) {
      onAddLog("error", `[Image Analysis] Error: ${err.message}`);
      saveDebugLog("public", payload, null, false, err.message);
    } finally {
      setLoading(false);
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
            <div className="lg:col-span-8 space-y-4">
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
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <label className="block text-xs font-bold text-slate-700 mb-1">Category</label>
                      <select
                        value={categoryFilter}
                        onChange={e => setCategoryFilter(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                      >
                        <option value="all">All Categories</option>
                        {Array.from(new Set(samples.map(s => s.category))).map(cat => (
                          <option key={cat as string} value={cat as string}>{cat as string}</option>
                        ))}
                      </select>
                    </div>
                    <div className="flex-1">
                      <label className="block text-xs font-bold text-slate-700 mb-1">License</label>
                      <select
                        value={licenseFilter}
                        onChange={e => setLicenseFilter(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                      >
                        <option value="all">All Licenses</option>
                        <option value="publicDomain">Public Domain</option>
                        <option value="cc0">CC0</option>
                        <option value="ccBy">CC BY</option>
                        <option value="ccBySa">CC BY-SA</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Sample</label>
                    {filteredSamples.length > 0 ? (
                      <select
                        value={selectedSampleId}
                        onChange={e => setSelectedSampleId(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                      >
                        {filteredSamples.map(s => (
                          <option key={s.id} value={s.id}>{s.title} ({s.category})</option>
                        ))}
                      </select>
                    ) : (
                      <div className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-500 italic">
                        No samples match the selected filters.
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="mt-4">
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  カスタム指示・カスタムJSONスキーマ (任意)
                </label>
                <p className="text-[10px] text-slate-500 mb-2 leading-relaxed">
                  追加の指示や質問を送信できます。対応モデル(Gemini 3.5 Flash等)では、指示内にJSONスキーマオブジェクト(例: <code>{"{ \"type\": \"object\", \"properties\": ... }"}</code>)を含めることで、ネイティブの構造化レスポンススキーマとして自動認識され、その形状のJSONが出力されます。
                </p>
                <textarea
                  value={customInstruction}
                  onChange={(e) => setCustomInstruction(e.target.value)}
                  className="w-full h-24 p-3 bg-slate-50 border border-slate-200 rounded-md text-sm font-mono text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-colors resize-y placeholder-slate-400"
                  placeholder='プロンプトやJSONスキーマを入力してください (例: { "type": "object", "properties": { "caption": { "type": "string" } } })'
                />
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
                <div className="flex items-center gap-1.5 h-[38px] px-2 relative">
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
                    <div className="absolute top-full right-0 mt-1.5 w-64 bg-slate-800 text-white text-[11px] p-3 rounded-lg shadow-xl z-[99] leading-relaxed border border-slate-700 animate-in fade-in slide-in-from-top-1 duration-150">
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
                <button
                  onClick={mode === "drive" ? handleAnalyzeDrive : handleAnalyzePublic}
                  disabled={mode === "drive" ? loading || !fileId.trim() : loading || !selectedSampleId || isLoadingSamples}
                  className="px-6 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2 transition-colors h-[38px] w-full md:w-auto justify-center"
                >
                  {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <ImageIcon className="w-4 h-4" />}
                  {loading ? "解析中..." : "解析実行"}
                </button>
              </div>
            </div>

            {/* Right side: Real-time pre-analysis preview */}
            <div className="lg:col-span-4 flex flex-col justify-start">
              <label className="text-[10px] font-bold text-slate-400 uppercase mb-2 block ml-1">
                選択中の画像プレビュー (Selected Preview)
              </label>
              <div className="bg-slate-50 rounded-xl border border-slate-200 p-3 flex flex-col items-center justify-center min-h-[180px] h-full overflow-hidden">
                {mode === "drive" ? (
                  debouncedFileId ? (
                    <div className="w-full flex justify-center max-h-48 overflow-hidden rounded-lg">
                      <ImagePreview fileId={debouncedFileId} token={token} />
                    </div>
                  ) : (
                    <div className="text-center text-slate-400 p-4 space-y-2">
                      <ImageIcon className="w-8 h-8 mx-auto text-slate-300" />
                      <p className="text-xs">DriveのファイルIDを入力するとプレビューが表示されます</p>
                    </div>
                  )
                ) : (
                  selectedSampleId ? (
                    <div className="w-full">
                      <PublicSamplePreview sampleId={selectedSampleId} />
                    </div>
                  ) : (
                    <div className="text-center text-slate-400 p-4 space-y-2">
                      <ImageIcon className="w-8 h-8 mx-auto text-slate-300" />
                      <p className="text-xs">サンプル画像を選択してください</p>
                    </div>
                  )
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {result && (
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

            <div className="bg-slate-50 rounded-lg p-3 border border-slate-200 flex items-center justify-between">
              <div className="flex flex-wrap items-center gap-4 text-[11px]">
                <div className="flex items-center gap-1 text-slate-500">
                  <Activity className="w-3.5 h-3.5" />
                  <span>Model: <span className="font-bold text-slate-700">{result.usedModelName}</span></span>
                </div>
                <div className="flex items-center gap-1 text-slate-500">
                  <Info className="w-3.5 h-3.5" />
                  <span>Execution: <span className="font-bold text-slate-700">{result.effectiveStructuredExecutionMode}</span></span>
                </div>
                <div className="flex items-center gap-1 text-slate-500">
                  <Check className="w-3.5 h-3.5" />
                  <span>Provider: <span className="font-bold text-slate-700">{result.providerFamily}</span></span>
                </div>
              </div>
              <button
                onClick={() => handleCopy(JSON.stringify(result.visualAnalysis, null, 2), 'all')}
                className="text-[11px] font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
              >
                {copied === 'all' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {copied === 'all' ? "Copied!" : "Copy Result JSON"}
              </button>
            </div>

            {isPublicResult && result.expectedMetadata && (
              <div className="bg-indigo-50/50 border border-indigo-100 p-4 rounded-xl space-y-4">
                <h4 className="text-xs font-bold text-indigo-900 uppercase tracking-wider flex items-center gap-2">
                  <Activity className="w-4 h-4 text-indigo-600" /> Expected vs Detected Schema Comparison
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
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
                        <span className={`font-mono font-semibold ${result.expectedMetadata.imageKind === result.visualAnalysis.visualInfo?.imageKind ? 'text-emerald-600' : 'text-amber-600'}`}>
                          {result.visualAnalysis.visualInfo?.imageKind || 'none'}
                        </span>
                      </div>
                      {result.expectedMetadata.imageKind === result.visualAnalysis.visualInfo?.imageKind ? (
                        <span className="text-[10px] text-emerald-600 font-bold flex items-center gap-1 mt-1">
                          <CheckCircle className="w-3 h-3" /> Exact Match
                        </span>
                      ) : (
                        <span className="text-[10px] text-amber-500 font-bold flex items-center gap-1 mt-1">
                          <AlertCircle className="w-3 h-3" /> Diverged
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Element Categories Comparison */}
                  <div className="bg-white p-3 rounded-lg border border-indigo-100/80 space-y-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Categories Coverage</span>
                    <div className="space-y-1.5 mt-1">
                      <div className="flex flex-wrap gap-1">
                        <span className="text-slate-400 block text-[10px] w-full">Expected Categories:</span>
                        {result.expectedMetadata.elementCategories?.map((cat: string) => {
                          const detected = (result.visualAnalysis.visualInfo?.visibleElements || [])
                            .some((el: any) => el.category === cat);
                          return (
                            <span key={cat} className={`px-1.5 py-0.5 rounded text-[9px] font-mono ${detected ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-50 text-slate-400 border border-slate-200'}`}>
                              {cat} {detected && "✓"}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Visible Labels Comparison */}
                  <div className="bg-white p-3 rounded-lg border border-indigo-100/80 space-y-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Key Labels Match</span>
                    <div className="space-y-1.5 mt-1">
                      <div className="flex flex-wrap gap-1">
                        <span className="text-slate-400 block text-[10px] w-full">Expected Labels:</span>
                        {result.expectedMetadata.visibleElementLabels?.map((lbl: string) => {
                          const detected = (result.visualAnalysis.visualInfo?.visibleElements || [])
                            .some((el: any) => el.label?.toLowerCase() === lbl.toLowerCase());
                          return (
                            <span key={lbl} className={`px-1.5 py-0.5 rounded text-[9px] ${detected ? 'bg-indigo-50 text-indigo-700 border border-indigo-100' : 'bg-slate-50 text-slate-400 border border-slate-200'}`}>
                              {lbl} {detected && "✓"}
                            </span>
                          );
                        }) || <span className="text-slate-400 italic">No labels checklist</span>}
                      </div>
                    </div>
                  </div>
                </div>
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
                                    {el.evidence && <span className="text-[10px] text-slate-500 italic">Evidence: {el.evidence}</span>}
                                    {!el.attributes?.length && !el.evidence && <span className="text-slate-300">-</span>}
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
