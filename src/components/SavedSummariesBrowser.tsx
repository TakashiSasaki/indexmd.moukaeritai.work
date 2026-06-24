import React, { useState, useMemo } from 'react';
import { 
  FileText, Search, Filter, RefreshCw, Eye, Clipboard, Code, Check, 
  Folder, AlertTriangle, Play, HelpCircle, ChevronRight, FileDigit, Loader2
} from 'lucide-react';
import { getSummaryMetadataStatus } from '../lib/summaryMetadata';
import { SUMMARY_ANALYSIS_SCHEMA_VERSION } from '../lib/summaryAnalysisSchema';
import { SUMMARY_ANALYSIS_PROMPT_VERSION, SUMMARY_DEBUG_SYSTEM_INSTRUCTION_VERSION } from '../lib/promptSpecs';

interface SavedSummariesBrowserProps {
  savedSummaries: any[];
  loadingSaved: boolean;
  savedError: string | null;
  dirs: any[];
  fetchSavedSummaries: () => void;
  userId: string | undefined;
  setFileId: (id: string) => void;
  setInputMode: (mode: "drive" | "manual") => void;
  setActiveSubView: (view: "test-run" | "saved-browser") => void;
}

export const SavedSummariesBrowser: React.FC<SavedSummariesBrowserProps> = ({
  savedSummaries,
  loadingSaved,
  savedError,
  dirs,
  fetchSavedSummaries,
  setFileId,
  setInputMode,
  setActiveSubView,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [selectedDirId, setSelectedDirId] = useState<string>('');
  const [copiedIndexMd, setCopiedIndexMd] = useState(false);

  // Status computation memo
  const summariesWithStatus = useMemo(() => {
    return savedSummaries.map(item => {
      const status = getSummaryMetadataStatus({
        savedMetadata: item,
        currentSchemaVersion: SUMMARY_ANALYSIS_SCHEMA_VERSION,
        currentPromptVersion: SUMMARY_ANALYSIS_PROMPT_VERSION,
        currentSystemInstructionVersion: SUMMARY_DEBUG_SYSTEM_INSTRUCTION_VERSION,
        currentFileModifiedTime: item.modifiedTime // we assume no drift since we don't have fresh drive times here
      });
      return {
        ...item,
        computedStatus: status
      };
    });
  }, [savedSummaries]);

  // Unique document types list
  const docTypes = useMemo(() => {
    const typesSet = new Set<string>();
    savedSummaries.forEach(s => {
      if (s.structured?.documentTypes) {
        s.structured.documentTypes.forEach((t: string) => typesSet.add(t));
      }
    });
    return Array.from(typesSet);
  }, [savedSummaries]);

  // Filtered summaries list
  const filteredSummaries = useMemo(() => {
    return summariesWithStatus.filter(item => {
      // Search text match
      const text = `${item.fileName || ''} ${item.summary || ''} ${item.model || ''}`.toLowerCase();
      if (searchTerm && !text.includes(searchTerm.toLowerCase())) {
        return false;
      }

      // Status filter match
      if (statusFilter !== 'all') {
        if (item.computedStatus !== statusFilter) {
          return false;
        }
      }

      // Doc Type filter match
      if (typeFilter !== 'all') {
        if (!item.structured?.documentTypes?.includes(typeFilter)) {
          return false;
        }
      }

      return true;
    });
  }, [summariesWithStatus, searchTerm, statusFilter, typeFilter]);

  // Directory-wise index.md Auto-Generated code builder
  const generatedIndexMd = useMemo(() => {
    if (!selectedDirId) return '';
    const folder = dirs.find(d => d.drive_id === selectedDirId);
    if (!folder) return '';

    // Filter file summaries belonging to this directory
    const filesInFolder = summariesWithStatus.filter(item => item.parentId === selectedDirId);

    const nowIso = new Date().toISOString();
    const folderSummary = filesInFolder.length > 0 
      ? `このディレクトリには ${filesInFolder.length} 件の要約済み重要ドキュメントが配置されています。主要テーマは ${Array.from(new Set(filesInFolder.flatMap(f => f.structured?.topics || []))).slice(0, 5).join('、') || '一般事務'} です。`
      : `*このディレクトリには、現在システム上に保存されている要約ファイルがありません。要約テストを実行し、このフォルダを関連付けて保存してください。*`;

    const mdFilesText = filesInFolder.map(file => {
      const oneLine = file.structured?.oneLineSummary || file.summary || '要約情報なし';
      const topics = file.structured?.topics?.join(', ') || 'なし';
      const keywords = file.structured?.keywords?.join(', ') || 'なし';
      return `- **${file.fileName || '名称未設定ファイル'}** (${file.mimeType?.split('/').pop() || '不明'}) - ${oneLine}\n  *Topics: ${topics}, Keywords: ${keywords}*`;
    }).join('\n\n');

    return `<!-- AUTO_GENERATED_START -->
## AI Summary (生成日時: ${nowIso})
${folderSummary}

## Files
${mdFilesText || "*このディレクトリには直接配置された要約済みファイルが存在しません。*"}

## Subdirectories
*このディレクトリ配下のサブディレクトリ階層は走査データに基づき後ほど追加されます。*

<!-- formatVersion: 1.0.0, promptSpecVersion: ${SUMMARY_ANALYSIS_PROMPT_VERSION} -->
<!-- AUTO_GENERATED_END -->`;
  }, [selectedDirId, dirs, summariesWithStatus]);

  const handleCopyIndexMd = async () => {
    if (!generatedIndexMd) return;
    try {
      await navigator.clipboard.writeText(generatedIndexMd);
      setCopiedIndexMd(true);
      setTimeout(() => setCopiedIndexMd(false), 2000);
    } catch (err) {
      console.error(err);
    }
  };

  const handleSelectToTest = (item: any) => {
    setFileId(item.fileId);
    setInputMode("drive");
    setActiveSubView("test-run");
  };

  return (
    <div className="space-y-6">
      {/* Search and Filters panel */}
      <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <h3 className="font-semibold text-slate-800 flex items-center gap-2 text-base">
            <FileText className="w-5 h-5 text-indigo-600" />
            保存済み要約ブラウザ
          </h3>
          <button
            onClick={fetchSavedSummaries}
            disabled={loadingSaved}
            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded text-xs transition-all flex items-center justify-center gap-1.5 shadow-sm self-end sm:self-auto"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loadingSaved ? "animate-spin" : ""}`} />
            データを更新
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* Search Input */}
          <div className="relative">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
              <Search className="w-4 h-4 text-slate-400" />
            </span>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="ファイル名、要約内容、モデル..."
              className="w-full bg-slate-50 border border-slate-200 rounded-md pl-9 pr-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-800"
            />
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-slate-500 shrink-0">ステータス:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-md p-2 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-800"
            >
              <option value="all">すべて (All)</option>
              <option value="current">最新状態 (Current)</option>
              <option value="stale-schema">スキーマが古い (Stale Schema)</option>
              <option value="stale-prompt">プロンプトが古い (Stale Prompt)</option>
              <option value="stale-file">ファイル更新あり (Stale File)</option>
              <option value="invalid">無効データ (Invalid)</option>
            </select>
          </div>

          {/* Doc Type Filter */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-slate-500 shrink-0">分類:</span>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-md p-2 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-800"
            >
              <option value="all">すべてのドキュメント分類</option>
              {docTypes.map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Directory-wise Read-Only Preview Panel */}
      <div className="bg-indigo-950/5 border border-indigo-200/60 p-5 rounded-lg space-y-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Folder className="w-5 h-5 text-indigo-600" />
            <h4 className="font-semibold text-slate-800 text-sm">
              📁 ディレクトリ別 index.md プレビュー
            </h4>
            <span className="inline-flex items-center bg-indigo-100 text-indigo-800 text-[10px] px-2 py-0.5 rounded border border-indigo-200 font-bold">
              読込専用デモ (Read-Only)
            </span>
          </div>
          <p className="text-xs text-slate-500">
            スキャンされたディレクトリを選択すると、該当フォルダに保存された要約データから、将来生成される予定の `index.md` ファイルのレイアウトをローカルプレビューします（Driveファイルへの書き込みは行いません）。
          </p>
        </div>

        <div className="max-w-md">
          <select
            value={selectedDirId}
            onChange={(e) => setSelectedDirId(e.target.value)}
            className="w-full bg-white border border-slate-200 rounded-md p-2 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-800"
          >
            <option value="">-- ディレクトリを選択して要約をプレビュー --</option>
            {dirs.map((dir) => {
              const fileCount = summariesWithStatus.filter(item => item.parentId === dir.drive_id).length;
              return (
                <option key={dir.drive_id} value={dir.drive_id}>
                  {dir.path || dir.name} ({fileCount}件の要約ファイル)
                </option>
              );
            })}
          </select>
        </div>

        {selectedDirId && (
          <div className="space-y-3 mt-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                プレビュー表示: index.md 生成候補
              </span>
              <button
                onClick={handleCopyIndexMd}
                disabled={!generatedIndexMd}
                className={`px-2.5 py-1 text-xs rounded border transition-all flex items-center gap-1 font-bold ${
                  copiedIndexMd 
                    ? "bg-emerald-50 text-emerald-700 border-emerald-200" 
                    : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                }`}
              >
                {copiedIndexMd ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Clipboard className="w-3.5 h-3.5" />}
                {copiedIndexMd ? "コピーしました" : "Markdownをコピー"}
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Visual render (clean markdown mockup) */}
              <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm prose prose-sm max-w-none text-slate-800">
                <div className="border-b border-rose-100 bg-rose-50/50 p-2 rounded text-[10px] text-rose-700 font-bold mb-3 flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                  実ファイルへの影響はありません。これはFirestore内の要約から構築された読込専用プレビューです。
                </div>
                
                {/* Simulated Markdown Render */}
                {(() => {
                  const filesInFolder = summariesWithStatus.filter(item => item.parentId === selectedDirId);
                  return (
                    <div className="space-y-4">
                      <div>
                        <h2 className="text-sm font-extrabold text-slate-900 border-b border-slate-100 pb-1 flex items-center gap-1">
                          AI Summary
                        </h2>
                        <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                          {filesInFolder.length > 0 
                            ? `このディレクトリには ${filesInFolder.length} 件の要約済み重要ドキュメントが配置されています。主要テーマは ${Array.from(new Set(filesInFolder.flatMap(f => f.structured?.topics || []))).slice(0, 5).join('、') || '一般事務'} です。`
                            : "保存されている要約ファイルはありません。"}
                        </p>
                      </div>

                      <div>
                        <h2 className="text-sm font-extrabold text-slate-900 border-b border-slate-100 pb-1">
                          Files
                        </h2>
                        {filesInFolder.length > 0 ? (
                          <ul className="space-y-2 mt-2 list-none pl-0">
                            {filesInFolder.map(file => (
                              <li key={file.fileId} className="border-l-2 border-indigo-400 pl-3 py-1 bg-slate-50 rounded-r">
                                <span className="font-semibold text-xs text-indigo-950 block">{file.fileName}</span>
                                <span className="text-xs text-slate-600 leading-relaxed block mt-0.5">
                                  {file.structured?.oneLineSummary || file.summary}
                                </span>
                                <span className="text-[10px] text-slate-400 block mt-0.5">
                                  Topics: {file.structured?.topics?.slice(0, 3).join(', ') || 'なし'} | Keywords: {file.structured?.keywords?.slice(0, 3).join(', ') || 'なし'}
                                </span>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="text-xs text-slate-400 italic mt-1">直接配置された要約済みファイルはありません。</p>
                        )}
                      </div>

                      <div>
                        <h2 className="text-sm font-extrabold text-slate-900 border-b border-slate-100 pb-1">
                          Subdirectories
                        </h2>
                        <p className="text-xs text-slate-400 italic mt-1">サブディレクトリ構造は将来のインデックス処理で結合されます。</p>
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Source code block */}
              <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden flex flex-col h-full shadow-lg">
                <div className="bg-slate-800 px-3 py-2 border-b border-slate-700 flex items-center justify-between">
                  <span className="text-[10px] font-mono text-slate-400">index.md Markdown Source Code</span>
                </div>
                <textarea
                  readOnly
                  value={generatedIndexMd}
                  className="bg-slate-950 text-slate-300 font-mono text-xs p-4 focus:outline-none flex-1 min-h-[300px] leading-relaxed resize-none"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Summaries List Table */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 bg-slate-50/50 flex items-center justify-between">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider font-mono">
            Firestore 保存ドキュメント数: {filteredSummaries.length} / {savedSummaries.length}
          </span>
        </div>

        {loadingSaved ? (
          <div className="p-12 flex flex-col items-center justify-center gap-3">
            <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
            <p className="text-sm text-slate-500">保存済み要約データをロード中...</p>
          </div>
        ) : savedError ? (
          <div className="p-8 text-center space-y-2">
            <p className="text-rose-500 font-semibold text-sm">データの読み込みに失敗しました</p>
            <p className="text-xs text-slate-500">{savedError}</p>
          </div>
        ) : filteredSummaries.length === 0 ? (
          <div className="p-12 text-center space-y-2 text-slate-400">
            <HelpCircle className="w-8 h-8 mx-auto stroke-1" />
            <p className="text-sm font-semibold">保存済みの要約が見つかりません</p>
            <p className="text-xs">フィルター条件を変更するか、テスト runner で新しく要約を生成して保存してください。</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-100/70 border-b border-slate-200 text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                  <th className="px-5 py-3">ファイル名</th>
                  <th className="px-4 py-3">モデル / 日時</th>
                  <th className="px-4 py-3 text-center">ステータス</th>
                  <th className="px-4 py-3">分類/トピック</th>
                  <th className="px-5 py-3 text-right">アクション</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {filteredSummaries.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="px-5 py-3.5 max-w-xs">
                      <div className="flex flex-col gap-0.5">
                        <span className="font-semibold text-slate-800 truncate" title={item.fileName}>
                          {item.fileName || "不明なファイル"}
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono truncate select-all" title={item.fileId}>
                          ID: {item.fileId}
                        </span>
                        {item.parentId && (
                          <span className="text-[9px] text-indigo-600 font-bold bg-indigo-50 border border-indigo-100/50 px-1 py-0.5 rounded self-start mt-0.5">
                            📁 親フォルダ: {item.parentId.slice(0, 8)}...
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex flex-col gap-0.5">
                        <span className="font-mono text-[11px] text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200 self-start">
                          {item.model || "不明"}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          {item.generatedAt ? new Date(item.generatedAt).toLocaleString() : "不明"}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      {(() => {
                        switch (item.computedStatus) {
                          case "current":
                            return (
                              <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 text-[10px] px-2 py-0.5 rounded-full border border-emerald-200 font-bold">
                                最新 (Current)
                              </span>
                            );
                          case "stale-schema":
                            return (
                              <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-700 text-[10px] px-2 py-0.5 rounded-full border border-amber-200 font-bold" title="要約作成時のスキーマ設計が古い">
                                スキーマ古 (Stale)
                              </span>
                            );
                          case "stale-prompt":
                            return (
                              <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-700 text-[10px] px-2 py-0.5 rounded-full border border-amber-200 font-bold" title="システム指示またはプロンプトが最新ではありません">
                                プロンプト古 (Stale)
                              </span>
                            );
                          case "stale-file":
                            return (
                              <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-700 text-[10px] px-2 py-0.5 rounded-full border border-amber-200 font-bold" title="対象ファイルが更新されています">
                                更新あり (Stale)
                              </span>
                            );
                          case "invalid":
                            return (
                              <span className="inline-flex items-center gap-1 bg-rose-50 text-rose-700 text-[10px] px-2 py-0.5 rounded-full border border-rose-200 font-bold">
                                無効 (Invalid)
                              </span>
                            );
                          default:
                            return (
                              <span className="inline-flex items-center gap-1 bg-slate-100 text-slate-600 text-[10px] px-2 py-0.5 rounded-full border border-slate-200 font-bold">
                                不明 (Unknown)
                              </span>
                            );
                        }
                      })()}
                    </td>
                    <td className="px-4 py-3.5 max-w-xs">
                      <div className="flex flex-col gap-1">
                        <div className="flex flex-wrap gap-1">
                          {item.structured?.documentTypes?.slice(0, 2).map((t: string) => (
                            <span key={t} className="bg-slate-100 text-slate-600 text-[9px] px-1 py-0.5 rounded font-semibold border border-slate-200">
                              {t}
                            </span>
                          ))}
                        </div>
                        <span className="text-[10px] text-slate-500 leading-relaxed truncate" title={item.structured?.oneLineSummary || item.summary}>
                          {item.structured?.oneLineSummary || item.summary}
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <button
                        onClick={() => handleSelectToTest(item)}
                        className="px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 hover:text-indigo-800 font-bold rounded transition-colors text-[10px] inline-flex items-center gap-1 shadow-sm"
                      >
                        <Play className="w-3 h-3 text-indigo-600" />
                        テストランナーで開く
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
