import { PublicSampleComparisonSummary } from './compare';

export interface PublicSampleBatchRunItem {
  sampleId: string;
  title: string;
  success: boolean;
  qualityStatus?: string;
  qualityScore?: number;
  qualityIssues?: any[];
  analysisRun?: any;
  parseDiagnostics?: any;
  comparison?: PublicSampleComparisonSummary;
  error?: string;
  failureKind?: string;
  generationDiagnostics?: any;
  inputDiagnostics?: {
    sourceKind: "publicSample";
    sampleId: string;
    mimeType?: string;
    byteLength?: number;
    base64Length?: number;
    dimensions?: { width: number; height: number };
  };
  responseRaw?: any;
}

export interface PublicSampleBatchRunSummary {
  runId: string;
  timestamp: string;
  modelName: string;
  jsonMode: string;
  retryOnInvalidJson: boolean;
  total: number;
  successCount: number;
  failureCount: number;
  validCount: number;
  validLowQualityCount: number;
  invalidJsonCount: number;
  expectedComparisonPassCount: number;
  expectedComparisonWarningCount: number;
  expectedComparisonFailCount: number;
  reviewPassCount?: number;
  reviewNeedsReviewCount?: number;
  reviewFailCount?: number;
  items: PublicSampleBatchRunItem[];
}
