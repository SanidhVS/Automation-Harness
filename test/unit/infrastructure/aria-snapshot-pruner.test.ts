import { describe, expect, it } from 'vitest';
import { pruneAriaSnapshot } from '../../../src/infrastructure/snapshot/aria-snapshot-pruner.js';

const listSnapshot = `- heading "Jobs" [level=1]
- list:
  - listitem:
    - link "Job One":
      - /url: /1
    - text: at Acme, this is a really long description that goes on and on for a while to test truncation behavior properly here
  - listitem:
    - link "Job Two":
      - /url: /2
    - text: at Acme
  - listitem:
    - link "Job Three":
      - /url: /3
    - text: at Acme
  - listitem:
    - link "Job Four":
      - /url: /4
    - text: at Acme
  - listitem:
    - link "Job Five":
      - /url: /5
    - text: at Acme
- button "Next"
- checkbox "Remote only"
- text: Remote only`;

describe('pruneAriaSnapshot', () => {
  it('is a no-op on already-short snapshots with nothing to prune', () => {
    const raw = '- paragraph: Welcome back\n- button "Account menu"';
    expect(pruneAriaSnapshot(raw)).toBe(raw);
  });

  it('truncates long quoted text with an ellipsis at maxTextLength', () => {
    const raw = `- link "${'x'.repeat(100)}"`;
    const pruned = pruneAriaSnapshot(raw, { maxTextLength: 10 });
    expect(pruned).toBe(`- link "${'x'.repeat(10)}…"`);
  });

  it('truncates long unquoted key:value text', () => {
    const raw = `- text: ${'y'.repeat(100)}`;
    const pruned = pruneAriaSnapshot(raw, { maxTextLength: 10 });
    expect(pruned).toBe(`- text: ${'y'.repeat(10)}…`);
  });

  it('collapses runs of similar siblings beyond collapseRepeatedAfter', () => {
    const pruned = pruneAriaSnapshot(listSnapshot, { collapseRepeatedAfter: 2 });
    const lines = pruned.split('\n');
    const listitemLines = lines.filter((l) => l.trim().startsWith('- listitem'));
    expect(listitemLines).toHaveLength(2);
    expect(pruned).toContain('- … (3 more similar listitem items)');
  });

  it('keeps only interactive-role nodes and their ancestor chain', () => {
    const pruned = pruneAriaSnapshot(listSnapshot, { interactiveOnly: true });
    expect(pruned).not.toContain('heading "Jobs"');
    expect(pruned).not.toContain('/url:');
    expect(pruned).toContain('link "Job One"');
    expect(pruned).toContain('button "Next"');
    expect(pruned).toContain('checkbox "Remote only"');
  });

  it('cuts at maxLines and appends a truncation marker', () => {
    const pruned = pruneAriaSnapshot(listSnapshot, { maxLines: 5 });
    const lines = pruned.split('\n');
    expect(lines).toHaveLength(6);
    expect(lines.at(-1)).toBe('- … (truncated, use --scope to narrow)');
  });

  it('is deterministic for the same input and options', () => {
    const a = pruneAriaSnapshot(listSnapshot, { collapseRepeatedAfter: 2, maxTextLength: 20 });
    const b = pruneAriaSnapshot(listSnapshot, { collapseRepeatedAfter: 2, maxTextLength: 20 });
    expect(a).toBe(b);
  });

  it('handles empty input', () => {
    expect(pruneAriaSnapshot('')).toBe('');
  });
});
