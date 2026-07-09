export interface PerformanceIssue {
  filePath: string;
  line: number;
  type: "warning" | "error";
  ruleId: string;
  message: string;
  snippet: string;
}

/**
 * Static Analysis Engine for detecting performance anti-patterns in React + Firebase applications.
 * Directly addresses "Proposal A" for automated performance regression detection.
 */
export function analyzePerformanceAntiPatterns(fileContent: string, filePath: string): PerformanceIssue[] {
  const issues: PerformanceIssue[] = [];
  const lines = fileContent.split("\n");

  // Skip analyzing non-source files or this detector file itself
  if (filePath.endsWith("performanceStaticAnalyzer.ts") || filePath.endsWith(".test.ts")) {
    return [];
  }

  // 1. Rule: NO_METADATA_CHANGES_UNGUARDED
  // includeMetadataChanges triggers dual snapshot updates for every single local document change.
  // Unless necessary, it should be avoided.
  const metadataChangesRegex = /includeMetadataChanges:\s*true/g;
  let match;
  while ((match = metadataChangesRegex.exec(fileContent)) !== null) {
    const charIndex = match.index;
    const lineNumber = fileContent.substring(0, charIndex).split("\n").length;
    const lineContent = lines[lineNumber - 1] || "";
    const prevLineContent = lines[lineNumber - 2] || "";

    // Allow manual bypass with comment on same or previous line
    const isBypassed = lineContent.includes("perf-bypass") || 
                       lineContent.includes("allow-metadata-changes") ||
                       prevLineContent.includes("perf-bypass") ||
                       prevLineContent.includes("allow-metadata-changes");

    if (!isBypassed) {
      issues.push({
        filePath,
        line: lineNumber,
        type: "warning",
        ruleId: "NO_METADATA_CHANGES_UNGUARDED",
        message: "Found '{ includeMetadataChanges: true }' inside onSnapshot. This causes dual snapshot events (local vs server) on every change, leading to double the rendering cascades. Use only when metadata synchronization tracking is strictly required, or add a '// perf-bypass' comment.",
        snippet: lineContent.trim(),
      });
    }
  }

  // 2. Rule: ONSNAPSHOT_CLEANUP_CHECK
  // Checks if onSnapshot is initialized inside a useEffect hook without a return unsubscribe or return () => unsubscribe() statement.
  // We scan the code for useEffect blocks that contain onSnapshot.
  const useEffectRegex = /useEffect\s*\(\s*\(\s*\)\s*=>\s*\{([\s\S]*?)\}\s*,\s*\[([\s\S]*?)\]\)/g;
  while ((match = useEffectRegex.exec(fileContent)) !== null) {
    const effectBody = match[1];
    const charIndex = match.index;
    const lineNumber = fileContent.substring(0, charIndex).split("\n").length;

    if (effectBody.includes("onSnapshot")) {
      // Check if there is a 'return' statement in the body of the useEffect
      const hasReturn = effectBody.includes("return ") || effectBody.includes("return\n");
      const hasUnsubscribe = effectBody.includes("unsubscribe") || effectBody.includes("cancel") || effectBody.includes("off");

      if (!hasReturn || !hasUnsubscribe) {
        issues.push({
          filePath,
          line: lineNumber,
          type: "error",
          ruleId: "ONSNAPSHOT_CLEANUP_CHECK",
          message: "onSnapshot is used inside useEffect but seems to be missing a proper cleanup (unsubscribe) returned by the effect hook. This causes severe memory and subscription leaks.",
          snippet: `useEffect(() => { ...onSnapshot... })`,
        });
      }
    }
  }

  // 3. Rule: USEEFFECT_DEPENDENCY_LITERAL_OBJECT
  // Inline objects or non-primitive array literals (excluding the empty dependency array '[]')
  // inside dependency arrays cause reference equality failures on every render, triggering infinite loops.
  const dependencyListRegex = /useEffect\s*\(\s*\([\s\S]*?\)\s*=>\s*[\s\S]*?,\s*\[([\s\S]*?)\]\)/g;
  while ((match = dependencyListRegex.exec(fileContent)) !== null) {
    const depList = match[1].trim();
    const charIndex = match.index;
    const lineNumber = fileContent.substring(0, charIndex).split("\n").length;

    // Check for inline objects like {} or arrays like [] nested inside the dependencies list
    // e.g. [someVal, {}] or [someVal, []]
    // Note: [] as the entire dependency list is perfectly fine (mount only)
    if (depList !== "" && (depList.includes("{}") || depList.includes("[]") || /new\s+\w+/.test(depList))) {
      issues.push({
        filePath,
        line: lineNumber,
        type: "error",
        ruleId: "USEEFFECT_DEPENDENCY_LITERAL_OBJECT",
        message: "Found an inline object, array, or instantiation inside useEffect's dependency array. This triggers referential inequality on every single render, causing runaway infinite render loops.",
        snippet: `useEffect(..., [${depList}])`,
      });
    }
  }

  // 4. Rule: PREVENT_SET_STATE_LOOP_HAZARD
  // Checks if state setters are called unconditionally within rendering paths (outside event handlers or useEffects).
  // This is a simple static heuristic checking if a component has setX(someValue) directly in body.
  const linesCount = lines.length;
  for (let i = 0; i < linesCount; i++) {
    const line = lines[i];
    if (line.includes("const [") && line.includes("useState")) {
      // Find setter name
      const setterMatch = line.match(/const\s*\[\s*\w+\s*,\s*(\w+)\s*\]/);
      if (setterMatch && setterMatch[1]) {
        const setterName = setterMatch[1];
        // Scan the file for unconditional calls to setterName
        // If it's called directly in the file, not inside a function, useEffect, or callback.
        const setterRegex = new RegExp("[^a-zA-Z0-9_$]" + setterName + "\\(", "g");
        let sMatch;
        while ((sMatch = setterRegex.exec(fileContent)) !== null) {
          const sIndex = sMatch.index;
          const sLineNum = fileContent.substring(0, sIndex).split("\n").length;
          const sLineContent = lines[sLineNum - 1] || "";
          
          // Simple safety check: check if it's inside useEffect, handler function, or async call
          const isSafe = sLineContent.includes("useEffect") || 
                         sLineContent.includes("function") || 
                         sLineContent.includes("=>") || 
                         sLineContent.includes("Handler") ||
                         sLineContent.includes("onClick") ||
                         sLineContent.includes("onSelect") ||
                         sLineContent.includes("setTimeout") ||
                         sLineContent.includes("setInterval") ||
                         sLineContent.includes("Promise") ||
                         sLineContent.includes(".then") ||
                         sLineContent.includes("async");
                         
          if (!isSafe && sLineContent.trim().startsWith(setterName)) {
            issues.push({
              filePath,
              line: sLineNum,
              type: "warning",
              ruleId: "PREVENT_SET_STATE_LOOP_HAZARD",
              message: `State setter '${setterName}' is called on the direct execution path of the component, which can trigger an immediate re-render and infinite loop.`,
              snippet: sLineContent.trim(),
            });
          }
        }
      }
    }
  }

  return issues;
}
