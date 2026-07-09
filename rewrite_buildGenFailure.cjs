const fs = require('fs');
let content = fs.readFileSync('src/lib/visualAnalysis/publicSamples/reportBuilder.ts', 'utf8');

const regex = /function buildGenerationFailureSummary\(items: PublicSampleBatchRunItem\[\]\) \{[\s\S]*?return \{\n\s*count: failedItems\.length,\n\s*byProviderStatus,\n\s*byStatusCode,\n\s*byMimeType,\n\s*inputsInfo\n\s*\};\n\}/;

const replacement = `function buildGenerationFailureSummary(items: PublicSampleBatchRunItem[]) {
  const failedItems = items.filter(isProviderGenerationFailure);
  
  const byFinalProviderStatus: Record<string, number> = {};
  const byObservedProviderStatus: Record<string, number> = {};
  const byFinalStatusCode: Record<string, number> = {};
  const byObservedStatusCode: Record<string, number> = {};
  const byProviderFailureKind: Record<string, number> = {};
  const byMimeType: Record<string, number> = {};
  let transientFetchFailureCount = 0;
  
  const inputsInfo: Array<{
    sampleId: string;
    byteLength?: number;
    base64Length?: number;
    providerStatus?: string;
  }> = [];

  for (const item of failedItems) {
    const diag = getItemGenerationDiagnostics(item);
    const inputDiag = getItemInputDiagnostics(item);

    if (diag) {
      const finalProvStatus = diag.providerStatus || "UNKNOWN";
      byFinalProviderStatus[finalProvStatus] = (byFinalProviderStatus[finalProvStatus] || 0) + 1;
      
      const finalStatusCodeStr = diag.statusCode ? String(diag.statusCode) : "UNKNOWN";
      byFinalStatusCode[finalStatusCodeStr] = (byFinalStatusCode[finalStatusCodeStr] || 0) + 1;

      const failKind = diag.providerFailureKind || "UNKNOWN";
      byProviderFailureKind[failKind] = (byProviderFailureKind[failKind] || 0) + 1;

      if (diag.attempts && diag.attempts.length > 0) {
        let hasTransient = false;
        for (const attempt of diag.attempts) {
           const obsStatus = attempt.providerStatus || "UNKNOWN";
           byObservedProviderStatus[obsStatus] = (byObservedProviderStatus[obsStatus] || 0) + 1;
           const obsCode = attempt.statusCode ? String(attempt.statusCode) : "UNKNOWN";
           byObservedStatusCode[obsCode] = (byObservedStatusCode[obsCode] || 0) + 1;

           if (attempt.errorMessageSummary && attempt.errorMessageSummary.toUpperCase().includes("FETCH FAILED")) {
             hasTransient = true;
           }
        }
        if (hasTransient) transientFetchFailureCount++;
      } else {
        byObservedProviderStatus[finalProvStatus] = (byObservedProviderStatus[finalProvStatus] || 0) + 1;
        byObservedStatusCode[finalStatusCodeStr] = (byObservedStatusCode[finalStatusCodeStr] || 0) + 1;
        if (diag.rawMessageSummary && diag.rawMessageSummary.toUpperCase().includes("FETCH FAILED")) {
          transientFetchFailureCount++;
        }
      }
    } else {
      byFinalProviderStatus["UNKNOWN"] = (byFinalProviderStatus["UNKNOWN"] || 0) + 1;
      byFinalStatusCode["UNKNOWN"] = (byFinalStatusCode["UNKNOWN"] || 0) + 1;
      byObservedProviderStatus["UNKNOWN"] = (byObservedProviderStatus["UNKNOWN"] || 0) + 1;
      byObservedStatusCode["UNKNOWN"] = (byObservedStatusCode["UNKNOWN"] || 0) + 1;
      byProviderFailureKind["UNKNOWN"] = (byProviderFailureKind["UNKNOWN"] || 0) + 1;
    }

    if (inputDiag) {
      const mime = inputDiag.mimeType || "UNKNOWN";
      byMimeType[mime] = (byMimeType[mime] || 0) + 1;

      inputsInfo.push({
        sampleId: item.sampleId,
        byteLength: inputDiag.byteLength,
        base64Length: inputDiag.base64Length,
        providerStatus: diag?.providerStatus
      });
    } else {
      byMimeType["UNKNOWN"] = (byMimeType["UNKNOWN"] || 0) + 1;
    }
  }

  return {
    count: failedItems.length,
    byFinalProviderStatus,
    byObservedProviderStatus,
    byFinalStatusCode,
    byObservedStatusCode,
    byProviderFailureKind,
    transientFetchFailureCount,
    byMimeType,
    inputsInfo
  };
}`;

content = content.replace(regex, replacement);
fs.writeFileSync('src/lib/visualAnalysis/publicSamples/reportBuilder.ts', content);
