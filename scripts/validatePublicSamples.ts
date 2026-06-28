import { PUBLIC_VISUAL_SAMPLES } from '../src/lib/visualAnalysis/publicSamples/registry';
import { fetchPublicSampleImage } from '../src/lib/visualAnalysis/publicSamples/serverFetch';

async function diagnose() {
  const variants = ['thumbnail', 'preview', 'full'] as const;
  const results = [];
  let total = 0;
  let ok = 0;
  let failed = 0;

  for (const sample of PUBLIC_VISUAL_SAMPLES) {
    for (const variant of variants) {
      total++;
      let isOk = false;
      let errorStr = '';
      let cause = '';
      
      const expectedUrl = variant === 'thumbnail' ? (sample.source.thumbnailUrl || sample.source.imageUrl) : sample.source.imageUrl;
      let host = '';
      try {
        if (!expectedUrl.startsWith('/')) {
            host = new URL(expectedUrl).hostname;
        } else {
            host = 'localhost (fixture)';
        }
      } catch (e) {
          host = 'invalid url';
      }

      try {
        const result = await fetchPublicSampleImage(sample.id, variant);
        if (result && result.buffer && result.mimeType) {
            isOk = true;
            ok++;
        } else {
            throw new Error("No buffer or mimeType returned");
        }
      } catch (e: any) {
        failed++;
        errorStr = e.message;
        
        if (e.message.includes('Host not allowed')) {
            cause = 'hostNotAllowlisted';
        } else if (e.message.includes('Invalid URL')) {
            cause = 'invalidUrl';
        } else if (e.message.includes('Fetch failed with status: 404')) {
            cause = 'thumbnailUrlNotFound / directImageUrlNotFound';
        } else if (e.message.includes('Invalid content type')) {
            cause = 'nonImageContentType / htmlFallback';
        } else if (e.message.includes('Local fixture not found') || e.message.includes('Access denied')) {
            cause = 'localFixtureMissing';
        } else {
            cause = 'unknown';
        }
      }

      const reportItem = {
          sampleId: sample.id,
          variant,
          sourceProvider: sample.source.provider,
          url: expectedUrl,
          host,
          ok: isOk,
          cause: isOk ? undefined : cause,
          error: isOk ? undefined : errorStr,
      };
      
      results.push(reportItem);
      console.log(`[${isOk ? 'OK' : 'FAIL'}] ${sample.id} (${variant}) - ${isOk ? 'Success' : cause + ': ' + errorStr}`);
    }
  }

  const report = {
      total,
      ok,
      failed,
      items: results.filter(r => !r.ok)
  };
  
  console.log('\n=======================================');
  console.log('DIAGNOSTICS REPORT (FAILURES ONLY)');
  console.log('=======================================');
  console.log(JSON.stringify(report, null, 2));
}

diagnose().catch(console.error);
