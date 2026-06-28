import React, { useState, useEffect, useCallback } from 'react';
import { RefreshCw, Server, HardDrive, Cpu, Activity, Clock, Trash2, ShieldAlert } from 'lucide-react';
import { CacheMetricsResponse } from '../lib/cacheMetrics';
import { formatBytes, formatDate } from '../lib/cacheMetricsFormat';
import { summarizeCacheStats, formatPercent } from '../lib/cacheStatsFormat';

const CACHE_STATS_REFRESH_INTERVAL_MS = 60_000;

export const CacheStatsTab: React.FC = () => {
  const [stats, setStats] = useState<CacheMetricsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [resetting, setResetting] = useState(false);
  const [lastFetchedAt, setLastFetchedAt] = useState<Date | null>(null);

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch('/api/cache/stats');
      if (!res.ok) {
        throw new Error(`Failed to fetch stats: ${res.status}`);
      }
      const data = await res.json();
      setStats(data);
      setLastFetchedAt(new Date());
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, CACHE_STATS_REFRESH_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [fetchStats]);

  const handleResetMetrics = async () => {
    if (!confirm('メモリ上のキャッシュ統計情報をリセットしますか？\n（※ディスク上のキャッシュファイルは削除されません）')) {
      return;
    }
    setResetting(true);
    try {
      const res = await fetch('/api/cache/stats/reset', { method: 'POST' });
      if (!res.ok) throw new Error('Reset failed');
      await fetchStats();
    } catch (err: any) {
      alert(`Error resetting metrics: ${err.message}`);
    } finally {
      setResetting(false);
    }
  };

  if (loading && !stats) {
    return (
      <div className="p-8 flex justify-center items-center h-full">
        <RefreshCw className="w-8 h-8 text-slate-300 animate-spin" />
      </div>
    );
  }

  if (error && !stats) {
    return (
      <div className="p-8">
        <div className="bg-rose-50 text-rose-600 p-4 rounded-md border border-rose-200">
          エラーが発生しました: {error}
        </div>
      </div>
    );
  }

  if (!stats) return null;

  const summary = summarizeCacheStats(stats);

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
      
      {/* Header & Actions */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <Activity className="w-6 h-6 text-indigo-600" />
            Cache / Runtime
          </h2>
          <p className="text-sm text-slate-500 mt-1 hidden md:block">
            サーバープロセスの稼働状況とキャッシュ効率の観測
          </p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <button
            onClick={fetchStats}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-3 py-1.5 text-sm font-medium text-slate-600 bg-white border border-slate-300 rounded-md hover:bg-slate-50 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            更新
          </button>
          <button
            onClick={handleResetMetrics}
            disabled={resetting}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-3 py-1.5 text-sm font-medium text-rose-600 bg-white border border-rose-200 rounded-md hover:bg-rose-50 transition-colors disabled:opacity-50"
            title="統計情報のみをリセット（ファイルは消えません）"
          >
            {resetting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
            <span className="hidden sm:inline">統計リセット</span>
            <span className="sm:hidden">リセット(統計)</span>
          </button>
        </div>
      </div>

      {/* Mobile: Notes (Collapsed) */}
      <details className="md:hidden bg-amber-50 border border-amber-200 rounded-lg group">
        <summary className="p-3 text-sm text-amber-800 font-semibold cursor-pointer flex items-center gap-2 list-none [&::-webkit-details-marker]:hidden">
          <ShieldAlert className="w-4 h-4 text-amber-600" />
          Observability Only (タップで詳細)
        </summary>
        <div className="p-3 pt-0 text-amber-800 border-t border-amber-200/50">
          <ul className="list-disc pl-5 space-y-1 text-[12px] opacity-90 mt-2">
            <li>統計値はプロセス起動時からの累計です。</li>
            <li>リセットしてもファイルは削除されません。</li>
            <li>キャッシュ内容は表示されません。</li>
          </ul>
        </div>
      </details>

      {/* Desktop: Notes */}
      <div className="hidden md:flex bg-amber-50 border border-amber-200 rounded-lg p-4 gap-3 text-sm text-amber-800">
        <ShieldAlert className="w-5 h-5 text-amber-600 flex-shrink-0" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8">
          <div>
            <p className="font-semibold mb-1">Observability & Lifecycle</p>
            <ul className="list-disc pl-5 space-y-1 text-[13px] opacity-90">
              <li>ヒット率（Hit Rate）などの統計値は、サーバープロセス起動時からの累計です。</li>
              <li>統計リセットを実行しても、ディスク上のキャッシュファイル自体は削除されません。</li>
              <li>プライバシー保護のため、キャッシュされたファイルの内容は表示されません。</li>
            </ul>
          </div>
          <div className="border-l border-amber-200/50 pl-6">
            <p className="font-semibold mb-1 text-amber-900">Cache Clearing Coverage</p>
            <ul className="list-disc pl-5 space-y-1 text-[13px] opacity-90 text-amber-700">
              <li>設定画面の「キャッシュクリア」は <code className="bg-amber-100 px-1 rounded text-amber-900">scan</code>, <code className="bg-amber-100 px-1 rounded text-amber-900">snippets</code>, <code className="bg-amber-100 px-1 rounded text-amber-900">summaries</code> が対象です。</li>
              <li><code className="bg-amber-100 px-1 rounded text-amber-900 text-[11px]">experimentHistory</code> と <code className="bg-amber-100 px-1 rounded text-amber-900 text-[11px]">publicSampleImages</code> は永続性を優先し、通常のクリア対象から除外されています。</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Mobile: Compact Summary Grid */}
      <div className="md:hidden grid grid-cols-2 gap-3">
        <div className="bg-white p-2.5 rounded-lg border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Hit Rate</div>
          <div className="text-xl font-black text-indigo-600">{formatPercent(summary.overallHitRate)}</div>
        </div>
        <div className="bg-white p-2.5 rounded-lg border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Hits / Misses</div>
          <div className="text-lg font-bold text-slate-800">{summary.totalHits} / {summary.totalMisses}</div>
        </div>
        <div className="bg-white p-2.5 rounded-lg border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Disk / Entries</div>
          <div className="text-lg font-bold text-slate-800">{formatBytes(summary.totalBytes)}</div>
          <div className="text-[10px] text-slate-400 mt-0.5">{summary.totalEntries} entries</div>
        </div>
        <div className="bg-white p-2.5 rounded-lg border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Errors</div>
          <div className={`text-lg font-bold ${summary.totalErrors > 0 ? 'text-rose-600' : 'text-slate-800'}`}>
            {summary.totalErrors}
          </div>
        </div>
        <div className="bg-white p-2.5 rounded-lg border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Uptime</div>
          <div className="text-lg font-bold text-slate-800">{stats.uptimeHuman}</div>
        </div>
        <div className="bg-white p-2.5 rounded-lg border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Updated</div>
          <div className="text-sm font-bold text-slate-800">
            {lastFetchedAt ? lastFetchedAt.toLocaleTimeString() : '-'}
          </div>
        </div>
      </div>

      {/* Desktop: Runtime & Overall Stats Grid */}
      <div className="hidden md:grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Uptime */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-2 text-slate-500 mb-2">
            <Clock className="w-4 h-4" />
            <span className="text-xs font-bold uppercase tracking-wider">Server Uptime</span>
          </div>
          <div className="text-2xl font-black text-slate-800">{stats.uptimeHuman}</div>
          <div className="text-[10px] text-slate-400 mt-1" title={stats.serverStartedAt}>
            Started: {formatDate(stats.serverStartedAt)}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">
            (Container uptime の近似値です)
          </div>
        </div>

        {/* Node Process */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-2 text-slate-500 mb-2">
            <Cpu className="w-4 h-4" />
            <span className="text-xs font-bold uppercase tracking-wider">Node Process</span>
          </div>
          <div className="text-lg font-bold text-slate-800">PID: {stats.process.pid}</div>
          <div className="text-xs text-slate-500 mt-1">
            {stats.process.nodeVersion} ({stats.process.platform})
          </div>
          <div className="text-xs text-slate-500 mt-0.5">
            Heap: {formatBytes(stats.process.memoryUsage.heapUsed)} / {formatBytes(stats.process.memoryUsage.heapTotal)}
          </div>
        </div>

        {/* Overall Hit Rate */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-2 text-slate-500 mb-2">
            <Activity className="w-4 h-4" />
            <span className="text-xs font-bold uppercase tracking-wider">Overall Hit Rate</span>
          </div>
          <div className="text-2xl font-black text-indigo-600">
            {formatPercent(summary.overallHitRate)}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            {summary.totalHits} hits / {summary.totalMisses} misses
          </div>
        </div>
        
        {/* Overall Disk */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-2 text-slate-500 mb-2">
            <HardDrive className="w-4 h-4" />
            <span className="text-xs font-bold uppercase tracking-wider">Disk Usage</span>
          </div>
          <div className="text-2xl font-black text-slate-800">
            {formatBytes(summary.totalBytes)}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            {summary.totalEntries} entries
          </div>
        </div>

        {/* Bypasses */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-2 text-slate-500 mb-2">
            <Activity className="w-4 h-4 opacity-50" />
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Total Bypasses</span>
          </div>
          <div className="text-2xl font-black text-slate-600">
            {summary.totalBypasses}
          </div>
          <div className="text-xs text-slate-400 mt-1">
            Force refresh / skip count
          </div>
        </div>
      </div>

      {/* Mobile: Node Process & Memory Details (Collapsed) */}
      <details className="md:hidden bg-white border border-slate-200 rounded-lg group shadow-sm">
        <summary className="p-3 text-sm text-slate-700 font-semibold cursor-pointer flex items-center gap-2 list-none [&::-webkit-details-marker]:hidden">
          <Cpu className="w-4 h-4 text-slate-500" />
          Node Process & Memory Details (タップで詳細)
        </summary>
        <div className="p-3 pt-0 border-t border-slate-100">
          <div className="text-xs text-slate-600 mt-2 space-y-1">
            <div><span className="font-semibold">PID:</span> {stats.process.pid}</div>
            <div><span className="font-semibold">Version:</span> {stats.process.nodeVersion} ({stats.process.platform})</div>
            <div><span className="font-semibold">Heap Used:</span> {formatBytes(stats.process.memoryUsage.heapUsed)}</div>
            <div><span className="font-semibold">Heap Total:</span> {formatBytes(stats.process.memoryUsage.heapTotal)}</div>
            <div><span className="font-semibold">RSS:</span> {formatBytes(stats.process.memoryUsage.rss)}</div>
            <div><span className="font-semibold">Started At:</span> {formatDate(stats.serverStartedAt)}</div>
          </div>
        </div>
      </details>

      {/* Mobile: Cache Age Range Details (Collapsed) */}
      <details className="md:hidden bg-white border border-slate-200 rounded-lg group shadow-sm">
        <summary className="p-3 text-sm text-slate-700 font-semibold cursor-pointer flex items-center gap-2 list-none [&::-webkit-details-marker]:hidden">
          <Clock className="w-4 h-4 text-slate-500" />
          Cache Age Range Details (タップで詳細)
        </summary>
        <div className="p-3 pt-0 border-t border-slate-100">
          <div className="text-xs text-slate-600 mt-2 space-y-2">
            {Object.entries(stats.caches).map(([type, c]: [string, any]) => (
              <div key={type} className="border-b border-slate-100 last:border-none pb-2 last:pb-0">
                <div className="font-mono font-bold text-slate-700 mb-1">{type}</div>
                {c.entryCount > 0 ? (
                  <div className="grid grid-cols-2 gap-1 text-[11px] text-slate-500 pl-2">
                    <div><span className="font-semibold text-slate-400">Oldest:</span> {formatDate(c.oldestMtime)}</div>
                    <div><span className="font-semibold text-slate-400">Newest:</span> {formatDate(c.newestMtime)}</div>
                  </div>
                ) : (
                  <div className="text-slate-400 pl-2 text-[11px]">Empty</div>
                )}
              </div>
            ))}
          </div>
        </div>
      </details>

      {/* Mobile: Per-Cache Cards */}
      <div className="md:hidden space-y-2">
        <h3 className="font-bold text-slate-700 flex items-center gap-2 text-xs">
          <Server className="w-4 h-4 text-slate-500" />
          Cache Breakdown
        </h3>
        {Object.entries(stats.caches).map(([type, c]: [string, any]) => (
          <div key={type} className="bg-white p-2.5 rounded-lg border border-slate-200 shadow-sm flex flex-col gap-1 text-[11px]">
            <div className="flex justify-between items-center">
              <div className="flex flex-col gap-0.5">
                <span className="font-mono font-bold text-slate-800">{type}</span>
                <div className="flex gap-1">
                  {c.enabled !== undefined && (
                    <span className={`text-[8px] px-1 rounded font-bold uppercase ${c.enabled ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-400'}`}>
                      {c.enabled ? 'On' : 'Off'}
                    </span>
                  )}
                  {c.policyVersion && (
                    <span className="text-[8px] px-1 rounded bg-indigo-50 text-indigo-600 font-mono">
                      {c.policyVersion}
                    </span>
                  )}
                </div>
              </div>
              <span className="font-black text-indigo-600">{formatPercent(c.hitRate)}</span>
            </div>
            <div className="flex justify-between items-center text-slate-500">
              <span>{c.hits}H {c.misses}M {c.bypasses > 0 && `(${c.bypasses}B)`} • {c.entryCount} ent ({formatBytes(c.totalBytes)})</span>
              <div className="flex gap-1">
                {c.sharedInFlight > 0 && <span className="text-emerald-500 font-bold">S:{c.sharedInFlight}</span>}
                {c.errors > 0 && <span className="text-rose-600 font-bold">⚠️{c.errors}</span>}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Desktop: Per-Cache Table */}
      <div className="hidden md:block bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 bg-slate-50 flex items-center gap-2">
          <Server className="w-5 h-5 text-slate-500" />
          <h3 className="font-bold text-slate-700">Cache Breakdown</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-white border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                <th className="p-3 pl-4 font-semibold">Type / Status</th>
                <th className="p-3 font-semibold text-right">Hit Rate</th>
                <th className="p-3 font-semibold text-right">Hits</th>
                <th className="p-3 font-semibold text-right">Misses</th>
                <th className="p-3 font-semibold text-right text-indigo-400">Writes</th>
                <th className="p-3 font-semibold text-right text-amber-400">Bypass</th>
                <th className="p-3 font-semibold text-right text-rose-400">Errors</th>
                <th className="p-3 font-semibold text-right text-emerald-400">Shared</th>
                <th className="p-3 font-semibold text-right border-l border-slate-100">Entries</th>
                <th className="p-3 font-semibold text-right">Size</th>
                <th className="p-3 pr-4 font-semibold">Last Activity / Age Range</th>
              </tr>
            </thead>
            <tbody className="text-sm divide-y divide-slate-100">
              {Object.entries(stats.caches).map(([type, c]: [string, any]) => (
                <tr key={type} className="hover:bg-slate-50 transition-colors">
                  <td className="p-3 pl-4">
                    <div className="font-mono font-bold text-slate-800">{type}</div>
                    <div className="flex gap-2 mt-0.5">
                      {c.enabled !== undefined && (
                        <span className={`text-[9px] px-1 rounded font-bold uppercase ${c.enabled ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-400'}`}>
                          {c.enabled ? 'Enabled' : 'Disabled'}
                        </span>
                      )}
                      {c.policyVersion && (
                        <span className="text-[9px] px-1 rounded bg-indigo-50 text-indigo-600 font-medium font-mono">
                          {c.policyVersion}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="p-3 text-right font-black text-indigo-600">
                    {formatPercent(c.hitRate)}
                  </td>
                  <td className="p-3 text-right text-slate-600 font-medium">{c.hits.toLocaleString()}</td>
                  <td className="p-3 text-right text-slate-600 font-medium">{c.misses.toLocaleString()}</td>
                  <td className="p-3 text-right text-slate-400">{c.writes.toLocaleString()}</td>
                  <td className="p-3 text-right text-slate-400">{c.bypasses.toLocaleString()}</td>
                  <td className="p-3 text-right">
                    {c.errors > 0 ? <span className="text-rose-500 font-black">{c.errors.toLocaleString()}</span> : <span className="text-slate-300">0</span>}
                  </td>
                  <td className="p-3 text-right text-emerald-500 font-medium">
                    {c.sharedInFlight > 0 ? c.sharedInFlight.toLocaleString() : <span className="text-slate-300">0</span>}
                  </td>
                  
                  <td className="p-3 text-right border-l border-slate-100 text-slate-700 font-bold">{c.entryCount.toLocaleString()}</td>
                  <td className="p-3 text-right text-slate-700">{formatBytes(c.totalBytes)}</td>
                  
                  <td className="p-3 pr-4 text-[10px] text-slate-500 min-w-[140px]">
                    <div className="space-y-1">
                      {c.lastHitAt && (
                        <div className="flex justify-between border-b border-slate-50 pb-0.5">
                          <span className="opacity-40">Last Hit:</span>
                          <span className="font-mono text-indigo-400">{formatDate(c.lastHitAt).split(' ')[1]}</span>
                        </div>
                      )}
                      {c.lastMissAt && (
                        <div className="flex justify-between border-b border-slate-50 pb-0.5">
                          <span className="opacity-40">Last Miss:</span>
                          <span className="font-mono text-slate-400">{formatDate(c.lastMissAt).split(' ')[1]}</span>
                        </div>
                      )}
                      {c.lastWriteAt && (
                        <div className="flex justify-between border-b border-slate-50 pb-0.5">
                          <span className="opacity-40">Last Write:</span>
                          <span className="font-mono text-emerald-400">{formatDate(c.lastWriteAt).split(' ')[1]}</span>
                        </div>
                      )}
                      {c.entryCount > 0 && (
                        <div className="pt-1 flex gap-2">
                           <span className="opacity-40">Age:</span>
                           <span>{formatDate(c.oldestMtime).split(' ')[0]} ... {formatDate(c.newestMtime).split(' ')[0]}</span>
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
};
