import { describe, it } from 'node:test';
import assert from 'node:assert';
import { repairSummaryAnalysisV12ControlledVocabularies, normalizeAndRepairSummaryAnalysisV12 } from './repair';
import { SummaryAnalysisResultV12 } from './types';
import { getSummaryAnalysisV12ValidationErrors } from './validate';

describe('repairSummaryAnalysisV12ControlledVocabularies', () => {
  it('repairs vocabulary versions to draft.1', () => {
    const input: any = {
      documentKindInfo: { vocabularyVersion: "1.0.0", kinds: [] },
      subjectAreas: { vocabularyVersion: "1.0.0", domains: [] }
    };
    
    const { repaired, warnings } = repairSummaryAnalysisV12ControlledVocabularies(input);
    assert.strictEqual(repaired.documentKindInfo?.vocabularyVersion, "1.0.0-draft.1");
    assert.strictEqual(repaired.subjectAreas?.vocabularyVersion, "1.0.0-draft.1");
    assert.ok(warnings.some(w => w.includes("documentKindInfo.vocabularyVersion")));
  });

  it('repairs spreadsheet to dataset', () => {
    const input: any = {
      documentKindInfo: { kinds: [{ kind: "spreadsheet" }, { kind: "csv" }] }
    };
    
    const { repaired, warnings } = repairSummaryAnalysisV12ControlledVocabularies(input);
    assert.strictEqual(repaired.documentKindInfo?.kinds?.[0].kind, "dataset");
    assert.strictEqual(repaired.documentKindInfo?.kinds?.[1].kind, "dataset");
    assert.ok(warnings.some(w => w.includes("spreadsheet")));
  });

  it('repairs subject domain aliases', () => {
    const input: any = {
      subjectAreas: {
        domains: [
          { domain: "Computing and Internet" },
          { domain: "Culture and Entertainment" },
          { domain: "Totally Unknown Domain" }
        ]
      }
    };
    
    const { repaired, warnings } = repairSummaryAnalysisV12ControlledVocabularies(input);
    assert.strictEqual(repaired.subjectAreas?.domains?.[0].domain, "technology");
    assert.strictEqual(repaired.subjectAreas?.domains?.[1].domain, "artsAndCulture");
    assert.strictEqual(repaired.subjectAreas?.domains?.[2].domain, "other");
    assert.strictEqual(repaired.subjectAreas?.domains?.[2].labels?.[0].label, "Totally Unknown Domain");
    assert.ok(warnings.some(w => w.includes("Computing and Internet")));
  });

  it('repairs subject label kinds', () => {
    const input: any = {
      subjectAreas: {
        domains: [{ domain: "technology", labels: [{ kind: "service" }, { kind: "genre" }, { kind: "invalid-kind" }] }]
      }
    };
    
    const { repaired } = repairSummaryAnalysisV12ControlledVocabularies(input);
    const labels = repaired.subjectAreas?.domains?.[0].labels;
    assert.strictEqual(labels?.[0].kind, "product");
    assert.strictEqual(labels?.[1].kind, "topic");
    assert.strictEqual(labels?.[2].kind, "other");
  });

  it('repairs party role categories', () => {
    const input: any = {
      extractedFacts: {
        parties: [
          { roles: [{ roleCategory: "transaction" }, { roleCategory: "payer" }, { roleCategory: "unknown-cat" }] }
        ]
      }
    };
    
    const { repaired } = repairSummaryAnalysisV12ControlledVocabularies(input);
    const roles = repaired.extractedFacts?.parties?.[0].roles;
    assert.strictEqual(roles?.[0].roleCategory, "commerce");
    assert.strictEqual(roles?.[1].roleCategory, "payment");
    assert.strictEqual(roles?.[2].roleCategory, "other");
  });

  it('repairs temporal role categories', () => {
    const input: any = {
      extractedFacts: {
        temporalReferences: [
          { role: "publishedAt", roleCategory: "none" },
          { roleCategory: "invalid-cat" }
        ]
      }
    };
    
    const { repaired } = repairSummaryAnalysisV12ControlledVocabularies(input);
    const temps = repaired.extractedFacts?.temporalReferences;
    assert.strictEqual(temps?.[0].roleCategory, "publication");
    assert.strictEqual(temps?.[1].roleCategory, "other");
  });

  it('full cycle: normalize, repair, and validate passes strict checks', () => {
    // A highly "dirty" but logically sound summary from an LLM that ignored some strict constraints
    const dirtyInput: any = {
      summary: { 
        oneLine: "Testing repair full cycle",
        detailed: "Detailed summary text here."
      },
      titleInfo: {
        inferredTitle: "Repaired Title",
        displayTitle: { value: "Repaired Title", source: "inferredTitle" }
      },
      languageInfo: {
        primary: "en",
        detected: ["en"]
      },
      documentKindInfo: { 
        vocabularyVersion: "1.0.0", // old version
        kinds: [{ kind: "spreadsheet" }] // alias
      },
      subjectAreas: {
        vocabularyVersion: "1.0", // invalid format
        domains: [
          { 
            domain: "Computing and Internet", // alias
            confidence: 0.9,
            reason: "Discusses web technologies",
            labels: [{ label: "Web", kind: "service", confidence: 0.9, source: "surface" }] // invalid label kind
          }
        ]
      },
      extractedFacts: {
        parties: [
          { 
            name: "Test Corp", 
            roles: [{ role: "sponsor", roleCategory: "transaction" }] // alias
          }
        ],
        temporalReferences: [
          { role: "publishedDate", value: "2023-01-01", roleCategory: "none" } // publication mapping
        ]
      }
    };

    const { repaired, warnings } = normalizeAndRepairSummaryAnalysisV12(dirtyInput);
    
    // Repaired values should be correct
    assert.strictEqual(repaired.documentKindInfo?.kinds?.[0].kind, "dataset");
    assert.strictEqual(repaired.subjectAreas?.domains?.[0].domain, "technology");
    assert.strictEqual(repaired.subjectAreas?.domains?.[0].labels?.[0].kind, "product");
    assert.strictEqual(repaired.extractedFacts?.parties?.[0].roles?.[0].roleCategory, "commerce");
    assert.strictEqual(repaired.extractedFacts?.temporalReferences?.[0].roleCategory, "publication");

    // Validation checks
    const errors = getSummaryAnalysisV12ValidationErrors(repaired);
    assert.strictEqual(errors.length, 0, `Should have zero validation errors after repair: ${errors.join(', ')}`);
  });
});
