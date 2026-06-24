import React, { useState, useEffect, useCallback } from 'react';
import { RefreshCw, Server, HardDrive, Cpu, Activity, Clock, Trash2, ShieldAlert } from 'lucide-react';
import { CacheMetricsResponse } from '../lib/cacheMetrics';

const formatBytes = (bytes: number) => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

const formatDate = (isoString: string | null) => {
  if (!isoString) return '-';
  return new Date(isoString).toLocaleString();
};

export const CacheStatsTab: React.FC = () => {
  const [stats, setStats] = useState<CacheMetricsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [resetting, setResetting] = useState(false);

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch('/api/cache/stats');
      if (!res.ok) {
        throw new Error(`Failed to fetch stats: ${res.status}`);
      }
      const data = await res.json();
      setStats(data);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 15000);
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

  let totalHits = 0;
  let totalMisses = 0;
  Object.values(stats.caches).forEach((c: any) => {
    totalHits += c.hits;
    totalMisses += c.misses;
  });
  const overallHitRate = totalHits + totalMisses > 0 ? totalHits / (totalHits + totalMisses) : 0;

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
      
      {/* Header & Actions */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <Activity className="w-6 h-6 text-indigo-600" />
            Cache & Runtime Stats
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            サーバープロセスの稼働状況とキャッシュ効率の観測
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={fetchStats}
            className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-slate-600 bg-white border border-slate-300 rounded-md hover:bg-slate-50 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            更新
          </button>
          <button
            onClick={handleResetMetrics}
            disabled={resetting}
            className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-rose-600 bg-white border border-rose-200 rounded-md hover:bg-rose-50 transition-colors disabled:opacity-50"
            title="統計情報のみをリセット（ファイルは消えません）"
          >
            {resetting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
            統計リセット
          </button>
        </div>
      </div>

      {/* Warning/Notes */}
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex gap-3 text-sm text-amber-800">
        <ShieldAlert className="w-5 h-5 text-amber-600 flex-shrink-0" />
        <div>
          <p className="font-semibold mb-1">Observability Only</p>
          <ul className="list-disc pl-5 space-y-1 text-[13px] opacity-90">
            <li>ヒット率（Hit Rate）などの統計値は、サーバープロセス起動時からの累計です。</li>
            <li>統計リセットを実行しても、ディスク上のキャッシュファイル自体は削除されません。</li>
            <li>プライバシー保護のため、キャッシュされたファイルの内容は表示されません。</li>
          </ul>
        </div>
      </div>

      {/* Runtime & Overall Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        
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
            {(overallHitRate * 100).toFixed(1)}%
          </div>
          <div className="text-xs text-slate-500 mt-1">
            {totalHits} hits / {totalMisses} misses
          </div>
        </div>
        
        {/* Overall Disk */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-2 text-slate-500 mb-2">
            <HardDrive className="w-4 h-4" />
            <span className="text-xs font-bold uppercase tracking-wider">Disk Usage</span>
          </div>
          <div className="text-2xl font-black text-slate-800">
            {formatBytes(Object.values(stats.caches as any).reduce((acc: number, c: any) => acc + c.totalBytes, 0) as number)}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            {Object.values(stats.caches as any).reduce((acc: number, c: any) => acc + c.entryCount, 0) as number} entries
          </div>
        </div>
      </div>

      {/* Per-Cache Breakdown */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 bg-slate-50 flex items-center gap-2">
          <Server className="w-5 h-5 text-slate-500" />
          <h3 className="font-bold text-slate-700">Cache Breakdown</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-white border-b border-slate-200 text-xs font-bold text-slate-500 uppercase tracking-wider">
                <th className="p-3 pl-4 font-semibold">Type</th>
                <th className="p-3 font-semibold text-right">Hit Rate</th>
                <th className="p-3 font-semibold text-right">Hits</th>
                <th className="p-3 font-semibold text-right">Misses</th>
                <th className="p-3 font-semibold text-right">Writes</th>
                <th className="p-3 font-semibold text-right">Errors</th>
                <th className="p-3 font-semibold text-right border-l border-slate-100">Entries</th>
                <th className="p-3 font-semibold text-right">Size</th>
                <th className="p-3 pr-4 font-semibold">Age Range</th>
              </tr>
            </thead>
            <tbody className="text-sm divide-y divide-slate-100">
              {Object.entries(stats.caches).map(([type, c]: [string, any]) => (
                <tr key={type} className="hover:bg-slate-50 transition-colors">
                  <td className="p-3 pl-4 font-mono font-medium text-slate-800">{type}</td>
                  <td className="p-3 text-right font-medium text-indigo-600">
                    {(c.hitRate * 100).toFixed(1)}%
                  </td>
                  <td className="p-3 text-right text-slate-600">{c.hits}</td>
                  <td className="p-3 text-right text-slate-600">{c.misses}</td>
                  <td className="p-3 text-right text-slate-600">{c.writes}</td>
                  <td className="p-3 text-right text-slate-600">{c.errors > 0 ? <span className="text-rose-500">{c.errors}</span> : '0'}</td>
                  
                  <td className="p-3 text-right border-l border-slate-100 text-slate-700">{c.entryCount}</td>
                  <td className="p-3 text-right text-slate-700">{formatBytes(c.totalBytes)}</td>
                  
                  <td className="p-3 pr-4 text-xs text-slate-500">
                    {c.entryCount > 0 ? (
                      <div>
                        <div><span className="opacity-50">Old:</span> {formatDate(c.oldestMtime)}</div>
                        <div><span className="opacity-50">New:</span> {formatDate(c.newestMtime)}</div>
                      </div>
                    ) : (
                      <span className="opacity-50">Empty</span>
                    )}
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
