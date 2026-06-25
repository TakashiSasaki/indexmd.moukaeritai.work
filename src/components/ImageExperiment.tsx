import React, { useState } from 'react';
import { Search, Image as ImageIcon, AlertCircle, CheckCircle, RefreshCw, Activity, Check } from 'lucide-react';
import { AppConfig } from '../types';

interface ImageExperimentProps {
  token: string;
  config: AppConfig;
  onAddLog: (level: "info"|"success"|"warn"|"error", msg: string, details?: string) => void;
  onSessionExpiry: () => void;
}

export default function ImageExperiment({ token, config, onAddLog, onSessionExpiry }: ImageExperimentProps) {
  const [fileId, setFileId] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [modelName, setModelName] = useState(config.gemini_model);

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
            <select
              value={modelName}
              onChange={(e) => setModelName(e.target.value)}
              className="px-3 py-2 border border-slate-300 rounded-lg text-sm bg-slate-50"
            >
              <option value="gemini-3.5-flash">Gemini 3.5 Flash</option>
              <option value="gemini-flash-latest">Gemini Flash Latest</option>
              <option value="gemma-4-31b-it">Gemma 4 31B IT</option>
            </select>
            <button
              onClick={handleAnalyze}
              disabled={loading || !fileId.trim()}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2 transition-colors"
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
              </h3>
              <p className="text-xs text-slate-500">{result.metadata?.mimeType} • {result.qualityStatus}</p>
            </div>
            <div className="flex items-center gap-2">
              <span className={`px-2 py-1 text-[10px] font-bold uppercase rounded border ${result.success ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : 'bg-red-50 text-red-600 border-red-200'}`}>
                Schema: {result.success ? "VALID" : "INVALID"}
              </span>
              <span className={`px-2 py-1 text-[10px] font-bold uppercase rounded border ${result.qualityStatus === 'validLowQuality' ? 'bg-amber-50 text-amber-600 border-amber-200' : result.qualityStatus === 'valid' ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : 'bg-red-50 text-red-600 border-red-200'}`}>
                Quality: {result.qualityStatus}
              </span>
            </div>
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-6">
                <div>
                  <h4 className="text-xs font-bold text-slate-500 uppercase mb-2">Caption & Description</h4>
                  <div className="bg-slate-50 rounded-lg p-3 text-sm">
                    <p className="font-bold text-slate-800">{result.visualAnalysis.summary?.caption}</p>
                    <p className="text-slate-600 mt-2 text-xs">{result.visualAnalysis.summary?.description}</p>
                  </div>
                </div>

                <div>
                  <h4 className="text-xs font-bold text-slate-500 uppercase mb-2 flex items-center gap-2">
                    <Activity className="w-4 h-4" /> Visual Info
                  </h4>
                  <div className="bg-slate-50 rounded-lg p-3 text-sm space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Image Kind:</span>
                      <span className="font-mono text-indigo-600 font-bold">{result.visualAnalysis.visualInfo?.imageKind} ({(result.visualAnalysis.visualInfo?.imageKindConfidence * 100).toFixed(1)}%)</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block mb-1">Scene Description:</span>
                      <p className="text-slate-700 text-xs">{result.visualAnalysis.visualInfo?.sceneDescription}</p>
                    </div>
                  </div>
                </div>

                {result.visualAnalysis.visualInfo?.uncertainties?.length > 0 && (
                  <div>
                    <h4 className="text-xs font-bold text-slate-500 uppercase mb-2">Uncertainties</h4>
                    <ul className="list-disc pl-5 text-xs text-slate-600">
                      {result.visualAnalysis.visualInfo.uncertainties.map((u: string, i: number) => <li key={i}>{u}</li>)}
                    </ul>
                  </div>
                )}
              </div>

              <div className="space-y-6">
                <div>
                  <h4 className="text-xs font-bold text-slate-500 uppercase mb-2">Visible Elements</h4>
                  <div className="bg-slate-50 rounded-lg overflow-hidden border border-slate-200">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-100 text-slate-500 uppercase">
                        <tr>
                          <th className="px-3 py-2">Label</th>
                          <th className="px-3 py-2">Category</th>
                          <th className="px-3 py-2 text-right">Conf</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {(result.visualAnalysis.visualInfo?.visibleElements || []).map((el: any, idx: number) => (
                          <tr key={idx} className="hover:bg-slate-100">
                            <td className="px-3 py-2 font-medium text-slate-700">{el.label}</td>
                            <td className="px-3 py-2 font-mono text-[10px] text-indigo-600">{el.category}</td>
                            <td className="px-3 py-2 text-right text-slate-500">{(el.confidence * 100).toFixed(0)}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div>
                  <h4 className="text-xs font-bold text-slate-500 uppercase mb-2">Visible Text</h4>
                  <div className="bg-slate-50 rounded-lg overflow-hidden border border-slate-200">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-100 text-slate-500 uppercase">
                        <tr>
                          <th className="px-3 py-2">Text</th>
                          <th className="px-3 py-2 text-right">Conf</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {(result.visualAnalysis.visualInfo?.visibleText || []).map((txt: any, idx: number) => (
                          <tr key={idx} className="hover:bg-slate-100">
                            <td className="px-3 py-2 text-slate-700 whitespace-pre-wrap">{txt.text}</td>
                            <td className="px-3 py-2 text-right text-slate-500">{(txt.confidence * 100).toFixed(0)}%</td>
                          </tr>
                        ))}
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
