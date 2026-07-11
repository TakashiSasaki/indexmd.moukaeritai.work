import { createApp, initializeApp } from "./src/app.ts";
import { jobStore } from "./src/lib/visualAnalysis/serverJobs/jobStore";
import { RunnerRegistry } from "./src/lib/visualAnalysis/serverJobs/runnerRegistry";
import { GeminiSdkProviderTransport } from "./src/lib/visualAnalysis/providerTransport";
import { defaultSampleResolver } from "./src/lib/visualAnalysis/preflight";
import { fetchPublicSampleImage } from "./src/lib/visualAnalysis/publicSamples/serverFetch";
import crypto from "crypto";

initializeApp();

const { app } = createApp({
  jobStore,
  providerTransport: new GeminiSdkProviderTransport(),
  sampleResolver: defaultSampleResolver,
  idGenerator: () => crypto.randomUUID(),
  clock: { now: () => new Date() },
  imageFetcher: fetchPublicSampleImage,
  runnerRegistry: new RunnerRegistry(),
});

export { app };

const PORT = 3000;

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const path = await import("path");
    const distPath = path.join(process.cwd(), "dist");
    const express = await import("express");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[Drive Indexer Backend] Running on http://localhost:${PORT}`);
  });
}

if (process.env.NODE_ENV !== "test") {
  startServer();
}
