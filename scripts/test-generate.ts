import { generateContentWithRetry } from '../src/lib/gemini';
import { fetchPublicSampleImage } from '../src/lib/visualAnalysis/publicSamples/serverFetch';
import { config } from 'dotenv';
config();

async function run() {
  const sampleId = 'sample-chart-synthetic'; // Used to be SVG, now PNG
  // Wait, I converted it to PNG. Let's just create a dummy SVG and pass it.
  const dummySvg = `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><circle cx="50" cy="50" r="40" stroke="green" stroke-width="4" fill="yellow" /></svg>`;
  const buffer = Buffer.from(dummySvg);
  const mimeType = 'image/svg+xml';
  
  try {
    const aiRes = await generateContentWithRetry('gemini-3.5-flash', [
      { inlineData: { data: buffer.toString('base64'), mimeType } },
      { text: 'Analyze this image and output JSON' }
    ], 1, { responseMimeType: 'application/json' });
    console.log("Success:", aiRes.text);
  } catch (e: any) {
    console.error("Caught error:", e);
    console.error("Is ProviderError:", e.constructor.name);
  }
}

run().catch(console.error);
