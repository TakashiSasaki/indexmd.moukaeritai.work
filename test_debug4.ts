import { generateContentWithRetry } from './src/lib/gemini.ts';

const mockAi = {
  models: {
    generateContent: async () => {
      const err = new Error("Internal Server Error") as any;
      err.status = 500;
      throw err;
    }
  }
};

async function run() {
  try {
    await generateContentWithRetry(mockAi as any, "model", "prompt", { retryInternalErrors: false, maxAttempts: 3, baseDelayMs: 10 });
  } catch (e) {
    console.log("Thrown:", e);
  }
}
run();
