import documentKindsJson from "../../../schemas/vocabularies/document-kinds.v1.0.0-draft.1.json";
import subjectDomainsJson from "../../../schemas/vocabularies/subject-domains.v1.0.0-draft.1.json";
import subjectLabelKindsJson from "../../../schemas/vocabularies/subject-label-kinds.v1.0.0-draft.1.json";
import extractionRoleCategoriesJson from "../../../schemas/vocabularies/extraction-role-categories.v1.0.0-draft.1.json";
import keywordSourcesJson from "../../../schemas/vocabularies/keyword-sources.v1.0.0-draft.1.json";

export const DOCUMENT_KIND_VOCABULARY_VERSION = "1.0.0-draft.1";
export const SUBJECT_DOMAIN_VOCABULARY_VERSION = "1.0.0-draft.1";
export const SUBJECT_LABEL_KIND_VOCABULARY_VERSION = "1.0.0-draft.1";
export const EXTRACTION_ROLE_CATEGORY_VOCABULARY_VERSION = "1.0.0-draft.1";
export const KEYWORD_SOURCE_VOCABULARY_VERSION = "1.0.0-draft.1";

export const DOCUMENT_KINDS_JSON = documentKindsJson;
export const SUBJECT_DOMAINS_JSON = subjectDomainsJson;
export const SUBJECT_LABEL_KINDS_JSON = subjectLabelKindsJson;
export const EXTRACTION_ROLE_CATEGORIES_JSON = extractionRoleCategoriesJson;
export const KEYWORD_SOURCES_JSON = keywordSourcesJson;

export const DOCUMENT_KINDS = documentKindsJson.terms.map((t) => t.value);
export const SUBJECT_DOMAINS = subjectDomainsJson.terms.map((t) => t.value);
export const SUBJECT_LABEL_KINDS = subjectLabelKindsJson.terms.map((t) => t.value);
export const KEYWORD_SOURCES = keywordSourcesJson.terms.map((t) => t.value);

export const TEMPORAL_ROLE_CATEGORIES = extractionRoleCategoriesJson.temporalRoleCategories.map((t) => t.value);
export const PARTY_KINDS = extractionRoleCategoriesJson.partyKinds.map((t) => t.value);
export const PARTY_ROLE_CATEGORIES = extractionRoleCategoriesJson.partyRoleCategories.map((t) => t.value);
export const MONETARY_ROLE_CATEGORIES = extractionRoleCategoriesJson.monetaryRoleCategories.map((t) => t.value);
