/**
 * Pure helper module for index.md hybrid-merging.
 * Protects user written notes while replacing the auto-generated block cleanly.
 */

export const AUTO_GENERATED_START = "<!-- AUTO_GENERATED_START -->";
export const AUTO_GENERATED_END = "<!-- AUTO_GENERATED_END -->";

/**
 * Merges newly generated AI block into the existing index.md content.
 * Preserves the manual user notes zone completely.
 */
export function mergeIndexMd(
  currentFileContent: string,
  folderName: string,
  autoGenSectionContent: string
): string {
  if (currentFileContent.trim()) {
    const startIdx = currentFileContent.indexOf(AUTO_GENERATED_START);
    const endIdx = currentFileContent.indexOf(AUTO_GENERATED_END);

    if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
      const preSection = currentFileContent.substring(0, startIdx);
      const postSection = currentFileContent.substring(endIdx + AUTO_GENERATED_END.length);
      return preSection + AUTO_GENERATED_START + autoGenSectionContent + AUTO_GENERATED_END + postSection;
    } else {
      // Markers missing in existing file, append at the end as instructed
      return currentFileContent.trim() + "\n\n" + AUTO_GENERATED_START + autoGenSectionContent + AUTO_GENERATED_END;
    }
  } else {
    // Complete brand new file
    return `# ${folderName}

<!-- USER_NOTES_START -->
<!-- ここに自由なメモを追記してください。このエリアは自動更新で保護されます。 -->
<!-- USER_NOTES_END -->

${AUTO_GENERATED_START}${autoGenSectionContent}${AUTO_GENERATED_END}`;
  }
}
