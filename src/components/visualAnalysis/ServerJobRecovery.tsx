import React from 'react';
import { Download, Copy, RefreshCw, Archive, Trash2, ArrowRight } from 'lucide-react';
import { LocalJobBackup } from '../../lib/visualAnalysis/serverJobs/localJobBackup';
import { VisualBatchJob } from '../../lib/visualAnalysis/publicSamples/batchTypes';
import { getVisualModelCapability } from '../../lib/modelCapabilities';

interface ServerJobRecoveryProps {
  serverJobs: Partial<VisualBatchJob>[];
  localBackups: LocalJobBackup[];
  selectedJobId: string | null;
  onSelectJob: (jobId: string) => void;
  onRefreshJob: (jobId: string) => void;
  onCopyBundle: (jobId: string, fromBackup?: boolean) => void;
  onDownloadBundle: (jobId: string, fromBackup?: boolean) => void;
  onImportStats: (jobId: string) => void;
  onSaveBackup: (jobId: string) => void;
  onRemoveBackup: (jobId: string) => void;
}

export default function ServerJobRecovery({
  serverJobs,
  localBackups,
  selectedJobId,
  onSelectJob,
  onRefreshJob,
  onCopyBundle,
  onDownloadBundle,
  onImportStats,
  onSaveBackup,
  onRemoveBackup
}: ServerJobRecoveryProps) {
  if (serverJobs.length === 0 && localBackups.length === 0) {
    return null;
  }

  const renderStatus = (status: string) => {
    switch(status) {
      case 'completed': return <span className="text-emerald-600 font-medium text-xs px-2 py-0.5 bg-emerald-50 border border-emerald-200 rounded">Completed</span>;
      case 'failed': return <span className="text-red-600 font-medium text-xs px-2 py-0.5 bg-red-50 border border-red-200 rounded">Failed</span>;
      case 'canceled': return <span className="text-amber-600 font-medium text-xs px-2 py-0.5 bg-amber-50 border border-amber-200 rounded">Canceled</span>;
      case 'running': return <span className="text-blue-600 font-medium text-xs px-2 py-0.5 bg-blue-50 border border-blue-200 rounded animate-pulse">Running</span>;
      case 'queued': return <span className="text-slate-600 font-medium text-xs px-2 py-0.5 bg-slate-100 border border-slate-300 rounded">Queued</span>;
      case 'paused': return <span className="text-orange-600 font-medium text-xs px-2 py-0.5 bg-orange-50 border border-orange-200 rounded">Paused</span>;
      case 'pausedForRateLimit': return <span className="text-amber-600 font-medium text-xs px-2 py-0.5 bg-amber-50 border border-amber-200 rounded" title="Paused due to Rate Limit (429)">Paused (Rate Limit)</span>;
      case 'blockedByQuota': return <span className="text-rose-600 font-medium text-xs px-2 py-0.5 bg-rose-50 border border-rose-200 rounded" title="Blocked by Provider Quota Exhaustion">Blocked (Quota)</span>;
      case 'blockedByConfigurationError': return <span className="text-purple-600 font-medium text-xs px-2 py-0.5 bg-purple-50 border border-purple-200 rounded" title="Blocked by Deterministic Configuration Error">Blocked (Config)</span>;
      default: return <span className="text-slate-600 font-medium capitalize text-xs px-2 py-0.5 bg-slate-100 border border-slate-300 rounded">{status}</span>;
    }
  };

  return (
    <div className="mt-8 space-y-6 border-t border-slate-200 pt-6">

      {serverJobs.length > 0 && (
        <section>
          <h3 className="text-lg font-semibold text-slate-800 mb-2">Saved Server Jobs</h3>
          <p className="text-sm text-slate-500 mb-4">
            Server jobs are stored in local disk cache and survive process restarts only if the cache directory is preserved.
          </p>
          <div className="space-y-3">
            {serverJobs.map((job, idx) => (
              <div
                key={job.jobId || idx}
                className={`p-4 rounded-lg border transition-colors ${selectedJobId === job.jobId ? 'border-indigo-500 bg-indigo-50' : 'border-slate-200 bg-white hover:border-indigo-300'}`}
              >
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center space-x-2">
                      <span className="font-mono text-sm font-medium text-slate-700">{job.jobId?.slice(0, 8)}...</span>
                      {renderStatus(job.status || 'unknown')}
                      <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded">{job.modelName}</span>
                      {job.modelName && getVisualModelCapability(job.modelName).recommendation === "discontinued" && (
                        <span className="text-[9px] font-bold uppercase text-rose-500 bg-rose-50 border border-rose-200 px-1.5 py-0.5 rounded">Discontinued</span>
                      )}
                    </div>
                    <div className="text-sm text-slate-500 flex items-center space-x-4">
                      <span>Processed: {(job.counters?.successCount || 0) + (job.counters?.failureCount || 0)}/{job.counters?.total || 0}</span>
                      {job.counters?.successCount !== undefined && (
                        <span>Success: {job.counters.successCount} | Fail: {job.counters.failureCount || 0}</span>
                      )}
                      <span>Started: {new Date(job.startedAt || job.createdAt || '').toLocaleString()}</span>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 items-center">
                    {job.jobId && selectedJobId !== job.jobId && (
                      <button
                        onClick={() => {
                          if (job.modelName && getVisualModelCapability(job.modelName).recommendation === "discontinued") {
                            alert(`Model ${job.modelName} is discontinued. You cannot resume this job. Please create a new job with a supported model.`);
                            return;
                          }
                          onSelectJob(job.jobId!);
                        }}
                        className={`flex items-center space-x-1 px-3 py-1.5 text-sm font-medium rounded ${
                          job.modelName && getVisualModelCapability(job.modelName).recommendation === "discontinued"
                            ? 'text-slate-400 bg-slate-100 cursor-not-allowed'
                            : 'text-indigo-600 bg-indigo-50 hover:bg-indigo-100'
                        }`}
                        title={job.modelName && getVisualModelCapability(job.modelName).recommendation === "discontinued" ? "Cannot restore a discontinued model" : "Restore this job"}
                      >
                        <ArrowRight className="w-4 h-4" />
                        <span>Restore</span>
                      </button>
                    )}
                    {job.jobId && (
                      <>
                        <button
                          onClick={() => onRefreshJob(job.jobId!)}
                          className="flex items-center space-x-1 p-1.5 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded"
                          title="Fetch Fresh Detail"
                        >
                          <RefreshCw className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => onCopyBundle(job.jobId!)}
                          className="flex items-center space-x-1 p-1.5 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded"
                          title="Copy Bundle"
                        >
                          <Copy className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => onDownloadBundle(job.jobId!)}
                          className="flex items-center space-x-1 p-1.5 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded"
                          title="Download Bundle"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => onImportStats(job.jobId!)}
                          className="flex items-center space-x-1 px-3 py-1.5 text-sm font-medium text-slate-700 bg-slate-100 rounded hover:bg-slate-200"
                        >
                          Import Stats
                        </button>
                        <button
                          onClick={() => onSaveBackup(job.jobId!)}
                          className="flex items-center space-x-1 px-3 py-1.5 text-sm font-medium text-teal-700 bg-teal-50 rounded hover:bg-teal-100"
                        >
                          <Archive className="w-4 h-4" />
                          <span>Save Local Backup</span>
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {localBackups.length > 0 && (
        <section>
          <h3 className="text-lg font-semibold text-slate-800 mb-2">Browser Backups</h3>
          <p className="text-sm text-slate-500 mb-4">
            Browser backups are best-effort and limited by localStorage quota. Important bundles should be downloaded for long-term archival.
          </p>
          <div className="space-y-3">
            {localBackups.map(backup => (
              <div
                key={backup.jobId}
                className="p-4 rounded-lg border border-slate-200 bg-slate-50"
              >
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center space-x-2">
                      <span className="font-mono text-sm font-medium text-slate-700">{backup.jobId.slice(0, 8)}...</span>
                      {renderStatus(backup.status)}
                      <span className="text-xs text-slate-400 bg-slate-200 px-2 py-0.5 rounded">{backup.modelName}</span>
                      {backup.modelName && getVisualModelCapability(backup.modelName).recommendation === "discontinued" && (
                        <span className="text-[9px] font-bold uppercase text-rose-500 bg-rose-50 border border-rose-200 px-1.5 py-0.5 rounded">Discontinued</span>
                      )}
                    </div>
                    <div className="text-sm text-slate-500 flex items-center space-x-4">
                      <span>Processed: {backup.counters.processed}/{backup.counters.total}</span>
                      <span>Saved: {new Date(backup.savedAt).toLocaleString()}</span>
                      {backup.bundleStored ? (
                        <span className="text-teal-600 font-medium text-xs border border-teal-200 bg-teal-50 px-2 py-0.5 rounded">Bundle Stored</span>
                      ) : (
                        <span className="text-amber-600 font-medium text-xs border border-amber-200 bg-amber-50 px-2 py-0.5 rounded" title={backup.notStoredReason}>Metadata Only</span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => onRefreshJob(backup.jobId)}
                      className="flex items-center space-x-1 px-3 py-1.5 text-sm font-medium text-indigo-600 bg-indigo-50 rounded hover:bg-indigo-100"
                    >
                      Fetch Server Result
                    </button>
                    {backup.bundleStored && (
                      <>
                        <button
                          onClick={() => onCopyBundle(backup.jobId, true)}
                          className="flex items-center space-x-1 p-1.5 text-slate-500 hover:text-slate-700 hover:bg-slate-200 rounded"
                          title="Copy Saved Bundle"
                        >
                          <Copy className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => onDownloadBundle(backup.jobId, true)}
                          className="flex items-center space-x-1 p-1.5 text-slate-500 hover:text-slate-700 hover:bg-slate-200 rounded"
                          title="Download Saved Bundle"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                      </>
                    )}
                    <button
                      onClick={() => onRemoveBackup(backup.jobId)}
                      className="flex items-center space-x-1 p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded"
                      title="Remove Backup"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
