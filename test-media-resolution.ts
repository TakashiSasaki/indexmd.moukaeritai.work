import { GoogleGenAI } from '@google/genai';
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
async function run() {
  try {
    const res = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        { inlineData: { data: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64").toString("base64"), mimeType: "image/png" } },
        'Describe the image'
      ],
      config: {
        mediaResolution: "MEDIA_RESOLUTION_HIGH" as any
      }
    });
    console.log(res.text);
  } catch(e) {
    console.error(e);
  }
}
run();
