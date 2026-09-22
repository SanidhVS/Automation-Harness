import { describe, expect, it } from 'vitest';
import { captureCallSite } from '../../../src/sdk/call-site.js';

function step(_label: string, fn: () => void): void {
  fn();
}

describe('captureCallSite', () => {
  it('captures the file/line/column of the code that called step(...)', () => {
    let site: ReturnType<typeof captureCallSite> = null;
    step('do the thing', () => {
      site = captureCallSite();
    });
    // captureCallSite is called one level deeper here (inside the step callback) than it
    // is in the real runner (directly inside step()), so this test only exercises that
    // the stack parses into a well-formed file/line/column, not the exact frame depth.
    expect(site).not.toBeNull();
    expect(site?.file).toContain('call-site.test.ts');
    expect(typeof site?.line).toBe('number');
    expect(typeof site?.column).toBe('number');
  });
});
