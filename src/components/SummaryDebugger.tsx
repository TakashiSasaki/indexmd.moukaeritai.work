import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Settings, Play, FileText, Code, Loader2, FileDigit, Link as LinkIcon, FileSearch, RefreshCw, Clipboard, Check, XCircle, History, Trash2 } from 'lucide-react';
import { getDriveAuthHeaders } from '../lib/driveToken';
import { CompatibilityMatrix } from './CompatibilityMatrix';
import { ModelInfo, ValidationRecord, ExperimentHistoryRecord } from '../types';
import MODELS_INFO from '../data/models_info.json';

interface SummaryDebuggerProps {
  token: string | null;
  onSessionExpiry?: () => void;
}

const CACHE_KEY = 'gemini_sample_files_cache';
const SELECTED_FILE_ID_KEY = 'gemini_selected_file_id';
const SELECTED_MODEL_KEY = 'gemini_selected_model';

const MODELS = MODELS_INFO as ModelInfo[];

export function canGenerateSummary(inputMode: 'drive' | 'manual', fileId: string, manualText: string, loading: boolean): boolean {
  if (loading) return false;
  if (inputMode === 'drive') return !!fileId.trim();
  return !!manualText.trim();
}

export const SummaryDebugger: React.FC<SummaryDebuggerProps> = ({ token, onSessionExpiry }) => {
  const [inputMode, setInputMode] = useState<"drive" | "manual">("drive");
  const [manualText, setManualText] = useState("");
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
  const [refinedErrorText, setRefinedErrorText] = useState<string | null>(null);
  const [fullErrorText, setFullErrorText] = useState<string | null>(null);
  const [responseTitle, setResponseTitle] = useState<string | null>(null);
  const [errorViewTab, setErrorViewTab] = useState<'raw' | 'text'>('raw');
  const [usedModel, setUsedModel] = useState<string | null>(null);
  const [validationHistory, setValidationHistory] = useState<ValidationRecord[]>([]);
  const [experimentHistory, setExperimentHistory] = useState<ExperimentHistoryRecord[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [loadingExperimentHistory, setLoadingExperimentHistory] = useState(false);
  const [customPrompt, setCustomPrompt] = useState("");

  const currentMimeType = useMemo(() => {
    return samples.find(s => s.file.id === fileId)?.file.mimeType;
  }, [samples, fileId]);

  useEffect(() => {
    if (!currentMimeType) {
      setCustomPrompt("以下のファイル内容（最大5万文字のスニペット）を分析し、主な内容の要約を日本語で出力してください。");
      return;
    }
    const isBinary = currentMimeType.startsWith("image/") || currentMimeType === "application/pdf";
    if (isBinary) {
      setCustomPrompt("以下のファイル内容を分析し、何が記載・描写されているか要約してください。日本語で出力してください。");
    } else {
      setCustomPrompt("以下のファイル内容（最大5万文字のスニペット）を分析し、主な内容の要約を日本語で出力してください。");
    }
  }, [currentMimeType, fileId]);

  const handleCellClick = useCallback((selectedModelId: string, mimeType: string) => {
    // Select Model
    setModelName(selectedModelId);
    try {
      localStorage.setItem(SELECTED_MODEL_KEY, selectedModelId);
    } catch (e) {
      // Silent
    }

    // Find matching sample file
    const matchingSample = samples.find(s => {
      const fileMime = s.file.mimeType || "";
      if (mimeType === 'text') return fileMime.startsWith('text/') || fileMime === 'application/json';
      if (mimeType === 'image') return fileMime.startsWith('image/');
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
  }, [samples]);

  const fetchValidationHistory = async () => {
    try {
      setLoadingHistory(true);
      const res = await fetch('/api/validation-history');
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
      const res = await fetch('/api/experiment-history');
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
    if (!confirm("Are you sure you want to clear the local experiment history?")) return;
    try {
      setLoadingExperimentHistory(true);
      await fetch('/api/experiment-history/clear', { method: 'POST' });
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
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/<!--[\s\S]*?-->/g, ''); // remove comments

      const parser = new DOMParser();
      const doc = parser.parseFromString(cleanHtml, 'text/html');

      // 2. Remove any remaining noisy tags
      doc.querySelectorAll('style, script, svg, symbol, defs').forEach(el => el.remove());

      // 3. Fallback safely to textContent
      let fullText = doc.body?.textContent || doc.documentElement.textContent || "";
      
      // 4. Strip any remaining tags, normalize whitespace
      fullText = fullText
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      
      // Snippet for clipboard/preview
      const bodyTextSnippet = fullText.slice(0, 500);
      
      const title = doc.querySelector('title')?.textContent || null;
      let refined = "";
      if (title) refined += `[Title: ${title}] `;
      if (bodyTextSnippet) refined += bodyTextSnippet;
      
      return {
        refined: refined || null,
        fullText: fullText || null,
        title: title
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
        headers: getDriveAuthHeaders(token || "")
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 401) {
          console.warn("401 Unauthorized detected:", data);
          onSessionExpiry?.();
          throw new Error("認証の有効期限が切れました。自動的にログアウトしますので、再度ログインしてください。");
        }
        throw new Error(`API Error (${res.status}): ${data.error || "Unknown error"}`);
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

  const handleGenerate = async () => {
    if (inputMode === "drive" && !fileId.trim()) return;
    if (inputMode === "manual" && !manualText.trim()) return;
    
    setLoading(true);
    setResult(null);
    setError(null);
    setRawErrorResponse(null);
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
            ...getDriveAuthHeaders(token || "")
          },
          body: JSON.stringify({
            fileId: parsedId,
            modelName,
            customInstruction: customPrompt,
            outputMode,
          }),
        });
      } else {
        response = await fetch("/api/drive/debug/generate-manual-summary", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...getDriveAuthHeaders(token || "")
          },
          body: JSON.stringify({
            text: manualText,
            modelName,
            customInstruction: customPrompt,
            outputMode,
          }),
        });
      }

      const text = await response.text();
      
      if (!response.ok) {
        setRawErrorResponse(text);
        
        // Try to refine error text based on content type
        if (text.trim().startsWith('<') || text.toLowerCase().includes('<!doctype html>')) {
          const { refined, fullText, title } = extractTextFromHtml(text);
          setRefinedErrorText(refined);
          setFullErrorText(fullText);
          setResponseTitle(title);
        } else {
          try {
            // If it's JSON, try to extract the error message nicely
            const jsonObj = JSON.parse(text);
            const extractedText = jsonObj.error?.message || jsonObj.message || jsonObj.error || JSON.stringify(jsonObj, null, 2);
            setFullErrorText(typeof extractedText === 'string' ? extractedText : JSON.stringify(extractedText, null, 2));
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
           throw new Error("認証の有効期限が切れました。再度ログインしてください。");
        }
        
        let data;
        try {
          data = JSON.parse(text);
        } catch (e) {
          throw new Error(`Server returned non-JSON response (${response.status})`);
        }
        
        // Handle specific Gemini API or Proxy errors
        if (data && data.error) {
          if (typeof data.error === 'string' && data.error.includes("RESOURCE_EXHAUSTED")) {
            throw new Error("Gemini APIの利用制限に達しました。別のモデルをお試しください。");
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
        if (text.trim().startsWith('<') || text.toLowerCase().includes('<!doctype html>')) {
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
    const selectedFile = samples.find(s => s.file.id === fileId);
    const info = `
失敗
File: ${selectedFile?.file.name || 'Unknown'}
MIME: ${selectedFile?.file.mimeType || 'unknown'}
Model: ${usedModel || modelName}
Error: ${error}
${responseTitle ? `Page Title: ${responseTitle}\n` : ''}${refinedErrorText ? `Response Preview (Text): ${refinedErrorText.slice(0, 100)}${refinedErrorText.length > 100 ? '...' : ''}\n` : ''}Raw Response Preview: ${rawErrorResponse?.slice(0, 1000) || 'None'}
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
        document.execCommand('copy');
        textArea.remove();
        setErrorCopied(true);
        setTimeout(() => setErrorCopied(false), 2000);
      }
    } catch (err) {
      console.error('Failed to copy info:', err);
    }
  };

  const copyMetadata = async () => {
    if (!result) return;
    
    const lines = ["成功。"];
    if (result.metadata?.name) lines.push(`File: ${result.metadata.name}`);
    if (result.metadata?.mimeType) lines.push(`MIME: ${result.metadata.mimeType}`);
    lines.push(`Model: ${usedModel || modelName}`);
    if (result.summary) {
      const firstLine = result.summary.split('\n').map(l => l.trim()).filter(l => l.length > 0)[0];
      if (firstLine) {
        lines.push(`Summary First Line: ${firstLine}`);
      }
    }

    const text = lines.join('\n');
    
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
        document.execCommand('copy');
        textArea.remove();
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    } catch (err) {
      console.error('Failed to copy text: ', err);
      alert("クリップボードへのコピーに失敗しました。詳細: " + (err as Error).message);
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
          </div>
        ) : (
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">
              テスト用テキスト
              <span className="ml-2 text-xs text-rose-500 font-normal bg-rose-50 px-1.5 py-0.5 rounded border border-rose-100">※スキーマ評価専用</span>
            </label>
            <textarea
              value={manualText}
              onChange={(e) => setManualText(e.target.value)}
              placeholder="テスト用のテキストをここに貼り付けてください。"
              className="w-full h-32 bg-slate-50 border border-slate-200 rounded-md p-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
            />
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
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm' 
                    : `${model.pricing.freeTier ? 'bg-cyan-50/50 border-cyan-100 text-slate-600 hover:bg-cyan-50' : 'bg-white text-slate-400 border-slate-200'} hover:border-indigo-300 hover:text-indigo-600`
                }`}
              >
                <div className="flex items-center gap-1">
                  <span className="font-bold">{model.label}</span>
                  {model.primary && <span className={`text-[8px] uppercase px-1 rounded font-sans ${modelName === model.id ? 'bg-indigo-500' : 'bg-indigo-100 text-indigo-600'}`}>推奨</span>}
                </div>
                {model.description && (
                  <span className={`text-[8px] mt-0.5 ${modelName === model.id ? 'text-indigo-100' : 'text-slate-400'}`}>
                    {model.description}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Model Info Detail */}
        {MODELS.find(m => m.id === modelName) && (
          <div className="bg-slate-50 border border-slate-100 rounded-lg p-3 space-y-3">
            <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
              <div className="flex-1 space-y-2">
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">正式モデルID:</span>
                    <code className="text-[10px] bg-slate-200 px-1.5 py-0.5 rounded text-slate-700 font-mono">
                      {MODELS.find(m => m.id === modelName)?.apiIdentifier}
                    </code>
                  </div>
                  {MODELS.find(m => m.id === modelName)?.knowledgeCutOff && (
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">学習データ締切:</span>
                      <span className="text-[10px] font-bold text-slate-700">{MODELS.find(m => m.id === modelName)?.knowledgeCutOff}</span>
                    </div>
                  )}
                  {MODELS.find(m => m.id === modelName)?.releaseDate && (
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">リリース日:</span>
                      <span className="text-[10px] font-bold text-slate-700">{MODELS.find(m => m.id === modelName)?.releaseDate}</span>
                    </div>
                  )}
                </div>
                
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tight block">価格体系 (Paid Tier)</span>
                  <div className="flex gap-4">
                    <div>
                      <span className="text-[10px] text-slate-500 block">入力 (1M tkn)</span>
                      <span className="text-xs font-mono font-bold text-slate-700">{MODELS.find(m => m.id === modelName)?.pricing.inputPrice}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 block">出力 (1M tkn)</span>
                      <span className="text-xs font-mono font-bold text-slate-700">{MODELS.find(m => m.id === modelName)?.pricing.outputPrice}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 block">Free Tier</span>
                      <span className={`text-xs font-bold ${MODELS.find(m => m.id === modelName)?.pricing.freeTier ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {MODELS.find(m => m.id === modelName)?.pricing.freeTier ? 'あり' : 'なし'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tight block">対応モーダル</span>
                <div className="flex flex-wrap gap-1">
                  {MODELS.find(m => m.id === modelName)?.modalities.map((mod, i) => (
                    <span key={i} className="text-[9px] px-1.5 py-0.5 bg-white border border-slate-200 text-slate-600 rounded">
                      {mod}
                    </span>
                  ))}
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
              {fetchingSamples ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileSearch className="w-4 h-4" />}
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
                {fetchingSamples ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
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
                        localStorage.setItem(SELECTED_FILE_ID_KEY, sample.file.id);
                      } catch (e) {
                        // Silent
                      }
                    }}
                    className={`border text-[10px] sm:text-xs py-1.5 px-3 rounded-full flex items-center gap-2 transition-all text-left max-w-xs truncate ${
                      isSelected 
                        ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm' 
                        : 'bg-indigo-50 hover:bg-indigo-100 border-indigo-200 text-indigo-700'
                    }`}
                    title={sample.file.name}
                  >
                    <span className={`font-bold flex-shrink-0 ${isSelected ? 'text-indigo-100' : 'opacity-70'}`}>{sample.category}</span>
                    <span className="truncate">{sample.file.name}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Compatibility Matrix Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
            <Settings className="w-4 h-4 text-indigo-500" />
            モデル別ファイル形式対応状況 (検証マトリクス)
          </h3>
          <button
            onClick={fetchValidationHistory}
            disabled={loadingHistory}
            className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold text-slate-500 hover:text-indigo-600 bg-slate-100 hover:bg-indigo-50 rounded-md transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3 h-3 ${loadingHistory ? 'animate-spin' : ''}`} />
            更新
          </button>
        </div>
        <CompatibilityMatrix 
          history={validationHistory}
          currentModelId={modelName}
          currentMimeType={currentMimeType}
          onCellClick={handleCellClick}
        />

        <div className="mt-6 flex flex-col sm:flex-row sm:items-center gap-4">
          <label className="text-sm font-semibold text-slate-700">
            出力モード:
          </label>
          <div className="flex bg-slate-100 p-1 rounded-lg">
            <button
              onClick={() => setOutputMode("text")}
              className={`px-4 py-1.5 text-sm font-bold rounded-md transition-all ${outputMode === "text" ? "bg-white text-indigo-700 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
            >
              自由文要約
            </button>
            <button
              onClick={() => setOutputMode("structured")}
              className={`px-4 py-1.5 text-sm font-bold rounded-md transition-all ${outputMode === "structured" ? "bg-white text-indigo-700 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
            >
              構造化分析(JSON)
            </button>
          </div>
        </div>

        <div className="mt-6">
          <label className="block text-sm font-semibold text-slate-700 mb-1">
            カスタム要約指示
          </label>
          <p className="text-xs text-slate-500 mb-2">この指示はAPIレベルのsystemInstructionではなく、要約タスク用の追加指示として本文・メタデータと一緒に送信されます。</p>
          <textarea
            value={customPrompt}
            onChange={(e) => setCustomPrompt(e.target.value)}
            className="w-full h-24 p-3 bg-slate-50 border border-slate-200 rounded-md text-sm font-mono text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-colors resize-y"
            placeholder="プロンプトを入力してください"
          />
        </div>

        <button
          onClick={handleGenerate}
          disabled={loading || (inputMode === 'drive' ? !fileId.trim() : !manualText.trim())}
          className="w-full mt-2 flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold px-6 py-4 rounded-xl transition-all shadow-lg hover:shadow-indigo-500/20 active:scale-[0.98]"
        >
          {loading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              要約を生成中...
            </>
          ) : (
            <>
              <Play className="w-5 h-5" />
              要約を生成する
            </>
          )}
        </button>
      </div>

      {/* Experiment History Section */}
      <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
            <History className="w-4 h-4 text-indigo-500" />
            実験履歴 (Local Debug)
          </h3>
          <div className="flex gap-2">
            <button
              onClick={fetchExperimentHistory}
              disabled={loadingExperimentHistory}
              className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold text-slate-500 hover:text-indigo-600 bg-slate-100 hover:bg-indigo-50 rounded-md transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-3 h-3 ${loadingExperimentHistory ? 'animate-spin' : ''}`} />
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
                  <th className="p-2 border-b border-slate-200">Mode/Schema</th>
                  <th className="p-2 border-b border-slate-200">Status</th>
                  <th className="p-2 border-b border-slate-200">Action</th>
                </tr>
              </thead>
              <tbody className="text-xs text-slate-600">
                {experimentHistory.map((item) => (
                  <tr key={item.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="p-2 whitespace-nowrap">{new Date(item.timestamp).toLocaleTimeString()}</td>
                    <td className="p-2 max-w-[150px] truncate" title={item.inputLabel}>{item.inputLabel}</td>
                    <td className="p-2 whitespace-nowrap">{item.model}</td>
                    <td className="p-2 whitespace-nowrap">{item.outputMode} {item.schemaVersion ? `(${item.schemaVersion})` : ''}</td>
                    <td className="p-2 whitespace-nowrap">
                      {item.error ? (
                        <span className="text-rose-600 flex items-center gap-1"><XCircle className="w-3 h-3"/> Error</span>
                      ) : (
                        item.validationSuccess ? (
                          <span className="text-emerald-600 flex items-center gap-1"><Check className="w-3 h-3"/> Valid</span>
                        ) : (
                          <span className="text-amber-600 flex items-center gap-1"><XCircle className="w-3 h-3"/> Invalid</span>
                        )
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
                            summary: item.outputMode !== 'structured' ? (item.rawOutput || item.summary || "No summary (raw output not persisted)") : (item.structuredResult?.oneLineSummary || "No summary"),
                            rawText: item.rawOutput,
                            schemaVersion: item.schemaVersion,
                            error: item.error,
                            validationErrors: item.validationErrors,
                            structuredParseFailed: !item.parseSuccess,
                          });
                          setUsedModel(item.model);
                          setError(item.error || null);
                        }}
                        className="text-indigo-600 hover:underline"
                      >
                        表示
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-xs text-slate-500 py-4 text-center">履歴はありません。</p>
        )}
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
                {errorCopied ? <Check className="w-3 h-3 text-emerald-400" /> : <Clipboard className="w-3 h-3" />}
                {errorCopied ? 'コピーしました' : '失敗情報をコピー'}
              </button>
            </div>
          </div>
          <p className="text-rose-200/80 text-xs mb-4 font-mono break-all">{error}</p>
          
          {(error.includes("認証") || error.includes("401") || error.includes("UNAUTHENTICATED") || error.includes("Invalid Credentials")) && (
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
              <p className="text-xs text-rose-100 font-medium leading-relaxed italic">{refinedErrorText}</p>
            </div>
          )}

          {rawErrorResponse && (
            <div className="mt-4">
              <div className="flex items-center justify-between gap-4 mb-2 border-b border-rose-900/30 pb-0">
                <div className="flex items-center gap-0">
                  <button
                    onClick={() => setErrorViewTab('raw')}
                    className={`px-3 py-2 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all relative ${
                      errorViewTab === 'raw' 
                        ? 'text-rose-400' 
                        : 'text-rose-900/60 hover:text-rose-400'
                    }`}
                  >
                    <Code className="w-3 h-3" />
                    Raw Response
                    {errorViewTab === 'raw' && (
                      <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-rose-500 rounded-full" />
                    )}
                  </button>
                  <button
                    onClick={() => setErrorViewTab('text')}
                    className={`px-3 py-2 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all relative ${
                      errorViewTab === 'text' 
                        ? 'text-indigo-400' 
                        : 'text-indigo-900/60 hover:text-indigo-400'
                    }`}
                  >
                    <FileText className="w-3 h-3" />
                    Text Only
                    {errorViewTab === 'text' && (
                      <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-500 rounded-full" />
                    )}
                  </button>
                </div>
                
                <button
                  onClick={() => {
                    const content = errorViewTab === 'text' ? (fullErrorText || rawErrorResponse) : rawErrorResponse;
                    if (content) {
                      navigator.clipboard.writeText(content);
                      setErrorCopied(true);
                      setTimeout(() => setErrorCopied(false), 2000);
                    }
                  }}
                  className="px-2 py-1 text-[9px] text-rose-300/40 hover:text-rose-300 transition-colors uppercase font-bold flex items-center gap-1"
                >
                  {errorCopied ? <Check className="w-2.5 h-2.5 text-emerald-400" /> : <Clipboard className="w-2.5 h-2.5" />}
                  {errorCopied ? 'コピー' : 'コピー'}
                </button>
              </div>
              <div className="bg-black/40 rounded-b border-x border-b border-rose-900/30 p-3 overflow-x-auto max-h-[350px] custom-scrollbar">
                <pre className="text-[10px] font-mono text-rose-300/70 whitespace-pre-wrap break-words leading-relaxed">
                  {errorViewTab === 'text' ? (fullErrorText || rawErrorResponse) : rawErrorResponse}
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
                <p className="text-xs text-slate-100 mt-1 font-medium truncate max-w-[250px] sm:max-w-md" title={result.metadata.name}>
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
                     ? 'bg-emerald-900/40 text-emerald-400 border-emerald-800' 
                     : 'bg-slate-950 text-slate-400 border-slate-700 hover:text-white hover:border-slate-500'
                }`}
                title="メタデータをコピー"
              >
                {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Clipboard className="w-3 h-3" />}
                {copied ? 'コピーしました' : '情報をコピー'}
              </button>
            </div>
          </div>
          
          <div className="p-4 space-y-6">
            
            {result.outputMode === "structured" && result.structured ? (
              <div className="space-y-6">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                       <FileText className="w-4 h-4 text-emerald-400" />
                       index.md候補 (1行要約)
                    </h4>
                    <button
                      onClick={() => navigator.clipboard.writeText(result.structured.oneLineSummary)}
                      className="px-2 py-1 text-[9px] text-slate-400 hover:text-white transition-colors uppercase font-bold flex items-center gap-1 border border-slate-700 rounded bg-slate-800"
                    >
                      コピー
                    </button>
                  </div>
                  <div className="bg-slate-800/50 rounded-md p-4 border border-slate-700/50">
                    <p className="whitespace-pre-wrap text-emerald-50 leading-relaxed text-sm font-bold">
                      {result.structured.oneLineSummary}
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                     詳細な要約
                  </h4>
                  <div className="bg-slate-800/50 rounded-md p-4 border border-slate-700/50">
                    <p className="whitespace-pre-wrap text-slate-200 leading-relaxed text-sm">
                      {result.structured.detailedSummary}
                    </p>
                  </div>
                </div>

                {result.structured.title && (
                  <div className="space-y-2">
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">タイトル</h4>
                    <div className="bg-slate-800/50 rounded-md p-3 border border-slate-700/50 text-sm text-white">
                      {result.structured.title}
                      {result.structured.inferredTitle && <span className="ml-2 text-xs text-slate-400">(推論: {result.structured.inferredTitle})</span>}
                    </div>
                  </div>
                )}
                {!result.structured.title && result.structured.inferredTitle && (
                  <div className="space-y-2">
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">推論タイトル</h4>
                    <div className="bg-slate-800/50 rounded-md p-3 border border-slate-700/50 text-sm text-white">
                      {result.structured.inferredTitle}
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">分類情報</h4>
                    <div className="bg-slate-800/50 rounded-md p-3 border border-slate-700/50 text-xs text-slate-300 grid grid-cols-2 gap-2">
                      <div>種類: <span className="text-white font-medium">{result.structured.documentTypes?.join(", ")}</span></div>
                      <div>意図: <span className="text-white font-medium">{result.structured.documentIntent}</span></div>
                      <div>主言語: <span className="text-white font-medium">{result.structured.primaryLanguage}</span></div>
                      <div>言語リスト: <span className="text-white font-medium">{result.structured.languages?.join(", ")}</span></div>
                      <div className="col-span-2">信頼度: <span className="text-white font-medium">{result.structured.confidence ? (result.structured.confidence * 100).toFixed(1) : "-"}%</span></div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">トピック & キーワード</h4>
                    <div className="bg-slate-800/50 rounded-md p-3 border border-slate-700/50">
                      <div className="mb-2">
                        <div className="text-[10px] text-slate-500 mb-1">トピック:</div>
                        <div className="flex flex-wrap gap-1">
                          {result.structured.topics?.length > 0 ? result.structured.topics.map((t: string, i: number) => (
                            <span key={i} className="px-2 py-0.5 bg-indigo-900/50 border border-indigo-700/50 text-indigo-300 rounded text-[10px]">{t}</span>
                          )) : <span className="text-xs text-slate-500">なし</span>}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] text-slate-500 mb-1">キーワード:</div>
                        <div className="flex flex-wrap gap-1">
                          {result.structured.keywords?.length > 0 ? result.structured.keywords.map((kw: string, i: number) => (
                            <span key={i} className="px-2 py-0.5 bg-slate-700/50 border border-slate-600/50 text-slate-300 rounded text-[10px]">{kw}</span>
                          )) : <span className="text-xs text-slate-500">なし</span>}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">ドメイン分類 (Subject Areas)</h4>
                  <div className="bg-slate-800/50 rounded-md p-3 border border-slate-700/50 text-xs">
                    {result.structured.subjectAreas && Object.keys(result.structured.subjectAreas).length > 0 ? (
                      Object.keys(result.structured.subjectAreas).map((key) => (
                        <div key={key} className="mb-1 flex items-start">
                          <span className="text-slate-400 w-32 shrink-0">{key}:</span>
                          <span className="text-white">{result.structured.subjectAreas[key].join(", ")}</span>
                        </div>
                      ))
                    ) : (
                      <span className="text-slate-500">該当なし</span>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">固有表現</h4>
                    <div className="bg-slate-800/50 rounded-md p-3 border border-slate-700/50 text-xs">
                      {result.structured.namedEntities?.length > 0 ? (
                        <ul className="space-y-1">
                          {result.structured.namedEntities.map((ne: any, i: number) => (
                            <li key={i} className="flex"><span className="text-slate-500 w-24 shrink-0">{ne.type}:</span> <span className="text-slate-200">{ne.name}</span></li>
                          ))}
                        </ul>
                      ) : (
                        <span className="text-slate-500">なし</span>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">関係者 (Parties)</h4>
                    <div className="bg-slate-800/50 rounded-md p-3 border border-slate-700/50 text-xs">
                      {result.structured.parties?.length > 0 ? (
                        <ul className="space-y-1">
                          {result.structured.parties.map((pt: any, i: number) => (
                            <li key={i} className="flex"><span className="text-slate-500 w-20 shrink-0">{pt.role}:</span> <span className="text-slate-200">{pt.name} <span className="text-[10px] text-slate-500">({pt.kind})</span></span></li>
                          ))}
                        </ul>
                      ) : (
                        <span className="text-slate-500">なし</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">時間参照</h4>
                    <div className="bg-slate-800/50 rounded-md p-3 border border-slate-700/50 text-xs">
                      {result.structured.temporalReferences?.length > 0 ? (
                        <ul className="space-y-1">
                          {result.structured.temporalReferences.map((tr: any, i: number) => (
                            <li key={i} className="flex"><span className="text-slate-500 w-24 shrink-0">{tr.role}:</span> <span className="text-slate-200">{tr.date || "-"} <span className="text-[10px] text-slate-500">({tr.raw})</span></span></li>
                          ))}
                        </ul>
                      ) : (
                        <span className="text-slate-500">なし</span>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">金額</h4>
                    <div className="bg-slate-800/50 rounded-md p-3 border border-slate-700/50 text-xs">
                      {result.structured.monetaryAmounts?.length > 0 ? (
                        <ul className="space-y-1">
                          {result.structured.monetaryAmounts.map((ma: any, i: number) => (
                            <li key={i} className="flex"><span className="text-slate-500 w-24 shrink-0">{ma.role}:</span> <span className="text-slate-200">{ma.amount} {ma.currency} <span className="text-[10px] text-slate-500">({ma.raw})</span></span></li>
                          ))}
                        </ul>
                      ) : (
                        <span className="text-slate-500">なし</span>
                      )}
                    </div>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">リソース参照</h4>
                  <div className="bg-slate-800/50 rounded-md p-3 border border-slate-700/50">
                    {result.structured.resourceReferences?.length > 0 ? (
                      <ul className="list-disc pl-5 text-xs text-blue-400 space-y-1">
                        {result.structured.resourceReferences.map((rr: any, i: number) => (
                          <li key={i}>
                            <a href={rr.uri} target="_blank" rel="noreferrer" className="hover:underline break-all">{rr.uri}</a>
                            {rr.raw && rr.raw !== rr.uri && <span className="text-slate-500 ml-2">({rr.raw})</span>}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <span className="text-slate-500 text-xs">なし</span>
                    )}
                  </div>
                </div>

                {result.structured.warnings?.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-xs font-bold text-amber-500 uppercase tracking-wider">警告</h4>
                    <ul className="list-disc pl-5 text-xs text-amber-200 space-y-1 bg-amber-950/30 rounded-md p-3 border border-amber-900/50">
                      {result.structured.warnings.map((w: string, i: number) => (
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
                        onClick={() => navigator.clipboard.writeText(result.rawText || "")}
                        className="px-2 py-1 text-[9px] text-slate-400 hover:text-white transition-colors uppercase font-bold flex items-center gap-1 border border-slate-700 rounded bg-slate-800"
                      >
                        生テキスト(Raw)コピー
                      </button>
                      <button
                        onClick={() => navigator.clipboard.writeText(JSON.stringify(result.structured, null, 2))}
                        className="px-2 py-1 text-[9px] text-slate-400 hover:text-white transition-colors uppercase font-bold flex items-center gap-1 border border-slate-700 rounded bg-slate-800"
                      >
                        JSONコピー
                      </button>
                    </div>
                  </div>
                  <pre className="bg-black/50 p-3 rounded-md border border-slate-800 text-[10px] text-emerald-300 font-mono overflow-x-auto">
                    {JSON.stringify(result.structured, null, 2)}
                  </pre>
                </div>
              </div>
            ) : result.structuredParseFailed ? (
              <div className="space-y-4">
                <div className="p-4 bg-amber-950/30 border border-amber-900/50 rounded-lg shadow-lg">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-bold text-sm text-amber-400">構造化データの解析に失敗しました</h4>
                    <button
                      onClick={() => navigator.clipboard.writeText(result.rawText || "")}
                      className="px-2 py-1 text-[9px] text-amber-400 hover:text-white transition-colors uppercase font-bold flex items-center gap-1 border border-amber-800 rounded bg-amber-900/40"
                    >
                      失敗出力をコピー
                    </button>
                  </div>
                  <p className="text-amber-200 text-xs mb-2">{result.error}</p>
                  
                  {result.validationErrors && result.validationErrors.length > 0 && (
                    <div className="mb-4 space-y-1">
                      <h5 className="text-xs font-bold text-rose-400">バリデーションエラー:</h5>
                      <ul className="list-disc list-inside text-xs text-rose-300">
                        {result.validationErrors.map((err: string, i: number) => (
                          <li key={i}>{err}</li>
                        ))}
                      </ul>
                      <button
                        onClick={() => navigator.clipboard.writeText(result.validationErrors.join('\n'))}
                        className="mt-2 px-2 py-1 text-[9px] text-rose-400 hover:text-white transition-colors uppercase font-bold flex items-center gap-1 border border-rose-800 rounded bg-rose-900/40 inline-block"
                      >
                        エラー一覧をコピー
                      </button>
                    </div>
                  )}

                  <pre className="bg-black/40 p-3 rounded text-[10px] text-amber-300 font-mono overflow-x-auto whitespace-pre-wrap">
                    {result.rawText}
                  </pre>
                </div>
              </div>
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
                      <span className="font-medium text-slate-200 truncate" title={result.metadata?.name}>{result.metadata?.name}</span>
                    </div>
                     <div className="flex">
                      <span className="text-slate-500 w-24">MIME 形式:</span>
                      <span className="font-mono text-indigo-300">{result.metadata?.mimeType}</span>
                    </div>
                     <div className="flex">
                      <span className="text-slate-500 w-24">サイズ (Bytes):</span>
                      <span className="font-mono text-slate-300">{result.metadata?.size || "N/A"}</span>
                    </div>
                  </div>
               </div>
            </div>

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

          </div>
        </div>
      )}
      </div>
    </div>
  );
};
