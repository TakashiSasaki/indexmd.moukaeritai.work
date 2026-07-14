import { getGeminiClient } from "../gemini";
import { PreparedVisualExecution } from "./preflight";

export interface SamplePayload {
  readonly sampleId: string;
  readonly mimeType: string;
  readonly data: Buffer | string; // Buffer or base64 string
}

export interface ProviderTransportRequest {
  readonly abortSignal?: AbortSignal;
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

export function buildGeminiGenerateContentParams(req: ProviderTransportRequest): any {
    const { preparedExecution, sample, systemInstruction, abortSignal } = req;

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

    if (preparedExecution.resolvedExecutionMode === "nativeSchema") {
      callParams.config.responseMimeType = "application/json";
      callParams.config.responseSchema = preparedExecution.compiledProviderSchema;
    }

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

    // As of @google/genai 2.4.0, signal is not explicitly documented, but we pass it downstream
    // just in case they support it in the fetch wrapper.
    if (abortSignal) {
      callParams.config.signal = abortSignal;
    }

    return callParams;
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

    // Note: The application transport calls "generateContent" exactly once.
    // No public SDK retry option is available on the generateContent config.

    // Note: If the Gemini SDK supports passing an AbortSignal, we would pass it here
    // However, as of version 2.4.0, GoogleGenAI.models.generateContent does not
    // document explicit support for standard AbortSignal. We pass it gracefully
    // if the underlying fetch respects it, otherwise it is a no-op at the SDK boundary.
    if (req.abortSignal) {
      callParams.config.signal = req.abortSignal;
    }

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

