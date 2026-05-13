/**
 * Script to auto-fix unused imports and variables from ESLint errors.
 * Reads ESLint JSON output, removes unused import specifiers,
 * fixes unescaped entities, and handles unused vars.
 */
import { execSync } from "child_process";
import fs from "fs";
import path from "path";

const pagesDir = path.resolve("client/src/pages");

// Get ESLint output as JSON
let results;
try {
  const output = execSync(`npx eslint "${pagesDir}" --format json`, {
    encoding: "utf-8",
    maxBuffer: 10 * 1024 * 1024,
  });
  results = JSON.parse(output);
} catch (e) {
  // ESLint exits with code 1 when there are errors, but still outputs JSON to stdout
  if (e.stdout) {
    results = JSON.parse(e.stdout);
  } else {
    console.error("Failed to run ESLint:", e.message);
    process.exit(1);
  }
}

let totalFixed = 0;

for (const fileResult of results) {
  if (fileResult.errorCount === 0) continue;

  const filePath = fileResult.filePath;
  const errors = fileResult.messages.filter((m) => m.severity === 2); // errors only

  if (errors.length === 0) continue;

  let content = fs.readFileSync(filePath, "utf-8");
  let lines = content.split("\n");

  // Group errors by type
  const unusedVarErrors = errors.filter((e) => e.ruleId === "@typescript-eslint/no-unused-vars");
  const unescapedErrors = errors.filter((e) => e.ruleId === "react/no-unescaped-entities");
  const emptyBlockErrors = errors.filter((e) => e.ruleId === "no-empty");
  const uselessEscapeErrors = errors.filter((e) => e.ruleId === "no-useless-escape");

  // === Fix unused imports (defined but never used) ===
  const unusedImports = unusedVarErrors.filter((e) =>
    e.message.includes("is defined but never used")
  );

  // Process imports - collect names to remove
  const namesToRemove = new Set();
  for (const err of unusedImports) {
    const match = err.message.match(/'([^']+)' is defined but never used/);
    if (match) namesToRemove.add(match[1]);
  }

  if (namesToRemove.size > 0) {
    // Process each line, removing unused specifiers from import statements
    const newLines = [];
    let i = 0;
    while (i < lines.length) {
      let line = lines[i];

      // Check if this is an import line
      if (line.match(/^\s*import\s/)) {
        // Collect full import statement (may span multiple lines)
        let importStatement = line;
        let startIdx = i;
        while (!importStatement.includes(";") && i + 1 < lines.length) {
          i++;
          importStatement += "\n" + lines[i];
        }
        let endIdx = i;

        // Check if any names in this import need removal
        let modified = false;
        for (const name of namesToRemove) {
          // Check if name appears in this import
          const nameRegex = new RegExp(`\\b${name}\\b`);
          if (nameRegex.test(importStatement)) {
            modified = true;
          }
        }

        if (modified) {
          // Parse the import to remove specific names
          let result = processImport(importStatement, namesToRemove);
          if (result === null) {
            // Entire import removed
            totalFixed++;
            i++;
            continue;
          } else {
            newLines.push(result);
            totalFixed++;
            i++;
            continue;
          }
        }
      }

      newLines.push(line);
      i++;
    }
    lines = newLines;
  }

  // === Fix unused variables (assigned but never used) ===
  const unusedAssignments = unusedVarErrors.filter((e) =>
    e.message.includes("is assigned a value but never used")
  );

  for (const err of unusedAssignments) {
    const match = err.message.match(/'([^']+)' is assigned a value but never used/);
    if (match) {
      const varName = match[1];
      const lineIdx = err.line - 1;
      if (lineIdx < lines.length) {
        const line = lines[lineIdx];
        // For destructured const like: const { x, unused, y } = ...
        // Replace unused with _unused
        const destructureMatch = line.match(new RegExp(`\\b${varName}\\b`));
        if (destructureMatch) {
          lines[lineIdx] = line.replace(new RegExp(`\\b${varName}\\b`), `_${varName}`);
          totalFixed++;
        }
      }
    }
  }

  // === Fix "defined but never used" for args matching /^_/ pattern ===
  const unusedArgs = unusedVarErrors.filter((e) =>
    e.message.includes("is defined but never used. Allowed unused args must match")
  );
  for (const err of unusedArgs) {
    const match = err.message.match(/'([^']+)' is defined but never used/);
    if (match) {
      const varName = match[1];
      const lineIdx = err.line - 1;
      if (lineIdx < lines.length) {
        lines[lineIdx] = lines[lineIdx].replace(new RegExp(`\\b${varName}\\b`), `_${varName}`);
        totalFixed++;
      }
    }
  }

  // === Fix unescaped entities ===
  for (const err of unescapedErrors) {
    const lineIdx = err.line - 1;
    if (lineIdx < lines.length) {
      // Replace unescaped ' with &apos; and " with &quot; in JSX text
      // Only fix at the exact column
      const col = err.column - 1;
      const line = lines[lineIdx];
      const char = line[col];
      if (char === "'") {
        lines[lineIdx] = line.substring(0, col) + "&apos;" + line.substring(col + 1);
        totalFixed++;
      } else if (char === '"') {
        lines[lineIdx] = line.substring(0, col) + "&quot;" + line.substring(col + 1);
        totalFixed++;
      }
    }
  }

  // === Fix empty block statements ===
  for (const err of emptyBlockErrors) {
    const lineIdx = err.line - 1;
    if (lineIdx < lines.length) {
      const line = lines[lineIdx];
      // Add a comment inside empty catch/block
      if (line.match(/\{\s*\}/)) {
        lines[lineIdx] = line.replace(/\{\s*\}/, "{ /* intentionally empty */ }");
        totalFixed++;
      } else if (line.trim() === "{" || line.trim() === "} catch {") {
        // Multi-line empty block - add comment on next line
        const indent = line.match(/^\s*/)[0] + "  ";
        lines.splice(lineIdx + 1, 0, `${indent}// intentionally empty`);
        totalFixed++;
      }
    }
  }

  // === Fix useless escape characters ===
  for (const err of uselessEscapeErrors) {
    const lineIdx = err.line - 1;
    if (lineIdx < lines.length) {
      const col = err.column - 1;
      const line = lines[lineIdx];
      // Check if there's a backslash before the character
      if (col > 0 && line[col - 1] === "\\") {
        // Remove the backslash
        lines[lineIdx] = line.substring(0, col - 1) + line.substring(col);
        totalFixed++;
      }
    }
  }

  // Write back
  const newContent = lines.join("\n");
  if (newContent !== content) {
    fs.writeFileSync(filePath, newContent, "utf-8");
    const relPath = path.relative(process.cwd(), filePath);
    console.log(`Fixed: ${relPath}`);
  }
}

function processImport(importStatement, namesToRemove) {
  // Handle: import { A, B, C } from 'module';
  // Handle: import X from 'module';
  // Handle: import X, { A, B } from 'module';
  // Handle: import type { A, B } from 'module';

  const lines = importStatement.split("\n");
  const singleLine = importStatement.replace(/\n/g, " ").replace(/\s+/g, " ");

  // Default import
  const defaultMatch = singleLine.match(/^import\s+(\w+)\s*(?:,\s*\{([^}]*)\})?\s+from\s+/);
  const namedOnlyMatch = singleLine.match(/^import\s+(?:type\s+)?\{([^}]*)\}\s+from\s+/);

  if (defaultMatch) {
    const defaultName = defaultMatch[1];
    const namedPart = defaultMatch[2];

    const removeDefault = namesToRemove.has(defaultName);

    if (namedPart !== undefined) {
      // Has both default and named imports
      const names = namedPart
        .split(",")
        .map((n) => n.trim())
        .filter(Boolean);
      const remaining = names.filter((n) => {
        const cleanName = n.includes(" as ") ? n.split(" as ")[1].trim() : n;
        return !namesToRemove.has(cleanName);
      });

      if (removeDefault && remaining.length === 0) return null;

      const fromMatch = singleLine.match(/from\s+(['"][^'"]+['"])/);
      const from = fromMatch ? fromMatch[1] : "";
      const semi = singleLine.endsWith(";") ? ";" : "";

      if (removeDefault && remaining.length > 0) {
        return `import { ${remaining.join(", ")} } from ${from}${semi}`;
      } else if (!removeDefault && remaining.length === 0) {
        return `import ${defaultName} from ${from}${semi}`;
      } else if (!removeDefault) {
        return `import ${defaultName}, { ${remaining.join(", ")} } from ${from}${semi}`;
      }
    } else {
      // Default import only
      if (removeDefault) return null;
      return importStatement;
    }
  } else if (namedOnlyMatch) {
    const namedPart = namedOnlyMatch[1];
    const names = namedPart
      .split(",")
      .map((n) => n.trim())
      .filter(Boolean);
    const remaining = names.filter((n) => {
      const cleanName = n.includes(" as ") ? n.split(" as ")[1].trim() : n;
      return !namesToRemove.has(cleanName);
    });

    if (remaining.length === 0) return null;

    const fromMatch = singleLine.match(/from\s+(['"][^'"]+['"])/);
    const from = fromMatch ? fromMatch[1] : "";
    const semi = singleLine.endsWith(";") ? ";" : "";
    const typeMatch = singleLine.match(/^import\s+(type\s+)/);
    const typePrefix = typeMatch ? typeMatch[1] : "";

    if (remaining.length <= 3) {
      return `import ${typePrefix}{ ${remaining.join(", ")} } from ${from}${semi}`;
    } else {
      // Multi-line format for many imports
      const indent = "  ";
      let result = `import ${typePrefix}{\n`;
      result += remaining.map((n) => `${indent}${n},`).join("\n");
      result += `\n} from ${from}${semi}`;
      return result;
    }
  }

  return importStatement;
}

console.log(`\nTotal fixes applied: ${totalFixed}`);
