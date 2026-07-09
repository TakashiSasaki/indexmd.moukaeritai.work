const fs = require('fs');
let content = fs.readFileSync('src/components/ImageExperiment.tsx', 'utf8');

// 1. Add handleCopyServerJobBundle function
const functionToAdd = `
  const handleCopyServerJobBundle = async (jobId: string) => {
    try {
      const res = await fetch(\`/api/visual/batch-jobs/\${jobId}/reports/analysis-bundle\`);
      if (!res.ok) throw new Error('fetch failed');
      const text = await res.text();
      handleCopy(text, 'server-bundle-copy');
    } catch (e) {
      console.error("Failed to copy bundle", e);
      alert("Failed to fetch bundle for copying.");
    }
  };
`;

// Find a place to insert the function, e.g. before handleImportServerJob
content = content.replace(
  /const handleImportServerJob = async \(\) => {/,
  functionToAdd + '\n  const handleImportServerJob = async () => {'
);

// 2. Replace the "Get Results:" section in the server job card with the new UI
const oldServerUI = `<div className="pt-2 mt-2 border-t border-slate-200 text-xs flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-bold text-slate-700">Get Results:</span>
                    <a 
                      href={\`/api/visual/batch-jobs/\${serverJobStatus.jobId}/reports/analysis-bundle\`} 
                      target="_blank" 
                      className="inline-flex items-center gap-1.5 text-indigo-600 hover:underline font-bold bg-indigo-50 px-2.5 py-1 rounded border border-indigo-200"
                    >
                      Analysis Bundle JSON
                    </a>
                  </div>
                  {serverJobStatus.status === 'completed' && (
                    <button onClick={handleImportServerJob} className="px-2.5 py-1 bg-emerald-100 text-emerald-800 rounded font-bold hover:bg-emerald-200 text-[10px] transition-colors">
                      Import to Local Summary
                    </button>
                  )}
                </div>`;

const newServerUI = `<div className="pt-4 mt-2 border-t border-slate-200">
                  {serverJobStatus.status === 'completed' && (
                    <div className="p-4 rounded-lg border-2 border-indigo-200 bg-indigo-50/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-extrabold text-[10px] text-indigo-950 uppercase tracking-wider">Recommended for ChatGPT / Analysis:</span>
                          <span className="text-[9px] bg-indigo-600 text-white px-2 py-0.5 rounded-full font-black uppercase tracking-wide shadow-sm">Highly Recommended</span>
                        </div>
                        <h4 className="font-extrabold text-sm text-indigo-900">Analysis Bundle JSON</h4>
                        <p className="text-[11px] text-slate-600 leading-normal max-w-2xl">
                          The primary single-file artifact for ChatGPT-assisted analysis. Includes run counters, consistency metrics, failure summaries, input sizes, text-heavy assessments, and embedded failure items.
                        </p>
                      </div>
                      <div className="flex gap-2 w-full sm:w-auto shrink-0 flex-wrap">
                        <button
                          type="button"
                          onClick={() => handleCopyServerJobBundle(serverJobStatus.jobId)}
                          className="text-[11px] font-bold text-white bg-indigo-600 hover:bg-indigo-700 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg shadow-sm flex-1 sm:flex-initial transition-colors"
                        >
                          {copied === 'server-bundle-copy' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                          {copied === 'server-bundle-copy' ? "Copied" : "Copy Bundle"}
                        </button>
                        <a
                          href={\`/api/visual/batch-jobs/\${serverJobStatus.jobId}/reports/analysis-bundle\`}
                          download={\`visual-analysis-analysis-bundle-\${serverJobStatus.jobId}.json\`}
                          className="text-[11px] font-bold text-indigo-600 hover:text-indigo-750 flex items-center justify-center gap-1.5 bg-white hover:bg-indigo-50 px-3 py-2 rounded-lg border border-indigo-200 shadow-sm transition-colors"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>Download</span>
                        </a>
                        <button onClick={handleImportServerJob} className="text-[11px] px-3 py-2 bg-emerald-100 text-emerald-800 rounded-lg font-bold hover:bg-emerald-200 transition-colors flex items-center gap-1.5">
                          <Activity className="w-3.5 h-3.5" />
                          Import Stats
                        </button>
                      </div>
                    </div>
                  )}
                  {serverJobStatus.status !== 'completed' && (
                    <div className="text-xs flex items-center justify-between gap-2">
                       <span className="font-bold text-slate-700">Get Results:</span>
                       <span className="text-slate-500 italic">Available when completed</span>
                    </div>
                  )}
                </div>`;

content = content.replace(oldServerUI, newServerUI);

// 3. Remove the block from Batch Regression Summary
const oldSummaryBlockRegex = /\{\/\* Recommended: Analysis Bundle \*\/\}\s*<div className="p-4 rounded-lg border-2 border-indigo-200 bg-indigo-50\/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mt-2">[\s\S]*?<\/div>\s*<\/div>\s*<\/div>/;

// Looking at the code:
//             </div>
//             {/* Recommended: Analysis Bundle */}
//             <div className="p-4 rounded-lg border-2 border-indigo-200 bg-indigo-50/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mt-2">
//               <div className="space-y-1">
// ...
//               </div>
//             </div>
//           </div>

// We need to carefully remove it.
const summaryBlockStr = `            {/* Recommended: Analysis Bundle */}
            <div className="p-4 rounded-lg border-2 border-indigo-200 bg-indigo-50/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mt-2">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-extrabold text-[10px] text-indigo-950 uppercase tracking-wider">Recommended for ChatGPT / Analysis:</span>
                  <span className="text-[9px] bg-indigo-600 text-white px-2 py-0.5 rounded-full font-black uppercase tracking-wide shadow-sm">Highly Recommended</span>
                </div>
                <h4 className="font-extrabold text-sm text-indigo-900">Analysis Bundle JSON</h4>
                <p className="text-[11px] text-slate-600 leading-normal max-w-2xl">
                  The primary single-file artifact for ChatGPT-assisted analysis. Includes run counters, consistency metrics, failure summaries, input sizes, text-heavy assessments, and embedded failure items. Raw API response bodies and massive success previews are omitted to fit in your context window.
                </p>
                {analysisBundleReportStats && (
                  <div className="text-[9px] font-mono text-indigo-700/80 bg-indigo-100/50 inline-block px-1.5 py-0.5 rounded mt-1">
                    Size: {analysisBundleReportStats.byteLength} bytes ({analysisBundleReportStats.charLength} chars) | Hash: {analysisBundleReportStats.hash}
                  </div>
                )}
              </div>
              <div className="flex gap-2 w-full sm:w-auto shrink-0">
                <button
                  type="button"
                  onClick={() => handleCopy(analysisBundleReportStats?.text || "", 'batch-report-analysis-bundle')}
                  className="text-[11px] font-bold text-white bg-indigo-600 hover:bg-indigo-700 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg shadow-sm flex-1 sm:flex-initial transition-colors"
                >
                  {copied === 'batch-report-analysis-bundle' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  {copied === 'batch-report-analysis-bundle' ? "Copied" : "Copy Bundle"}
                </button>
                <button
                  type="button"
                  onClick={() => handleDownload(analysisBundleReport, \`visual-analysis-analysis-bundle-\${Date.now()}.json\`, 'batch-report-analysis-bundle-dl')}
                  className="text-[11px] font-bold text-indigo-600 hover:text-indigo-750 flex items-center justify-center gap-1.5 bg-white hover:bg-indigo-50 px-3 py-2 rounded-lg border border-indigo-200 shadow-sm transition-colors"
                  title="Download as JSON file"
                >
                  {copied === 'batch-report-analysis-bundle-dl' ? <Check className="w-3.5 h-3.5" /> : <Download className="w-3.5 h-3.5" />}
                  <span>Download Bundle</span>
                </button>
              </div>
            </div>`;

content = content.replace(summaryBlockStr, '');

fs.writeFileSync('src/components/ImageExperiment.tsx', content);
