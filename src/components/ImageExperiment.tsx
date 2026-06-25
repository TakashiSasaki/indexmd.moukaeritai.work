import React, { useState, useEffect } from 'react';
import { Search, Image as ImageIcon, AlertCircle, CheckCircle, RefreshCw, Activity, Check, Copy, ExternalLink, Info } from 'lucide-react';
import { AppConfig } from '../types';
import { getVisualModelCapability } from '../lib/modelCapabilities';

interface ImageExperimentProps {
  token: string;
  config: AppConfig;
  onAddLog: (level: "info"|"success"|"warn"|"error", msg: string, details?: string) => void;
  onSessionExpiry: () => void;
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
  const [fileId, setFileId] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [modelName, setModelName] = useState(config.gemini_model);
  const [copied, setCopied] = useState<string | null>(null);

  const visualCap = getVisualModelCapability(modelName);

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  const handleAnalyze = async () => {
    if (!fileId.trim()) {
      onAddLog("warn", "File ID is required");
      return;
    }
    
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/drive/debug/analyze-image", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          fileId: fileId.trim(),
          modelName,
          includeRequestPreview: true
        })
      });

      if (res.status === 401) {
        onSessionExpiry();
        return;
      }

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to analyze image");
      }
      setResult(data);
      onAddLog("success", "Image analyzed successfully");
    } catch (err: any) {
      onAddLog("error", "Image analysis failed", err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-100 text-indigo-600 rounded-lg">
              <ImageIcon className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-800">画像解析実験 (Visual Analysis)</h2>
              <p className="text-[11px] text-slate-500">Google Drive上の画像ファイルを対象に、視覚的インデックス用メタデータを抽出します。</p>
            </div>
          </div>
        </div>
        <div className="p-5 space-y-4">
          <div className="flex items-center gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Google Drive Image File ID (e.g. 1A2B3C...)"
                value={fileId}
                onChange={(e) => setFileId(e.target.value)}
                className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
            <div className="flex flex-col gap-1">
              <select
                value={modelName}
                onChange={(e) => setModelName(e.target.value)}
                className={`px-3 py-2 border border-slate-300 rounded-lg text-sm bg-slate-50 min-w-[180px] ${visualCap.recommendation === 'experimental' ? 'border-amber-300 ring-1 ring-amber-100' : ''}`}
              >
                <option value="gemini-3.5-flash">Gemini 3.5 Flash (Recommended)</option>
                <option value="gemini-flash-latest">Gemini Flash Latest</option>
                <option value="gemini-1.5-pro">Gemini 1.5 Pro</option>
                <option value="gemma-4-31b-it">Gemma 4 31B IT (Experimental)</option>
              </select>
              {visualCap.recommendation === 'experimental' && (
                <span className="text-[10px] text-amber-600 font-bold flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" /> Experimental for Vision
                </span>
              )}
            </div>
            <button
              onClick={handleAnalyze}
              disabled={loading || !fileId.trim()}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2 transition-colors h-[38px]"
            >
              {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <ImageIcon className="w-4 h-4" />}
              {loading ? "解析中..." : "解析実行"}
            </button>
          </div>
        </div>
      </div>

      {result && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
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
                <span>Size: {(result.metadata?.size / 1024).toFixed(1)} KB</span>
                {result.metadata?.modifiedTime && (
                  <>
                    <span>•</span>
                    <span>Modified: {new Date(result.metadata.modifiedTime).toLocaleString()}</span>
                  </>
                )}
              </p>
            </div>
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
            <div className="flex items-center gap-4 text-[11px]">
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
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <div className="lg:col-span-4 space-y-6">
                <div>
                  <h4 className="text-xs font-bold text-slate-500 uppercase mb-2">Image Preview</h4>
                  <ImagePreview fileId={result.metadata?.id} token={token} />
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
                    <p className="text-slate-600 mt-2 text-xs">{result.visualAnalysis.summary?.description}</p>
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
                    <table className="w-full text-left text-[11px]">
                      <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200">
                        <tr>
                          <th className="px-3 py-2">Label</th>
                          <th className="px-3 py-2">Category</th>
                          <th className="px-3 py-2">Attributes</th>
                          <th className="px-3 py-2 text-right">Confidence</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {(result.visualAnalysis.visualInfo?.visibleElements || []).map((el: any, idx: number) => (
                          <tr key={idx} className="hover:bg-slate-50 transition-colors">
                            <td className="px-3 py-2">
                              <div className="flex items-center gap-1.5">
                                <span className="font-bold text-slate-800">{el.label}</span>
                                {el.primary && <span className="px-1 bg-indigo-100 text-indigo-700 rounded-[2px] text-[8px] font-black uppercase">Primary</span>}
                                {el.count > 1 && <span className="text-slate-400 font-normal">x{el.count}</span>}
                              </div>
                            </td>
                            <td className="px-3 py-2">
                              <span className="px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded text-[10px] font-mono">{el.category}</span>
                            </td>
                            <td className="px-3 py-2 text-slate-500 italic">
                              {el.attributes?.join(", ") || "-"}
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
                          <th className="px-3 py-2">Lang</th>
                          <th className="px-3 py-2 text-right">Confidence</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {(result.visualAnalysis.visualInfo?.visibleText || []).map((txt: any, idx: number) => (
                          <tr key={idx} className="hover:bg-slate-50 transition-colors">
                            <td className="px-3 py-2 text-slate-800 font-mono whitespace-pre-wrap leading-relaxed">{txt.text}</td>
                            <td className="px-3 py-2 text-slate-500 uppercase font-mono text-[9px]">{txt.language || "-"}</td>
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
          )}

          <div className="pt-4 border-t border-slate-100">
             <h4 className="text-xs font-bold text-slate-500 uppercase mb-2">Raw JSON Response</h4>
             <pre className="bg-slate-900 text-slate-300 p-4 rounded-lg text-[10px] font-mono overflow-auto max-h-96">
               {JSON.stringify(result.visualAnalysis || result, null, 2)}
             </pre>
          </div>
        </div>
      )}
    </div>
  );
}
