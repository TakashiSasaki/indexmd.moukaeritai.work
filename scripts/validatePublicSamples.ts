import { PUBLIC_VISUAL_SAMPLES } from '../src/lib/visualAnalysis/publicSamples/registry';
import { fetchPublicSampleImage } from '../src/lib/visualAnalysis/publicSamples/serverFetch';

async function diagnose() {
  const variants = ['thumbnail', 'preview', 'analysis', 'full'] as const;
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
      let byteLength = 0;
      let contentType = null;
      
      const expectedUrl = variant === 'thumbnail' ? (sample.source.thumbnailUrl || sample.source.imageUrl) : sample.source.imageUrl;
      let host = '';
      let allowedHost = false;
      try {
        if (!expectedUrl.startsWith('/')) {
            host = new URL(expectedUrl).hostname;
            allowedHost = ['upload.wikimedia.org', 'commons.wikimedia.org'].includes(host);
        } else {
            host = 'localhost (fixture)';
            allowedHost = true;
        }
      } catch (e) {
          host = 'invalid url';
      }

      try {
        const result = await fetchPublicSampleImage(sample.id, variant);
        if (result && result.buffer && result.mimeType) {
            isOk = true;
            ok++;
            byteLength = result.buffer.byteLength;
            contentType = result.mimeType;
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
        } else if (e.message.includes('status: 403')) {
            cause = 'hotlinkBlocked';
        } else if (e.message.includes('Image too large')) {
            cause = 'imageTooLarge';
        } else {
            cause = 'unknown';
        }
      }

      const reportItem = {
          sampleId: sample.id,
          variant,
          sourceProvider: sample.source.provider,
          url: expectedUrl,
          finalUrl: expectedUrl, // Simulated finalUrl
          host,
          allowedHost,
          status: isOk ? 200 : (errorStr.match(/status: (\d+)/)?.[1] ? parseInt(errorStr.match(/status: (\d+)/)![1]) : 0),
          contentType,
          byteLength,
          ok: isOk,
          cause: isOk ? undefined : cause,
          error: isOk ? undefined : errorStr,
      };
      
      results.push(reportItem);
      console.log(`[${isOk ? 'OK' : 'FAIL'}] ${sample.id} (${variant}) - ${isOk ? 'Success (' + byteLength + ' bytes)' : cause + ': ' + errorStr}`);
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
