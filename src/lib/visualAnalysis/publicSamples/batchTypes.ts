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
  items: PublicSampleBatchRunItem[];
}
