import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { globSync } from 'fs';

/**
 * Tests that all form field elements (input, select, textarea) in Svelte
 * components have an id or name attribute, fixing the browser warning:
 * "A form field element should have an id or name attribute"
 */

// Recursively find all .svelte files under src/
function findSvelteFiles(dir: string): string[] {
  const { readdirSync, statSync } = require('fs');
  const { join } = require('path');
  const results: string[] = [];

  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory() && !entry.startsWith('.') && entry !== 'node_modules') {
      results.push(...findSvelteFiles(fullPath));
    } else if (entry.endsWith('.svelte')) {
      results.push(fullPath);
    }
  }
  return results;
}

/**
 * Check that a form element tag has either id="..." or name="..." attribute.
 * Returns the list of violations (file + line number + tag excerpt).
 */
function findFormElementsWithoutId(filePath: string): string[] {
  const content = readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const violations: string[] = [];

  // Match opening tags for input, select, textarea that span multiple lines
  // We join lines to handle multi-line attributes
  const fullContent = content;

  // Regex to find <input ... >, <select ... >, <textarea ... > tags
  // including multi-line tags (using [\s\S] to match across lines)
  const tagRegex = /<(input|select|textarea)\b([\s\S]*?)(?:\/?>)/g;
  let match;

  while ((match = tagRegex.exec(fullContent)) !== null) {
    const tagName = match[1];
    const attributes = match[2];

    // Check if the tag has id="..." or name="..."
    const hasId = /\bid\s*=/.test(attributes);
    const hasName = /\bname\s*=/.test(attributes);

    if (!hasId && !hasName) {
      // Find line number for the match
      const beforeMatch = fullContent.substring(0, match.index);
      const lineNum = beforeMatch.split('\n').length;
      const relPath = filePath.replace(resolve(__dirname, '../../..') + '/', '');
      violations.push(`${relPath}:${lineNum} - <${tagName}> missing id or name`);
    }
  }

  return violations;
}

describe('Form field accessibility', () => {
  const srcDir = resolve(__dirname, '../..');
  const svelteFiles = findSvelteFiles(srcDir);

  it('should find Svelte component files to test', () => {
    expect(svelteFiles.length).toBeGreaterThan(0);
  });

  it('all form elements should have an id or name attribute', () => {
    const allViolations: string[] = [];

    for (const file of svelteFiles) {
      const violations = findFormElementsWithoutId(file);
      allViolations.push(...violations);
    }

    if (allViolations.length > 0) {
      const message = `Found ${allViolations.length} form element(s) without id or name:\n${allViolations.join('\n')}`;
      expect(allViolations, message).toHaveLength(0);
    }
  });
});
