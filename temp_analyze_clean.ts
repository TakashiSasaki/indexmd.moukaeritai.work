
export async function analyzePublicSample(options: {
  sampleId: string;
  modelName?: string;
  includeRequestPreview?: boolean;
  jsonMode?: string;
  customInstruction?: string;
}): Promise<{status: number, body: any}> {
  try {
    const { sampleId, modelName = "gemini-3.5-flash", includeRequestPreview = false, jsonMode, customInstruction } = options;

    if (!sampleId) return { status: 400, body: { error: "sampleId is required" } };

    const sample = getPublicSampleById(sampleId);
    if (!sample) return { status: 404, body: { error: "Sample not found" } };

    // Fetch Image Bytes
    const fetchResult = await fetchPublicSampleImage(sampleId, "analysis");
    const { buffer, mimeType, sourceUrlKind, diagnostics: inputDiagnostics } = fetchResult;
    const base64Data = buffer.toString("base64");
    
    // Add input size warnings for diagnostics
    let inputSizeWarning: string | undefined;
    if (inputDiagnostics?.analysisHardCapBytes && buffer.byteLength > inputDiagnostics.analysisHardCapBytes) {
      inputSizeWarning = `Image size (${Math.round(buffer.byteLength / 1024)}KB) exceeds hard cap of ${Math.round(inputDiagnostics.analysisHardCapBytes / 1024)}KB.`;
    } else if (inputDiagnostics?.analysisTargetBytes && buffer.byteLength > inputDiagnostics.analysisTargetBytes) {
      inputSizeWarning = `Image size (${Math.round(buffer.byteLength / 1024)}KB) exceeds target of ${Math.round(inputDiagnostics.analysisTargetBytes / 1024)}KB, but remains under hard cap.`;
    } else if (!inputDiagnostics && buffer.byteLength > 2 * 1024 * 1024) {
       inputSizeWarning = "Image size exceeds 2MB and fell back to original URL or no diagnostics available.";
    }

    // Prepare Prompt & Options
    const visualCap = getVisualModelCapability(modelName);
    if (visualCap.recommendation === "unsupported") {
      return { status: 400, body: { error: `Model ${modelName} is not supported for visual analysis.` } };
    }

    const targetModel = modelName;
    const isGemma = visualCap.providerFamily === "gemma";
    let mode = getStructuredExecutionMode(targetModel);
    
    if (jsonMode === "prompt_only" && mode === "nativeSchema") mode = "promptedJson";
    if (jsonMode === "native_schema" && getModelCapability(targetModel).supportsNativeResponseSchema) mode = "nativeSchema";

    let extractedSchema = null;
    let extractedCustomSchema = false;
    const cap = getModelCapability(targetModel);
    if (cap.supportsNativeResponseSchema && customInstruction) {
      const rawSchema = extractJsonSchemaFromText(customInstruction);
      if (rawSchema) {
        extractedSchema = normalizeSchemaForGemini(rawSchema);
        mode = "nativeSchema";
        extractedCustomSchema = true;
      }
    }

    const isPromptedJson = mode === "promptedJson";

    const systemInstruction = buildVisualAnalysisSystemInstruction();
    const taskPrompt = buildVisualAnalysisTaskPrompt(isPromptedJson) + (customInstruction ? `\n\nUser Instruction: ${customInstruction}` : "");

    // media resolution policy based on input sample
    // media resolution policy based on input sample
    let mediaResolutionRequested: string | undefined;
    let mediaResolutionConfigured: boolean = false;
    let mediaResolutionProviderAccepted: boolean = false;
    let mediaResolutionApplied: boolean = false;
    let mediaResolutionReason: string | undefined;
    let mediaResolutionUnsupportedReason: string | undefined;
    let mediaResolutionFallbackUsed: boolean = false;
    let mediaResolutionProviderField: string | undefined;

    if (isGemma) {
      mediaResolutionUnsupportedReason = "providerFamilyUnsupported";
    } else {
      if (
        sample && (
          sample.expectedImageKind === "chartOrTable" ||
          sample.expectedImageKind === "mapImage" ||
          sample.expectedImageKind === "documentPhoto" ||
          sample.expectedImageKind === "receiptPhoto" ||
          sample.expectedImageKind === "handwrittenNote" ||
          sample.expectedImageKind === "whiteboardPhoto" ||
          sample.expectedImageKind === "screenshot" ||
          sample.expectedImageKind === "packageImage"
        )
      ) {
        mediaResolutionRequested = "HIGH";
        mediaResolutionReason = "Detail-heavy image kind";
      } else if (sample && sample.expectedVisibleText && sample.expectedVisibleText.length > 0) {
        mediaResolutionRequested = "HIGH";
        mediaResolutionReason = "Expected visible text exists";
      } else {
        mediaResolutionRequested = "MEDIUM";
        mediaResolutionReason = "Simple image kind";
      }
      mediaResolutionConfigured = true;
      mediaResolutionProviderField = mediaResolutionRequested === "HIGH" ? "MEDIA_RESOLUTION_HIGH" : "MEDIA_RESOLUTION_MEDIUM";
    }

    let configOption: any = {
      ...VISUAL_ANALYSIS_GENERATION_CONFIG,
      systemInstruction,
      ...(mediaResolutionRequested ? { mediaResolution: mediaResolutionRequested } : {})
    };

    if (mode === "nativeSchema") {
      configOption.responseMimeType = "application/json";
      configOption.responseSchema = extractedSchema || GEMINI_VISUAL_ANALYSIS_RESPONSE_SCHEMA;
    }

    const requestPreview = includeRequestPreview ? {
      model: targetModel,
      outputMode: "structured",
      taskPrompt,
      systemInstruction,
      mimeType: mimeType,
      binaryInlineDataUsed: true,
      generationConfig: buildVisualAnalysisRequestPreviewConfig(configOption, mode, extractedCustomSchema)
    } : undefined;

    // Call Model
    let aiRes;
    try {
      aiRes = await generateContentWithRetry(targetModel, [
        { inlineData: { data: base64Data, mimeType: mimeType } },
        { text: taskPrompt }
      ], 4, configOption);
      
      if (mediaResolutionConfigured) {
        mediaResolutionProviderAccepted = true;
        mediaResolutionApplied = true;
      }
    } catch (err: any) {
      const errMsg = err?.message || "";
      if (mediaResolutionConfigured && errMsg.includes("INVALID_ARGUMENT") && (errMsg.includes("mediaResolution") || errMsg.includes("media_resolution"))) {
        console.warn(`[public-sample] mediaResolution configuration was rejected by provider. Retrying without mediaResolution fallback.`);
        mediaResolutionFallbackUsed = true;
        mediaResolutionUnsupportedReason = "rejectedByProvider";
        
        try {
          const fallbackConfig = { ...configOption };
          delete fallbackConfig.mediaResolution;
          
          aiRes = await generateContentWithRetry(targetModel, [
            { inlineData: { data: base64Data, mimeType: mimeType } },
            { text: taskPrompt }
          ], 2, fallbackConfig);
          
          mediaResolutionProviderAccepted = false;
          mediaResolutionApplied = false;
        } catch (fallbackErr: any) {
          err = fallbackErr;
        }
      }
      
      if (!aiRes) {
        const failRunMetadata = buildVisualAnalysisRunMetadata({
          targetModel,
          providerFamily: isGemma ? "gemma" : "gemini",
          visualRecommendation: visualCap.recommendation,
          mode,
          jsonMode,
          customInstructionUsed: !!customInstruction,
          customSchemaUsed: extractedCustomSchema,
          requestPreviewIncluded: includeRequestPreview,
          sourceKind: "publicSample",
          sampleId: sample.id,
          mimeType: mimeType,
          byteLength: buffer.length,
          base64Length: base64Data.length,
          mediaResolutionRequested,
          mediaResolutionConfigured,
          mediaResolutionProviderAccepted,
          mediaResolutionApplied,
          mediaResolutionReason,
          mediaResolutionUnsupportedReason,
          mediaResolutionFallbackUsed,
          mediaResolutionProviderField
        });

        const failRes = buildGenerationFailureResponse({
          err,
          targetModel,
          providerFamily: isGemma ? "gemma" : "gemini",
          runMetadata: failRunMetadata,
          sampleMetadata: {
            id: sample.id,
            title: sample.title,
            category: sample.category,
            licenseKind: sample.source.licenseKind,
            licenseName: sample.source.licenseName,
            attributionText: sample.source.attributionText,
            sourcePageUrl: sample.source.pageUrl
          },
          expectedMetadata: {
            imageKind: sample.expectedImageKind,
            elementCategories: sample.expectedElementCategories,
            elementCategoryAlternatives: sample.expectedElementCategoryAlternatives,
            visibleElementLabels: sample.expectedVisibleElementLabels,
            visibleElementLabelAliases: sample.expectedVisibleElementLabelAliases,
            visibleText: sample.expectedVisibleText,
            notes: sample.expectedNotes
          },
          requestPreview,
          inputDiagnostics: {
            imageVariant: "analysis",
            analysisSourceUrlKind: sourceUrlKind,
            inputSizeWarning,
            ...inputDiagnostics,
            cacheLayer: fetchResult.cacheLayer,
            cacheKey: fetchResult.cacheKey,
            cachePolicyVersion: fetchResult.cachePolicyVersion,
            cacheStored: fetchResult.cacheStored,
            cacheReadError: fetchResult.cacheReadError,
            cacheWriteError: fetchResult.cacheWriteError,
            cacheSharedInFlight: fetchResult.cacheSharedInFlight
          }
        });
        return { status: 200, body: failRes };
      }
    }

    const runMetadata = buildVisualAnalysisRunMetadata({
      targetModel,
      providerFamily: isGemma ? "gemma" : "gemini",
      visualRecommendation: visualCap.recommendation,
      mode,
      jsonMode,
      customInstructionUsed: !!customInstruction,
      customSchemaUsed: extractedCustomSchema,
      requestPreviewIncluded: includeRequestPreview,
      sourceKind: "publicSample",
      sampleId: sample.id,
      mimeType: mimeType,
      byteLength: buffer.length,
      base64Length: base64Data.length,
      mediaResolutionRequested,
      mediaResolutionConfigured,
      mediaResolutionProviderAccepted,
      mediaResolutionApplied,
      mediaResolutionReason,
      mediaResolutionUnsupportedReason,
      mediaResolutionFallbackUsed,
      mediaResolutionProviderField
    });

    let outputText = aiRes.text?.trim() || "{}";

    // Parse and Validate
    let parseRes = parseModelJsonOutput(outputText, 1);
    let retryCount = 0;
    
    // JSON Recovery
    let localRecoveryEnabled = true;
    let retryStrategy: "none" | "sameRequestOnce" | "localRepairThenJsonOnlyRetry" = "localRepairThenJsonOnlyRetry";
    
    let localRepairAttempted = parseRes.diagnostics.attempts.some(a => a.mode === "localRepair");
    let localRepairSucceeded = parseRes.ok && parseRes.parseMode === "localRepair";
    let modelRetryAttempted = false;
    let modelRetrySucceeded = false;

    if (!parseRes.ok && mode === "promptedJson") {
      console.warn(`[public-sample] Initial parse failed for ${sample.id}. Attempting JSON-only retry.`);
      modelRetryAttempted = true;
      
      const excerpt = outputText.length > 500
        ? `${outputText.substring(0, 250)}\n... [truncated] ...\n${outputText.substring(outputText.length - 250)}`
        : outputText;

      const retryPrompt = `The previous output was invalid JSON. Error: ${parseRes.diagnostics.parseErrorMessage || "Syntax error"}\n\nOriginal invalid output (excerpt):\n${excerpt}\n\nOutput only one valid JSON object. Do not include any markdown fences (like \`\`\`json), explanations, or trailing text. Preserve all of the parsed analysis content accurately.`;
      
      try {
        const retryConfig = {
          ...configOption,
          temperature: 0.1, // lower temp for retry
        };
        delete retryConfig.responseMimeType;
        delete retryConfig.responseSchema;
        
        const retryAiRes = await generateContentWithRetry(
          targetModel,
          [
            { inlineData: { data: base64Data, mimeType: mimeType } },
            { text: retryPrompt }
          ],
          1,
          retryConfig
        );
        
        retryCount++;
        const retryOutputText = retryAiRes.text?.trim() || "{}";
        
        const retryParseRes = parseModelJsonOutput(retryOutputText, 2);
        
        // Append previous attempts to diagnostics
        retryParseRes.diagnostics.attempts = [...parseRes.diagnostics.attempts, ...retryParseRes.diagnostics.attempts];
        parseRes = retryParseRes;
        
        if (parseRes.ok) {
          modelRetrySucceeded = true;
        }
      } catch (retryErr) {
        console.error(`[public-sample] JSON-only retry failed for ${sample.id}`, retryErr);
      }
    }

    // Add recovery stats to run metadata
    const rawOutputLength = outputText.length;
    let hashVal = 2166136261;
    for (let i = 0; i < outputText.length; i++) {
      hashVal ^= outputText.charCodeAt(i);
      hashVal += (hashVal << 1) + (hashVal << 4) + (hashVal << 7) + (hashVal << 8) + (hashVal << 24);
    }
    const rawOutputHash = (hashVal >>> 0).toString(16);
    const parseErrorMessage = parseRes.diagnostics?.parseErrorMessage || undefined;

    runMetadata.execution.jsonRecovery = {
      localRecoveryEnabled,
      retryStrategy,
      retryCount,
      finalParseMode: parseRes.ok ? parseRes.parseMode : undefined,
      localRepairAttempted,
      localRepairSucceeded,
      modelRetryAttempted,
      modelRetrySucceeded,
      rawOutputLength,
      rawOutputHash,
      parseErrorMessage,
      schemaValidationRecoveryAttempted: false,
      schemaValidationRecoverySucceeded: false,
      schemaValidationRetryCount: 0,
      schemaValidationRetryParseSucceeded: false,
      schemaValidationRetryValidationErrors: []
    };

    const fullInputDiagnostics = {
        sourceKind: runMetadata.input.sourceKind,
        sampleId: runMetadata.input.sampleId,
        mimeType: runMetadata.input.mimeType,
        byteLength: runMetadata.input.byteLength,
        base64Length: runMetadata.input.base64Length,
        imageVariant: "analysis",
        analysisSourceUrlKind: sourceUrlKind,
        inputSizeWarning,
        ...inputDiagnostics,
        cacheLayer: fetchResult.cacheLayer,
        cacheKey: fetchResult.cacheKey,
        cachePolicyVersion: fetchResult.cachePolicyVersion,
        cacheStored: fetchResult.cacheStored,
        cacheReadError: fetchResult.cacheReadError,
        cacheWriteError: fetchResult.cacheWriteError,
        cacheSharedInFlight: fetchResult.cacheSharedInFlight
    };

    if (!parseRes.ok) {
      return { status: 200, body: {
        record: {
          schemaVersion: "image-analysis-record.v0.1.0",
          status: { success: false, failureKind: "jsonParseError", error: "Model returned invalid JSON" },
          assetMetadata: {
            assetId: sample.id,
            title: sample.title,
            category: sample.category,
            sourceKind: "publicSample",
            sampleId: sample.id,
            sourceProvider: "publicSamples",
            sourcePageUrl: sample.source.pageUrl,
            licenseKind: sample.source.licenseKind,
            licenseName: sample.source.licenseName,
            attributionText: sample.source.attributionText
          },
          technicalMetadata: {
            mimeType: runMetadata.input.mimeType,
            originalByteLength: inputDiagnostics?.originalByteLength,
            processedByteLength: runMetadata.input.byteLength,
            base64Length: runMetadata.input.base64Length,
            inputFormat: inputDiagnostics?.inputFormat,
            outputFormat: inputDiagnostics?.outputFormat,
            resized: inputDiagnostics?.resized,
            recompressed: inputDiagnostics?.recompressed,
            reencoded: inputDiagnostics?.reencoded,
            quality: inputDiagnostics?.quality,
            analysisSizingPolicy: inputDiagnostics?.analysisSizingPolicy,
            analysisTargetLongEdge: inputDiagnostics?.analysisTargetLongEdge,
            analysisTargetBytes: inputDiagnostics?.analysisTargetBytes,
            analysisHardCapBytes: inputDiagnostics?.analysisHardCapBytes,
            analysisSizeReductionRatio: inputDiagnostics?.analysisSizeReductionRatio,
            targetExceededButAccepted: inputDiagnostics?.targetExceededButAccepted,
            hardCapExceeded: inputDiagnostics?.hardCapExceeded,
            minQualityReached: inputDiagnostics?.minQualityReached,
            providerSafeMimeType: inputDiagnostics?.providerSafeMimeType,
            originalDimensions: inputDiagnostics?.originalDimensions,
            processedDimensions: inputDiagnostics?.dimensions
          },
          analysisRun: runMetadata,
          evaluation: {
            expectedMetadata: {
              imageKind: sample.expectedImageKind,
              elementCategories: sample.expectedElementCategories,
              elementCategoryAlternatives: sample.expectedElementCategoryAlternatives,
              visibleElementLabels: sample.expectedVisibleElementLabels,
              visibleElementLabelAliases: sample.expectedVisibleElementLabelAliases,
              visibleText: sample.expectedVisibleText,
              notes: sample.expectedNotes
            }
          },
          diagnostics: {
            input: fullInputDiagnostics,
            parse: parseRes.diagnostics
          }
        },
        success: false,
        error: "Model returned invalid JSON",
        failureKind: "jsonParseError",
        sampleMetadata: {
          id: sample.id,
          title: sample.title,
          category: sample.category,
          licenseKind: sample.source.licenseKind,
          licenseName: sample.source.licenseName,
          attributionText: sample.source.attributionText,
          sourcePageUrl: sample.source.pageUrl
        },
        expectedMetadata: {
          imageKind: sample.expectedImageKind,
          elementCategories: sample.expectedElementCategories,
          elementCategoryAlternatives: sample.expectedElementCategoryAlternatives,
          visibleElementLabels: sample.expectedVisibleElementLabels,
          visibleElementLabelAliases: sample.expectedVisibleElementLabelAliases,
          visibleText: sample.expectedVisibleText,
          notes: sample.expectedNotes
        },
        analysisRun: runMetadata,
        parseDiagnostics: parseRes.diagnostics,
        inputDiagnostics: {
          sourceKind: runMetadata.input.sourceKind,
          sampleId: runMetadata.input.sampleId,
          mimeType: runMetadata.input.mimeType,
          byteLength: runMetadata.input.byteLength,
          base64Length: runMetadata.input.base64Length,
          imageVariant: "analysis",
          analysisSourceUrlKind: sourceUrlKind,
          inputSizeWarning,
          ...inputDiagnostics,
          cacheLayer: fetchResult.cacheLayer,
          cacheKey: fetchResult.cacheKey,
          cachePolicyVersion: fetchResult.cachePolicyVersion,
          cacheStored: fetchResult.cacheStored,
          cacheReadError: fetchResult.cacheReadError,
          cacheWriteError: fetchResult.cacheWriteError,
          cacheSharedInFlight: fetchResult.cacheSharedInFlight
        },
        ...(requestPreview ? { requestPreview } : {})
      } };
    }

    const parsed = parseRes.parsed;
    const parseDiagnosticsLight = {
      rawOutputLength: parseRes.diagnostics.rawOutputLength,
      attempts: parseRes.diagnostics.attempts,
      parseMode: parseRes.parseMode,
      ...(includeRequestPreview ? { rawOutputPreview: parseRes.diagnostics.rawOutputPreview } : {})
    };

    if (extractedCustomSchema) {
      const result: any = {
        record: {
          schemaVersion: "image-analysis-record.v0.1.0",
          status: { success: true },
          assetMetadata: {
            assetId: sample.id,
            title: sample.title,
            category: sample.category,
            sourceKind: "publicSample",
            sampleId: sample.id,
            sourceProvider: "publicSamples",
            sourcePageUrl: sample.source.pageUrl,
            licenseKind: sample.source.licenseKind,
            licenseName: sample.source.licenseName,
            attributionText: sample.source.attributionText
          },
          technicalMetadata: {
            mimeType: runMetadata.input.mimeType,
            originalByteLength: inputDiagnostics?.originalByteLength,
            processedByteLength: runMetadata.input.byteLength,
            base64Length: runMetadata.input.base64Length,
            inputFormat: inputDiagnostics?.inputFormat,
            outputFormat: inputDiagnostics?.outputFormat,
            resized: inputDiagnostics?.resized,
            recompressed: inputDiagnostics?.recompressed,
            reencoded: inputDiagnostics?.reencoded,
            quality: inputDiagnostics?.quality,
            analysisSizingPolicy: inputDiagnostics?.analysisSizingPolicy,
            analysisTargetLongEdge: inputDiagnostics?.analysisTargetLongEdge,
            analysisTargetBytes: inputDiagnostics?.analysisTargetBytes,
            analysisHardCapBytes: inputDiagnostics?.analysisHardCapBytes,
            analysisSizeReductionRatio: inputDiagnostics?.analysisSizeReductionRatio,
            targetExceededButAccepted: inputDiagnostics?.targetExceededButAccepted,
            hardCapExceeded: inputDiagnostics?.hardCapExceeded,
            minQualityReached: inputDiagnostics?.minQualityReached,
            providerSafeMimeType: inputDiagnostics?.providerSafeMimeType,
            originalDimensions: inputDiagnostics?.originalDimensions,
            processedDimensions: inputDiagnostics?.dimensions
          },
          visualAnalysis: parsed,
          analysisRun: runMetadata,
          evaluation: {
            expectedMetadata: {
              imageKind: sample.expectedImageKind,
              elementCategories: sample.expectedElementCategories,
              elementCategoryAlternatives: sample.expectedElementCategoryAlternatives,
              visibleElementLabels: sample.expectedVisibleElementLabels,
              visibleElementLabelAliases: sample.expectedVisibleElementLabelAliases,
              visibleText: sample.expectedVisibleText,
              notes: sample.expectedNotes
            },
            qualityStatus: "excellent",
            qualityScore: 100,
            qualityIssues: []
          },
          diagnostics: {
            input: fullInputDiagnostics,
            parse: parseDiagnosticsLight
          }
        },
        success: true,
        sampleMetadata: {
          id: sample.id,
          title: sample.title,
          category: sample.category,
          licenseKind: sample.source.licenseKind,
          licenseName: sample.source.licenseName,
          attributionText: sample.source.attributionText,
          sourcePageUrl: sample.source.pageUrl
        },
        expectedMetadata: {
          imageKind: sample.expectedImageKind,
          elementCategories: sample.expectedElementCategories,
          elementCategoryAlternatives: sample.expectedElementCategoryAlternatives,
          visibleElementLabels: sample.expectedVisibleElementLabels,
          visibleElementLabelAliases: sample.expectedVisibleElementLabelAliases,
          visibleText: sample.expectedVisibleText,
          notes: sample.expectedNotes
        },
        visualAnalysis: parsed,
        analysisRun: runMetadata,
        parseDiagnostics: parseDiagnosticsLight,
        qualityStatus: "excellent",
        qualityScore: 100,
        qualityIssues: [],
        experimentalModel: false,
        usedModelName: targetModel,
        providerFamily: isGemma ? "gemma" : "gemini",
        effectiveStructuredExecutionMode: mode,
        validationPassed: true,
        schemaVersion: "custom",
        rawOutput: outputText,
        inputDiagnostics: {
          sourceKind: runMetadata.input.sourceKind,
          sampleId: runMetadata.input.sampleId,
          mimeType: runMetadata.input.mimeType,
          byteLength: runMetadata.input.byteLength,
          base64Length: runMetadata.input.base64Length,
          imageVariant: "analysis",
          analysisSourceUrlKind: sourceUrlKind,
          inputSizeWarning,
          ...inputDiagnostics,
          cacheLayer: fetchResult.cacheLayer,
          cacheKey: fetchResult.cacheKey,
          cachePolicyVersion: fetchResult.cachePolicyVersion,
          cacheStored: fetchResult.cacheStored,
          cacheReadError: fetchResult.cacheReadError,
          cacheWriteError: fetchResult.cacheWriteError,
          cacheSharedInFlight: fetchResult.cacheSharedInFlight
        }
      };

      if (includeRequestPreview) {
        result.requestPreview = requestPreview;
      }

      return { status: 200, body: result };
    }

    let canonicalization = canonicalizeVisualAnalysisProviderOutput(parsed, {
      providerFamily: isGemma ? "gemma" : "gemini",
      modelName: targetModel,
      structuredExecutionMode: mode,
      jsonMode
    });
    let normalized = canonicalization.result;
    let validation = validateVisualAnalysis(normalized);

    let schemaValidationRecoveryAttempted = false;
    let schemaValidationRecoverySucceeded = false;
    let schemaValidationRetryCount = 0;
    let schemaValidationRetryParseSucceeded = false;
    let schemaValidationRetryValidationErrors: string[] = [];

    if (!validation.isValid && mode === "promptedJson") {
      schemaValidationRecoveryAttempted = true;
      console.warn(`[public-sample] Initial validation failed for ${sample.id}. Attempting schema-validation retry.`);
      
      const errorsList = validation.errors.join("\n- ");
      
      // 5. Use compact/excerpt JSON preview (limit size to ~3000 chars)
      const originalJsonStr = JSON.stringify(parsed, null, 2);
      let excerptJson = originalJsonStr;
      if (originalJsonStr.length > 3000) {
        excerptJson = originalJsonStr.slice(0, 1500) + "\n\n... [TRUNCATED ORIGINAL JSON FOR RETRY PROMPT] ...\n\n" + originalJsonStr.slice(-1500);
      }

      const retryPrompt = `The previous output was valid JSON but failed canonical schema validation with the following errors:\n- ${errorsList}\n\nOriginal JSON output (excerpt):\n${excerptJson}\n\nPlease analyze the image again and output only one valid JSON object that exactly matches the canonical schema.\n\nCRITICAL CONSTRAINTS:\n1. Use only canonical fields:\n   - schemaVersion\n   - summary\n   - visualInfo\n   - indexing\n   - quality\n2. DO NOT use "visual_elements", "layout", or other non-canonical top-level fields.\n3. Make sure to fill "visualInfo.sceneDescription".\n4. Put UI/form/layout elements under "visualInfo.visibleElements".\n5. Put all OCR text under "visualInfo.visibleText".\n\nOutput only valid JSON. Do not include markdown fences, explanations, or trailing text.`;

      try {
        const retryConfig = {
          ...configOption,
          temperature: 0.1,
        };
        delete retryConfig.responseMimeType;
        delete retryConfig.responseSchema;

        const retryAiRes = await generateContentWithRetry(
          targetModel,
          [
            { inlineData: { data: base64Data, mimeType: mimeType } },
            { text: retryPrompt }
          ],
          1,
          retryConfig
        );

        schemaValidationRetryCount++;
        const retryOutputText = retryAiRes.text?.trim() || "{}";
        const retryParseRes = parseModelJsonOutput(retryOutputText, 3);
        
        // Append retry's parse attempts to final parseDiagnostics
        parseRes.diagnostics.attempts.push(...retryParseRes.diagnostics.attempts);
        
        if (retryParseRes.ok) {
          schemaValidationRetryParseSucceeded = true;
          const retryCanonicalization = canonicalizeVisualAnalysisProviderOutput(retryParseRes.parsed, {
            providerFamily: isGemma ? "gemma" : "gemini",
            modelName: targetModel,
            structuredExecutionMode: mode,
            jsonMode
          });
          const retryValidation = validateVisualAnalysis(retryCanonicalization.result);
          
          schemaValidationRetryValidationErrors = retryValidation.errors;

          if (retryValidation.isValid) {
            schemaValidationRecoverySucceeded = true;
            canonicalization = retryCanonicalization;
            normalized = retryCanonicalization.result;
            validation = retryValidation;
            console.log(`[public-sample] Schema-validation recovery succeeded for ${sample.id}!`);
          } else {
            console.warn(`[public-sample] Schema-validation recovery output is still invalid: ${retryValidation.errors.join(", ")}`);
          }
        } else {
          schemaValidationRetryParseSucceeded = false;
          schemaValidationRetryValidationErrors = ["Failed to parse retry output as JSON: " + (retryParseRes.diagnostics.parseErrorMessage || "unknown parse error")];
        }
      } catch (retryErr: any) {
        console.error(`[public-sample] Schema-validation retry failed for ${sample.id}`, retryErr);
        schemaValidationRetryValidationErrors = ["Retry API call failed: " + (retryErr.message || String(retryErr))];
      }

      if (runMetadata.execution.jsonRecovery) {
        runMetadata.execution.jsonRecovery.schemaValidationRecoveryAttempted = schemaValidationRecoveryAttempted;
        runMetadata.execution.jsonRecovery.schemaValidationRecoverySucceeded = schemaValidationRecoverySucceeded;
        runMetadata.execution.jsonRecovery.schemaValidationRetryCount = schemaValidationRetryCount;
        runMetadata.execution.jsonRecovery.schemaValidationRetryParseSucceeded = schemaValidationRetryParseSucceeded;
        runMetadata.execution.jsonRecovery.schemaValidationRetryValidationErrors = schemaValidationRetryValidationErrors;
      }
    }

    let qualityStatus = "invalid";
    let qualityScore = 0;
    let qualityIssues = validation.errors.map(err => ({ code: "SCHEMA_ERROR", message: err, severity: "blocking" }));
    let isExperimental = mode === "promptedJson";

    if (validation.isValid) {
      const qReport = evaluateVisualAnalysisQuality(normalized, {
        modelName: targetModel,
        providerFamily: isGemma ? "gemma" : "gemini",
        effectiveStructuredExecutionMode: mode
      });
      qualityStatus = qReport.status;
      qualityScore = qReport.score;
      qualityIssues = qReport.issues;
      isExperimental = qReport.experimentalModel;
    }

    const result: any = {
      record: {
        schemaVersion: "image-analysis-record.v0.1.0",
        status: {
          success: validation.isValid,
          failureKind: validation.isValid ? undefined : "schemaValidationError"
        },
        assetMetadata: {
          assetId: sample.id,
          title: sample.title,
          category: sample.category,
          sourceKind: "publicSample",
          sampleId: sample.id,
          sourceProvider: "publicSamples",
          sourcePageUrl: sample.source.pageUrl,
          licenseKind: sample.source.licenseKind,
          licenseName: sample.source.licenseName,
          attributionText: sample.source.attributionText
        },
        technicalMetadata: {
          mimeType: runMetadata.input.mimeType,
          originalByteLength: inputDiagnostics?.originalByteLength,
          processedByteLength: runMetadata.input.byteLength,
          base64Length: runMetadata.input.base64Length,
          inputFormat: inputDiagnostics?.inputFormat,
          outputFormat: inputDiagnostics?.outputFormat,
          resized: inputDiagnostics?.resized,
          recompressed: inputDiagnostics?.recompressed,
          reencoded: inputDiagnostics?.reencoded,
          quality: inputDiagnostics?.quality,
          analysisSizingPolicy: inputDiagnostics?.analysisSizingPolicy,
          analysisTargetLongEdge: inputDiagnostics?.analysisTargetLongEdge,
          analysisTargetBytes: inputDiagnostics?.analysisTargetBytes,
          analysisHardCapBytes: inputDiagnostics?.analysisHardCapBytes,
          analysisSizeReductionRatio: inputDiagnostics?.analysisSizeReductionRatio,
          targetExceededButAccepted: inputDiagnostics?.targetExceededButAccepted,
          hardCapExceeded: inputDiagnostics?.hardCapExceeded,
          minQualityReached: inputDiagnostics?.minQualityReached,
          providerSafeMimeType: inputDiagnostics?.providerSafeMimeType,
          originalDimensions: inputDiagnostics?.originalDimensions,
          processedDimensions: inputDiagnostics?.dimensions
        },
        visualAnalysis: normalized,
        analysisRun: runMetadata,
        evaluation: {
          expectedMetadata: {
            imageKind: sample.expectedImageKind,
            elementCategories: sample.expectedElementCategories,
            elementCategoryAlternatives: sample.expectedElementCategoryAlternatives,
            visibleElementLabels: sample.expectedVisibleElementLabels,
            visibleElementLabelAliases: sample.expectedVisibleElementLabelAliases,
            visibleText: sample.expectedVisibleText,
            notes: sample.expectedNotes
          },
          qualityStatus,
          qualityScore,
          qualityIssues
        },
        diagnostics: {
          input: fullInputDiagnostics,
          parse: parseDiagnosticsLight,
          normalization: canonicalization.diagnostics
        }
      },
      success: validation.isValid,
      ...(validation.isValid ? {} : { failureKind: "schemaValidationError" }),
      sampleMetadata: {
        id: sample.id,
        title: sample.title,
        category: sample.category,
        licenseKind: sample.source.licenseKind,
        licenseName: sample.source.licenseName,
        attributionText: sample.source.attributionText,
        sourcePageUrl: sample.source.pageUrl
      },
      expectedMetadata: {
        imageKind: sample.expectedImageKind,
        elementCategories: sample.expectedElementCategories,
        elementCategoryAlternatives: sample.expectedElementCategoryAlternatives,
        visibleElementLabels: sample.expectedVisibleElementLabels,
        visibleElementLabelAliases: sample.expectedVisibleElementLabelAliases,
        visibleText: sample.expectedVisibleText,
        notes: sample.expectedNotes
      },
      visualAnalysis: normalized,
      analysisRun: runMetadata,
      parseDiagnostics: parseDiagnosticsLight,
      normalizationDiagnostics: canonicalization.diagnostics,
      qualityStatus,
      qualityScore,
      qualityIssues,
      experimentalModel: isExperimental,
      usedModelName: targetModel,
      providerFamily: isGemma ? "gemma" : "gemini",
      effectiveStructuredExecutionMode: mode,
      inputDiagnostics: {
        sourceKind: runMetadata.input.sourceKind,
        sampleId: runMetadata.input.sampleId,
        mimeType: runMetadata.input.mimeType,
        byteLength: runMetadata.input.byteLength,
        base64Length: runMetadata.input.base64Length,
        imageVariant: "analysis",
        analysisSourceUrlKind: sourceUrlKind,
        inputSizeWarning,
        ...inputDiagnostics,
        cacheLayer: fetchResult.cacheLayer,
        cacheKey: fetchResult.cacheKey,
        cachePolicyVersion: fetchResult.cachePolicyVersion,
        cacheStored: fetchResult.cacheStored,
        cacheReadError: fetchResult.cacheReadError,
        cacheWriteError: fetchResult.cacheWriteError,
        cacheSharedInFlight: fetchResult.cacheSharedInFlight
      }
    };

    if (includeRequestPreview && requestPreview) {
      result.requestPreview = requestPreview;
    }

    return { status: 200, body: result };
  } catch (err: any) {
    console.error("Public sample analysis error:", err.message);
    return { status: 500, body: { error: err.message || "Failed to analyze public sample" } };
  }
}

app.post("/api/visual/public-samples/analyze", async (req, res) => {
  try {
    const result = await analyzePublicSample(req.body);
    return res.status(result.status).json(result.body);
  } catch (e: any) {
    console.error(e);
    return res.status(500).json({ error: e.message || "Internal server error" });
  }
});
