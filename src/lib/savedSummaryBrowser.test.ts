import test, { describe } from "node:test";
import assert from "node:assert";
import {
  sortSavedSummariesByGeneratedAt,
  filterSavedSummaries,
  summarizeSubjectAreas,
  getDocumentTypeOptions,
  getSubjectAreaOptions,
  sanitizeSavedSummaryForClipboard
} from "./savedSummaryBrowser";

describe("savedSummaryBrowser helpers", () => {
  const mockSummaries = [
    {
      id: "sum-1",
      fileId: "file-1",
      fileName: "financial_report_q1.pdf",
      model: "gemini-2.5-flash",
      summary: "First summary about finance",
      computedStatus: "current",
      generatedAt: "2026-06-24T10:00:00Z",
      structured: {
        documentTypes: ["report", "finance"],
        subjectAreas: { economics: ["macro"] }
      },
      rawOutput: "RAW AI OUTPUT",
      rawContent: "RAW FILE CONTENT",
      accessToken: "SECRET_ACCESS_TOKEN",
      refreshToken: "SECRET_REFRESH_TOKEN"
    },
    {
      id: "sum-2",
      fileId: "file-2",
      fileName: "technical_spec.md",
      model: "gemini-2.5-pro",
      summary: "Technical specification for indexing",
      computedStatus: "stale-schema",
      generatedAt: "2026-06-25T12:00:00Z", // later than sum-1
      structured: {
        documentTypes: ["spec", "tech"],
        subjectAreas: { computerScience: ["algorithms", "databases"] }
      }
    },
    {
      id: "sum-3",
      fileId: "file-3",
      fileName: "meeting_notes.txt",
      model: "gemini-2.5-flash",
      summary: "Discussion about project scope",
      computedStatus: "invalid",
      generatedAt: "invalid-date-string", // malformed date
      structured: {
        documentTypes: ["meeting-notes"],
        subjectAreas: {}
      }
    }
  ];

  test("sortSavedSummariesByGeneratedAt sorts by date descending and handles malformed dates without throwing", () => {
    const sorted = sortSavedSummariesByGeneratedAt(mockSummaries);
    assert.strictEqual(sorted[0].id, "sum-2"); // latest date (June 25)
    assert.strictEqual(sorted[1].id, "sum-1"); // middle date (June 24)
    assert.strictEqual(sorted[2].id, "sum-3"); // malformed date should fall back gracefully to the bottom
  });

  test("filterSavedSummaries handles empty lists and matches searches/filters correctly", () => {
    // Empty list
    const filteredEmpty = filterSavedSummaries([], "", "all", "all", "all");
    assert.strictEqual(filteredEmpty.length, 0);

    // Search by file name (case insensitive)
    const filteredName = filterSavedSummaries(mockSummaries, "REPORT", "all", "all", "all");
    assert.strictEqual(filteredName.length, 1);
    assert.strictEqual(filteredName[0].id, "sum-1");

    // Search by summary text
    const filteredSummary = filterSavedSummaries(mockSummaries, "specification", "all", "all", "all");
    assert.strictEqual(filteredSummary.length, 1);
    assert.strictEqual(filteredSummary[0].id, "sum-2");

    // Filter by status
    const filteredStatus = filterSavedSummaries(mockSummaries, "", "stale-schema", "all", "all");
    assert.strictEqual(filteredStatus.length, 1);
    assert.strictEqual(filteredStatus[0].id, "sum-2");

    // Filter by document type
    const filteredType = filterSavedSummaries(mockSummaries, "", "all", "tech", "all");
    assert.strictEqual(filteredType.length, 1);
    assert.strictEqual(filteredType[0].id, "sum-2");

    // Filter by subject area
    const filteredSubject = filterSavedSummaries(mockSummaries, "", "all", "all", "economics");
    assert.strictEqual(filteredSubject.length, 1);
    assert.strictEqual(filteredSubject[0].id, "sum-1");
  });

  test("summarizeSubjectAreas formats areas correctly", () => {
    const summaryStr = summarizeSubjectAreas({
      computerScience: ["ai", "security"],
      mathematics: ["algebra"]
    });
    assert.ok(summaryStr.includes("computerScience: [ai, security]"));
    assert.ok(summaryStr.includes("mathematics: [algebra]"));

    assert.strictEqual(summarizeSubjectAreas(null), "なし");
    assert.strictEqual(summarizeSubjectAreas({}), "なし");
  });

  test("getDocumentTypeOptions and getSubjectAreaOptions extract unique sorted options", () => {
    const types = getDocumentTypeOptions(mockSummaries);
    assert.deepStrictEqual(types, ["finance", "meeting-notes", "report", "spec", "tech"]);

    const subjects = getSubjectAreaOptions(mockSummaries);
    assert.deepStrictEqual(subjects, ["computerScience", "economics"]);
  });

  test("sanitizeSavedSummaryForClipboard strips raw fields and secrets perfectly", () => {
    const item = mockSummaries[0];
    const sanitized = sanitizeSavedSummaryForClipboard(item);

    assert.strictEqual(sanitized.id, undefined); // Omitted
    assert.strictEqual(sanitized.rawOutput, undefined); // Omitted
    assert.strictEqual(sanitized.rawContent, undefined); // Omitted
    assert.strictEqual(sanitized.accessToken, undefined); // Omitted
    assert.strictEqual(sanitized.refreshToken, undefined); // Omitted
    
    // Check safe fields are preserved
    assert.strictEqual(sanitized.fileId, "file-1");
    assert.strictEqual(sanitized.fileName, "financial_report_q1.pdf");
    assert.strictEqual(sanitized.summary, "First summary about finance");
  });
});
