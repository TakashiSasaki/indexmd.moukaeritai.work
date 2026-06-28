import { ImageKind, VisibleElementCategory } from '../vocabularies';

export type PublicVisualSampleLicenseKind =
  | "publicDomain"
  | "cc0"
  | "ccBy"
  | "ccBySa"
  | "customFreeLicense"
  | "unknown";

export type PublicVisualSampleCategory =
  | "landscape"
  | "person"
  | "animal"
  | "plant"
  | "interior"
  | "furniture"
  | "stationery"
  | "bookshelf"
  | "receipt"
  | "ticket"
  | "screenshotLike"
  | "chartOrTable"
  | "documentLike"
  | "mixed"
  | "artwork"
  | "artifact"
  | "food"
  | "map"
  | "medical"
  | "space"
  | "ui"
  | "form"
  | "package";

export interface PublicVisualSampleSource {
  provider: string;
  pageUrl?: string;
  imageUrl?: string;
  thumbnailUrl?: string;
  licenseKind: PublicVisualSampleLicenseKind;
  licenseName: string;
  licenseUrl?: string;
  author?: string;
  requiresAttribution: boolean;
  attributionText?: string;
  retrievedAt?: string;
}

export interface PublicVisualSample {
  id: string;
  title: string;
  category: PublicVisualSampleCategory;
  expectedImageKind: ImageKind;
  expectedElementCategories: VisibleElementCategory[];
  expectedElementCategoryAlternatives?: Record<string, VisibleElementCategory[]>;
  expectedVisibleElementLabels?: string[];
  expectedVisibleElementLabelAliases?: Record<string, string[]>;
  expectedVisibleText?: string[];
  expectedNotes?: string;
  optionalElementCategories?: VisibleElementCategory[];
  optionalVisibleElementLabels?: string[];
  optionalVisibleElementLabelAliases?: Record<string, string[]>;
  optionalVisibleText?: string[];
  source: PublicVisualSampleSource;
  notes?: string;
}
