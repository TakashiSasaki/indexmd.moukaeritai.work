import { getGeminiClient } from "../gemini";
import { PreparedVisualExecution } from "./preflight";

export interface SamplePayload {
  readonly sampleId: string;
  readonly mimeType: string;
  readonly data: Buffer | string; // Buffer or base64 string
}

export interface ProviderTransportRequest {
  readonly preparedExecution: PreparedVisualExecution;
  readonly sample: SamplePayload;
  readonly systemInstruction?: string;
}

export interface ProviderTransportResponse {
  readonly success: boolean;
  readonly text?: string;
  readonly error?: any;
}

export interface ProviderTransport {
  executeSingleRequest(request: ProviderTransportRequest): Promise<ProviderTransportResponse>;
}

export class GeminiSdkProviderTransport implements ProviderTransport {
  async executeSingleRequest(req: ProviderTransportRequest): Promise<ProviderTransportResponse> {
    const { preparedExecution, sample, systemInstruction } = req;
    const client = getGeminiClient(preparedExecution.canonicalModelId);

    // Prepare contents block without any metadata or credentials
    let dataPart: any;
    if (Buffer.isBuffer(sample.data)) {
      dataPart = {
        inlineData: {
          data: sample.data.toString("base64"),
          mimeType: sample.mimeType
        }
      };
    } else {
      dataPart = {
        inlineData: {
          data: sample.data,
          mimeType: sample.mimeType
        }
      };
    }

    const contents = [
      dataPart,
      { text: "Analyze this image and return structured JSON conforming to the schema." }
    ];

    const callParams: any = {
      model: preparedExecution.canonicalModelId,
      contents,
      config: {}
    };

    // Apply generation parameters
    if (preparedExecution.generationConfiguration.temperature !== undefined) {
      callParams.config.temperature = preparedExecution.generationConfiguration.temperature;
    }
    if (preparedExecution.generationConfiguration.topP !== undefined) {
      callParams.config.topP = preparedExecution.generationConfiguration.topP;
    }
    if (preparedExecution.generationConfiguration.topK !== undefined) {
      callParams.config.topK = preparedExecution.generationConfiguration.topK;
    }
    if (systemInstruction) {
      callParams.config.systemInstruction = systemInstruction;
    }

    // Apply resolved execution mode & response schema
    if (preparedExecution.resolvedExecutionMode === "nativeSchema") {
      callParams.config.responseMimeType = "application/json";
      callParams.config.responseSchema = preparedExecution.compiledProviderSchema;
    }

    // Apply media resolution mapping
    if (preparedExecution.mediaResolutionConfiguration.configured && preparedExecution.mediaResolutionConfiguration.requested) {
      const mapping: Record<string, any> = {
        "high": "MEDIA_RESOLUTION_HIGH",
        "medium": "MEDIA_RESOLUTION_MEDIUM",
        "low": "MEDIA_RESOLUTION_LOW"
      };
      const mapped = mapping[preparedExecution.mediaResolutionConfiguration.requested.toLowerCase()];
      if (mapped) {
        callParams.config.mediaResolution = mapped;
      }
    }

    try {
      const response = await client.models.generateContent(callParams);
      return {
        success: true,
        text: response.text
      };
    } catch (error) {
      return {
        success: false,
        error
      };
    }
  }
}

