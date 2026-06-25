import test, { describe } from "node:test";
import assert from "node:assert";
import { buildReadOnlyIndexMdPreview } from "./indexMdPreview";

describe("indexMdPreview generation", () => {
  const currentPromptVersion = "1.1.0-draft.2";
  const nowIso = "2026-06-24T17:00:00.000Z";

  test("handles empty directory cleanly with instruction placeholder", () => {
    const preview = buildReadOnlyIndexMdPreview({
      folderName: "Empty Folder",
      filesInFolder: [],
      nowIso,
      promptVersion: currentPromptVersion
    });

    assert.ok(preview.includes("## AI Summary (生成日時: 2026-06-24T17:00:00.000Z)"));
    assert.ok(preview.includes("現在システム上に保存されている要約ファイルがありません"));
    assert.ok(preview.includes("直接配置された要約済みファイルが存在しません"));
    assert.ok(preview.includes("promptSpecVersion: 1.1.0-draft.2"));
    
    // Safety check: ensure no raw outputs or tokens
    assert.ok(!preview.includes("rawOutput"));
    assert.ok(!preview.includes("accessToken"));
  });

  test("handles directory with saved file summaries, missing names, stale/invalid metadata, empty subjectAreas, unknown types", () => {
    const files = [
      {
        fileId: "file-1",
        fileName: "report_annual.pdf",
        mimeType: "application/pdf",
        summary: "Annual Report summary",
        computedStatus: "current",
        structured: {
          oneLineSummary: "Annual financial results are highly positive.",
          topics: ["finance", "annual"],
          keywords: ["results", "positive"],
          documentTypes: ["report"],
          subjectAreas: { economics: ["accounting"] }
        }
      },
      {
        fileId: "file-2",
        // missing fileName
        mimeType: "text/plain",
        summary: "Plain notes",
        computedStatus: "stale-schema",
        structured: {
          oneLineSummary: "Plain meeting minutes",
          topics: [], // empty subjectAreas / topics
          keywords: [],
          documentTypes: [], // unknown documentTypes
          subjectAreas: {}
        }
      },
      {
        fileId: "file-3",
        fileName: "malicious.exe",
        summary: "Invalid file",
        computedStatus: "invalid",
        structured: {
          oneLineSummary: "Failed validation summary"
        }
      }
    ];

    const preview = buildReadOnlyIndexMdPreview({
      folderName: "Project Alpha",
      filesInFolder: files,
      nowIso,
      promptVersion: currentPromptVersion
    });

    // Verify it includes the title and file summaries
    assert.ok(preview.includes("report_annual.pdf"));
    assert.ok(preview.includes("Annual financial results are highly positive."));
    
    // Verify missing fileName fallback
    assert.ok(preview.includes("名称未設定ファイル"));
    
    // Verify stale schema warning badge in markdown
    assert.ok(preview.includes("[⚠️ スキーマが古いです]"));
    
    // Verify invalid badge in markdown
    assert.ok(preview.includes("[❌ 無効データ]"));
    
    // Verify empty/missing subjectAreas & unknown types fallback
    assert.ok(preview.includes("Type: 不明"));
    assert.ok(preview.includes("Topics: なし"));

    // Ensure no raw fields or sensitive tokens exist
    assert.ok(!preview.includes("accessToken"));
    assert.ok(!preview.includes("rawOutput"));
  });
});
