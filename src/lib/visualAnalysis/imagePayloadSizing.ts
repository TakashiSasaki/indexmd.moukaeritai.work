import sharp from 'sharp';

export type AnalysisSizingPolicy = "default" | "detailHeavy";

export interface SizingPolicyConstraints {
  targetLongEdge: number;
  targetBytes: number;
  hardCapBytes: number;
}

export const SIZING_POLICIES: Record<AnalysisSizingPolicy, SizingPolicyConstraints> = {
  default: {
    targetLongEdge: 1024,
    targetBytes: 1 * 1024 * 1024, // 1MB
    hardCapBytes: 1.5 * 1024 * 1024, // 1.5MB
  },
  detailHeavy: {
    targetLongEdge: 1536,
    targetBytes: 1 * 1024 * 1024, // 1MB
    hardCapBytes: 2 * 1024 * 1024, // 2MB
  }
};

export interface ImageProcessingDiagnostics {
  originalDimensions?: { width: number; height: number };
  dimensions?: { width: number; height: number };
  originalByteLength: number;
  processedByteLength: number;
  resized: boolean;
  recompressed: boolean;
  reencoded?: boolean;
  outputFormat: "jpeg" | "png" | "webp";
  quality: number;
  analysisSizingPolicy: AnalysisSizingPolicy;
  analysisTargetLongEdge: number;
  analysisTargetBytes: number;
  analysisHardCapBytes: number;
  analysisSizeReductionRatio: number;
  targetExceededButAccepted?: boolean;
  hardCapExceeded?: boolean;
  minQualityReached?: boolean;
  processingFailureReason?: string;
  inputFormat?: string;
  providerSafeMimeType?: boolean;
}

export interface ProcessedImageResult {
  buffer: Buffer;
  mimeType: string;
  diagnostics: ImageProcessingDiagnostics;
}

/**
 * Resizes and recompresses an image to fit within the constraints of the chosen sizing policy.
 * It favors pixel dimension control as the primary lever, and compression quality as the secondary lever.
 */
export async function optimizeImageForAnalysis(
  inputBuffer: Buffer,
  policyName: AnalysisSizingPolicy
): Promise<ProcessedImageResult> {
  const policy = SIZING_POLICIES[policyName];
  const originalByteLength = inputBuffer.byteLength;
  
  let minQuality = policyName === 'detailHeavy' ? 65 : 40;
  let minQualityReached = false;
  let targetExceededButAccepted = false;
  let hardCapExceeded = false;
  let processingFailureReason = undefined;

  let image = sharp(inputBuffer);
  const metadata = await image.metadata();
  
  const originalDimensions = metadata.width && metadata.height ? { width: metadata.width, height: metadata.height } : undefined;
  let currentDimensions = originalDimensions;
  
  // Convert SVG to PNG
  if (metadata.format === 'svg') {
    image = sharp(await image.png().toBuffer());
    // Get new dimensions
    const newMetadata = await image.metadata();
    currentDimensions = newMetadata.width && newMetadata.height ? { width: newMetadata.width, height: newMetadata.height } : undefined;
  }
  
  let resized = false;
  
  if (currentDimensions) {
    const longEdge = Math.max(currentDimensions.width, currentDimensions.height);
    if (longEdge > policy.targetLongEdge) {
      // Resize preserving aspect ratio
      image = image.resize({
        width: currentDimensions.width >= currentDimensions.height ? policy.targetLongEdge : undefined,
        height: currentDimensions.height > currentDimensions.width ? policy.targetLongEdge : undefined,
        fit: 'inside',
        withoutEnlargement: true
      });
      resized = true;
      // We will get the exact new dimensions after rendering
    }
  }

  // Determine optimal output format based on input and policy
  // For most things, JPEG provides better byte size for photos.
  // PNG is better for charts/text, but often struggles to hit <1MB if large.
  // WebP is a good compromise, but some models prefer JPEG. We'll use JPEG as default unless it has transparency.
  let targetFormat = (metadata.format === 'png' || metadata.hasAlpha || metadata.format === 'svg') ? 'png' : 'jpeg';
  
  // Try generating output
  let quality = targetFormat === 'jpeg' ? 85 : 90;
  let recompressed = false;
  
  let outputBuffer: Buffer;
  
  // First attempt
  if (targetFormat === 'jpeg') {
    outputBuffer = await image.jpeg({ quality, mozjpeg: true }).toBuffer();
  } else {
    // For PNG, use standard compression. If it fails to meet size, we'll try something else.
    outputBuffer = await image.png({ effort: 7 }).toBuffer();
  }
  
  // If we're already under target size, we're good
  if (outputBuffer.byteLength > policy.targetBytes) {
    recompressed = true;
    
    // Try to reduce size
    if (targetFormat === 'png') {
      // PNG is too big, let's try converting to JPEG if we can (dropping alpha with white background)
      // or just WebP. Let's try WebP first as it preserves alpha.
      const webpBuffer = await image.webp({ quality: 80 }).toBuffer();
      if (webpBuffer.byteLength < outputBuffer.byteLength) {
        targetFormat = 'webp';
        outputBuffer = webpBuffer;
        quality = 80;
      }
    }
    
    // If still over target, start aggressively compressing (only if JPEG/WebP)
    while (outputBuffer.byteLength > policy.targetBytes && quality > minQuality) {
      quality -= 10;
      if (targetFormat === 'jpeg') {
        outputBuffer = await image.jpeg({ quality, mozjpeg: true }).toBuffer();
      } else if (targetFormat === 'webp') {
        outputBuffer = await image.webp({ quality }).toBuffer();
      } else {
        break; // Can't easily dial down PNG quality without palette changes
      }
    }
    
    if (quality <= minQuality) {
      minQualityReached = true;
    }
    
    if (outputBuffer.byteLength > policy.targetBytes && outputBuffer.byteLength <= policy.hardCapBytes) {
      targetExceededButAccepted = true;
    }
  }
  
  // Check if we hit the hard cap
  if (outputBuffer.byteLength > policy.hardCapBytes) {
    hardCapExceeded = true;
    throw new Error(`Image size (${Math.round(outputBuffer.byteLength / 1024)}KB) exceeds hard cap of ${Math.round(policy.hardCapBytes / 1024)}KB even after resize/recompression.`);
  }

  // Get final dimensions
  const finalMetadata = await sharp(outputBuffer).metadata();
  const dimensions = finalMetadata.width && finalMetadata.height ? { width: finalMetadata.width, height: finalMetadata.height } : undefined;
  
  // Determine final mime type
  let mimeType = 'image/jpeg';
  if (targetFormat === 'png') mimeType = 'image/png';
  if (targetFormat === 'webp') mimeType = 'image/webp';
  
  const processedByteLength = outputBuffer.byteLength;
  const analysisSizeReductionRatio = processedByteLength / originalByteLength;

  return {
    buffer: outputBuffer,
    mimeType,
    diagnostics: {
      originalDimensions,
      dimensions,
      originalByteLength,
      processedByteLength,
      resized,
      recompressed: recompressed || processedByteLength !== originalByteLength || targetFormat !== metadata.format || metadata.format === 'svg' || (targetFormat === 'jpeg' && quality !== 85) || (targetFormat === 'png' && quality !== 90),
      reencoded: true,
      outputFormat: targetFormat as any,
      quality,
      analysisSizingPolicy: policyName,
      analysisTargetLongEdge: policy.targetLongEdge,
      analysisTargetBytes: policy.targetBytes,
      analysisHardCapBytes: policy.hardCapBytes,
      analysisSizeReductionRatio,
      targetExceededButAccepted,
      hardCapExceeded,
      minQualityReached,
      processingFailureReason,
      inputFormat: metadata.format,
      providerSafeMimeType: true
    }
  };
}
