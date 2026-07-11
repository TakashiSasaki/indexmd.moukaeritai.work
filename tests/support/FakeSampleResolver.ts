import { SampleResolver } from "../../src/lib/visualAnalysis/preflight";

export class FakeSampleResolver implements SampleResolver {
  hasSample(sampleId: string): boolean {
    return true; // allow all sampleIds for testing
  }
  isExternalDescriptor(sampleId: string): boolean {
    return false;
  }
}
