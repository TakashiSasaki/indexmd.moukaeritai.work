import { PublicSampleComparisonSummary } from './compare';
import { ResponseDiagnostics, SafeFetchRetryDiagnostics } from '../safeFetch';

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
  inputDiagnostics?: any;
  responseRaw?: any;
  responseDiagnostics?: ResponseDiagnostics;
  retryDiagnostics?: SafeFetchRetryDiagnostics;
}

export interface PublicSampleBatchRunSummary {
  runId: string;
  timestamp: string;
  modelName: string;
  jsonMode: string;
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
