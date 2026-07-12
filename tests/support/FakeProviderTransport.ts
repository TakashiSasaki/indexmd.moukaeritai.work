import { ProviderTransport, ProviderTransportRequest, ProviderTransportResponse } from "../../src/lib/visualAnalysis/providerTransport";

export class FakeProviderTransport implements ProviderTransport {
  public requests: any[] = [];
  public queuedResponses: Array<{status: number, data?: any, error?: Error}> = [];
  public requestCount = 0;

  async executeSingleRequest(req: ProviderTransportRequest): Promise<ProviderTransportResponse> {
    const safeReq = {
      model: req.preparedExecution?.canonicalModelId,
      providerFamily: req.preparedExecution?.providerFamily,
      executionMode: req.preparedExecution?.resolvedExecutionMode,
      mimeType: req.sample?.mimeType,
      byteLength: req.sample?.data?.length,
      sampleId: req.sample?.sampleId,
      compilerName: "test-compiler",
      schemaHash: req.preparedExecution?.customSchemaUsed ? "custom" : "compiled",
      generationParameters: { ...req.preparedExecution?.generationConfiguration },
      mediaResolutionValue: req.preparedExecution?.mediaResolutionConfiguration?.requested,
      physicalRequestNumber: this.requestCount + 1,
    };

    this.requests.push(Object.freeze(safeReq));
    this.requestCount++;

    const responseDef = this.queuedResponses.shift();
    if (responseDef?.error) {
      return { success: false, error: responseDef.error };
    }

    if (responseDef && responseDef.status >= 400) {
      const err = new Error(`Fake HTTP ${responseDef.status}`) as any;
      err.status = responseDef.status;
      err.response = { status: responseDef.status, data: responseDef.data };
      return { success: false, error: err };
    }

    return {
      success: true,
      text: JSON.stringify(responseDef?.data || { test: "success" })
    };
  }
}
