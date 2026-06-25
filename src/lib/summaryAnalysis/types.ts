export enum ExplicitTitleSource {
  EmbeddedMetadata = "embeddedMetadata",
  DocumentHeading = "documentHeading"
}

export enum DisplayTitleSource {
  ExplicitTitle = "explicitTitle",
  FileNameTitle = "fileNameTitle",
  InferredTitle = "inferredTitle",
  SystemFallback = "systemFallback"
}

export enum NamedEntityType {
  Person = "person",
  Organization = "organization",
  Location = "location",
  Artifact = "artifact",
  Initiative = "initiative",
  Unclassified = "unclassified"
}

export interface SummaryInfo {
  oneLine: string;
  detailed: string;
}

export interface ExplicitTitleInfo {
  value: string;
  source: ExplicitTitleSource;
}

export interface FileNameTitleInfo {
  value: string;
  isGeneric: boolean;
  genericReason?: string;
}

export interface DisplayTitleInfo {
  value: string;
  source: DisplayTitleSource;
  reason: string;
}

export interface TitleInfo {
  explicitTitle: ExplicitTitleInfo | null;
  fileNameTitle: FileNameTitleInfo | null;
  inferredTitle: string;
  displayTitle: DisplayTitleInfo;
}

export interface DocumentKind {
  kind: string;
  confidence: number;
  reason: string;
}

export interface DocumentKindInfo {
  vocabularyVersion: string;
  kinds: DocumentKind[];
}

export interface FileFormatInfo {
  mimeType: string | null;
  extension: string | null;
}

export interface SubjectLabel {
  label: string;
  kind: string;
  confidence: number;
}

export interface SubjectDomainInfo {
  domain: string;
  confidence: number;
  reason: string;
  labels: SubjectLabel[];
}

export interface SubjectAreasInfo {
  vocabularyVersion: string;
  domains: SubjectDomainInfo[];
}

export interface LanguageInfo {
  primary: string;
  detected: string[];
}

export interface NamedEntity {
  name: string;
  type: NamedEntityType;
}

export interface ResourceReference {
  uri: string;
  label?: string;
  raw?: string;
}

export interface IndexingInfo {
  topics: string[];
  keywords: string[];
  namedEntities: NamedEntity[];
  resourceReferences: ResourceReference[];
}

export interface TemporalReference {
  value: string;
  normalizedDate?: string;
  role: string;
  roleCategory: string;
  raw?: string;
  confidence: number;
}

export interface PartyRole {
  role: string;
  roleCategory: string;
  confidence: number;
}

export interface Party {
  name: string;
  kind: string;
  roles: PartyRole[];
}

export interface MonetaryAmount {
  amount: number;
  currency: string;
  role: string;
  roleCategory: string;
  raw?: string;
  confidence: number;
}

export interface ExtractedFacts {
  temporalReferences: TemporalReference[];
  parties: Party[];
  monetaryAmounts: MonetaryAmount[];
}

export interface ExtractionQuality {
  confidence: number;
  warnings: string[];
}

export interface SummaryAnalysisResultV12 {
  summary: SummaryInfo;
  titleInfo: TitleInfo;
  documentKindInfo: DocumentKindInfo;
  fileFormatInfo: FileFormatInfo;
  subjectAreas: SubjectAreasInfo;
  languageInfo: LanguageInfo;
  indexing: IndexingInfo;
  extractedFacts: ExtractedFacts;
  quality: ExtractionQuality;
}
