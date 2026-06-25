export interface PreviewFile {
  fileId: string;
  fileName?: string;
  mimeType?: string;
  summary?: string;
  computedStatus?: string;
  structured?: {
    oneLineSummary?: string;
    topics?: string[];
    keywords?: string[];
    documentTypes?: string[];
    subjectAreas?: Record<string, string[]>;
  };
}

export function buildReadOnlyIndexMdPreview(options: {
  folderName: string;
  filesInFolder: PreviewFile[];
  nowIso: string;
  promptVersion: string;
}): string {
  const { folderName, filesInFolder, nowIso, promptVersion } = options;

  let folderSummary = "";
  if (filesInFolder.length > 0) {
    const validCount = filesInFolder.filter(f => f.computedStatus === "current").length;
    const allTopics = Array.from(
      new Set(filesInFolder.flatMap(f => f.structured?.topics || []))
    ).filter(Boolean);
    const mainTopicsStr = allTopics.slice(0, 5).join("、") || "一般事務";
    folderSummary = `このディレクトリには ${filesInFolder.length} 件の要約済み重要ドキュメントが配置されています（最新: ${validCount}件）。主要テーマは ${mainTopicsStr} です。`;
  } else {
    folderSummary = `*このディレクトリには、現在システム上に保存されている要約ファイルがありません。要約テストを実行し、このフォルダを関連付けて保存してください。*`;
  }

  const filesMarkdown = filesInFolder
    .map(file => {
      const name = file.fileName || "名称未設定ファイル";
      const formatMime = file.mimeType ? file.mimeType.split("/").pop() : "不明";
      
      const oneLine = file.structured?.oneLineSummary || file.summary || "要約情報なし";
      
      // Append status badges if stale or invalid
      let statusLabel = "";
      if (file.computedStatus === "stale-schema") {
        statusLabel = " [⚠️ スキーマが古いです]";
      } else if (file.computedStatus === "stale-prompt") {
        statusLabel = " [⚠️ プロンプトが古いです]";
      } else if (file.computedStatus === "stale-file") {
        statusLabel = " [⚠️ ファイル更新あり]";
      } else if (file.computedStatus === "invalid") {
        statusLabel = " [❌ 無効データ]";
      }

      const topics = file.structured?.topics?.filter(Boolean).join(", ") || "なし";
      const keywords = file.structured?.keywords?.filter(Boolean).join(", ") || "なし";
      
      // Handle document types
      const docTypes = file.structured?.documentTypes?.filter(Boolean).join(", ") || "不明";
      
      return `- **${name}** (${formatMime})${statusLabel} - ${oneLine}\n  *Type: ${docTypes} | Topics: ${topics} | Keywords: ${keywords}*`;
    })
    .join("\n\n");

  return `<!-- AUTO_GENERATED_START -->
## AI Summary (生成日時: ${nowIso})
${folderSummary}

## Files
${filesMarkdown || "*このディレクトリには直接配置された要約済みファイルが存在しません。*"}

## Subdirectories
*このディレクトリ配下のサブディレクトリ階層は走査データに基づき後ほど追加されます。*

<!-- formatVersion: 1.0.0, promptSpecVersion: ${promptVersion} -->
<!-- AUTO_GENERATED_END -->`;
}
