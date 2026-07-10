import { fetchPublicSampleImage } from '../src/lib/visualAnalysis/publicSamples/serverFetch';
import { config } from 'dotenv';
config();

async function run() {
  const sampleId = 'sample-whiteboard-1';
  try {
    const { buffer, mimeType } = await fetchPublicSampleImage(sampleId, 'preview');
    console.log(`Success: Fetched ${buffer.byteLength} bytes for preview variant, mimeType: ${mimeType}`);
  } catch (e: any) {
    console.error("Caught error:", e);
  }
}

run().catch(console.error);
