#!/bin/bash
sed -i 's/import { GEMINI_VISUAL_ANALYSIS_RESPONSE_SCHEMA } from ".\/src\/lib\/visualAnalysis\/providerSchema";/import { compileProviderSchema } from ".\/src\/lib\/visualAnalysis\/schemaCompiler";/g' server.ts
sed -i 's/extractedSchema || GEMINI_VISUAL_ANALYSIS_RESPONSE_SCHEMA/extractedSchema || compileProviderSchema(VISUAL_ANALYSIS_SCHEMA).schema/g' server.ts
sed -i 's/providerResponseSchemaName: mode === "nativeSchema" ? (extractedCustomSchema ? "custom" : "GEMINI_VISUAL_ANALYSIS_RESPONSE_SCHEMA") : undefined,/providerResponseSchemaName: mode === "nativeSchema" ? (extractedCustomSchema ? "custom" : "compiledProviderSchema") : undefined,/g' server.ts
