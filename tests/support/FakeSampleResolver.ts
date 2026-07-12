import { SampleResolver } from "../../src/lib/visualAnalysis/preflight";

import { getPublicSampleById } from "../../src/lib/visualAnalysis/publicSamples/registry";
import { PublicVisualSample } from "../../src/lib/visualAnalysis/publicSamples/types";

export class FakeSampleResolver implements SampleResolver {
  private allowedSamples = new Set<string>();

  constructor(allowedSamples?: string[]) {
    if (allowedSamples) {
      for (const id of allowedSamples) {
        this.allowedSamples.add(id);
      }
    } else {
      // If not specified, default to allowing specific valid fixtures known in tests
      this.allowedSamples.add("sample-landscape-1");
      this.allowedSamples.add("sample-document-1");
      this.allowedSamples.add("sample-receipt-synthetic");
    }
  }

  hasSample(sampleId: string): boolean {
    return this.allowedSamples.has(sampleId);
  }
  isExternalDescriptor(sampleId: string): boolean {
    return false;
  }
  getSample(sampleId: string): PublicVisualSample | null {
    if (!this.allowedSamples.has(sampleId)) {
      return null;
    }
    // Fallback to the real list for metadata
    return getPublicSampleById(sampleId) || {
      id: sampleId,
      title: "Fake Sample",
      category: "document",
      source: {
        pageUrl: "https://example.com",
        licenseKind: "public-domain",
        licenseName: "PD",
        attributionText: "Test",
        originalImageUrl: "https://example.com/img.jpg"
      },
      imageAnalysisAvailable: true,
      labels: []
    } as any;
  }
}
