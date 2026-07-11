import { ProviderTransport, ProviderTransportRequest, ProviderTransportResponse } from "../../src/lib/visualAnalysis/providerTransport";

export class FakeProviderTransport implements ProviderTransport {
  public requests: any[] = [];
  public queuedResponses: Array<{status: number, data?: any, error?: Error}> = [];
  public requestCount = 0;

  async executeSingleRequest(req: ProviderTransportRequest): Promise<ProviderTransportResponse> {
    const safeReq = JSON.parse(JSON.stringify(req));
    // Sanitize base64 from the captured request
    if (safeReq.sample && safeReq.sample.data) {
      safeReq.sample.data = "[SANITIZED_BINARY_DATA]";
    }

    this.requests.push(safeReq);
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
