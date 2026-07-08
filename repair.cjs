const fs = require('fs');
let code = fs.readFileSync('src/components/ImageExperiment.tsx', 'utf8');

const replacement = `{serverJobStatus && (
              <div className="bg-slate-50 border rounded p-3 text-xs space-y-2">
                <div className="flex items-center justify-between">
                  <div><strong>Status:</strong> <span className={serverJobStatus.status === 'running' ? 'text-indigo-600 font-bold' : ''}>{serverJobStatus.status}</span></div>
                  {serverJobStatus.status === 'running' && (
                    <button onClick={handleCancelServerJob} className="text-red-600 hover:text-red-800 font-bold px-2 py-1 bg-red-50 rounded">Cancel Job</button>
                  )}
                </div>
                <div><strong>Progress:</strong> {(serverJobStatus.counters?.successCount || 0) + (serverJobStatus.counters?.failureCount || 0)} / {serverJobStatus.counters?.total || 0}</div>
                <div><strong>Current Sample:</strong> {serverJobStatus.currentSampleTitle || serverJobStatus.currentSampleId || '-'}</div>
                <div><strong>Last Event:</strong> {serverJobStatus.lastEvent?.message || '-'}</div>
                <div><strong>Last Heartbeat:</strong> {serverJobStatus.lastHeartbeatAt ? new Date(serverJobStatus.lastHeartbeatAt).toLocaleTimeString() : '-'}</div>
                
                <div className="flex gap-2 pt-2 mt-2 border-t border-slate-200">
                  <a href={\`/api/visual/batch-jobs/\${serverJobStatus.jobId}/reports/full\`} target="_blank" className="text-indigo-600 hover:underline">Full JSON</a>
                  <a href={\`/api/visual/batch-jobs/\${serverJobStatus.jobId}/reports/summary\`} target="_blank" className="text-indigo-600 hover:underline">Summary</a>
                  <a href={\`/api/visual/batch-jobs/\${serverJobStatus.jobId}/reports/diagnostic\`} target="_blank" className="text-indigo-600 hover:underline">Diagnostic</a>
                  <a href={\`/api/visual/batch-jobs/\${serverJobStatus.jobId}/reports/failures\`} target="_blank" className="text-indigo-600 hover:underline">Failures</a>
                  {serverJobStatus.status === 'completed' && (
                    <button onClick={handleImportServerJob} className="ml-auto px-2 py-1 bg-emerald-100 text-emerald-800 rounded font-bold hover:bg-emerald-200">
                      Import to Batch Summary
                    </button>
                  )}
                </div>
              </div>
            )}
            
            {serverJobList.length > 0 && !serverJobStatus && (
              <div className="pt-2 border-t border-slate-100">
                <h4 className="text-xs font-bold text-slate-700 mb-2">Recent Server Jobs</h4>
                <div className="space-y-1 max-h-32 overflow-y-auto">
                  {serverJobList.slice().reverse().map(job => (
                    <button 
                      key={job.jobId}
                      onClick={() => {
                        setServerJobId(job.jobId);
                        setServerJobStatus(job);
                      }}
                      className="w-full text-left text-xs p-2 rounded hover:bg-slate-50 border border-transparent hover:border-slate-200 flex justify-between"
                    >
                      <span>{new Date(job.createdAt).toLocaleString()}</span>
                      <span className="text-slate-500">{job.status} ({job.counters?.successCount}/{job.counters?.total})</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
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
                <div className="p-3 bg-red-100/50 rounded-lg">
                  <span className="block text-[10px] text-red-500 font-bold uppercase mb-1">Raw Error</span>
                  <span className="font-mono text-xs text-red-900 break-all">{healthCheckDiagnostics.error || String(healthCheckDiagnostics)}</span>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                   <div className="p-2 bg-white rounded border border-red-100">`;

const startIdx = code.indexOf('{serverJobStatus && (');
const endIdx = code.indexOf('<div className="p-2 bg-white rounded border border-red-100">', startIdx);

if (startIdx !== -1 && endIdx !== -1) {
  code = code.substring(0, startIdx) + replacement + code.substring(endIdx + '<div className="p-2 bg-white rounded border border-red-100">'.length);
  fs.writeFileSync('src/components/ImageExperiment.tsx', code);
  console.log("Patched successfully.");
} else {
  console.log("Could not find bounds.");
}
