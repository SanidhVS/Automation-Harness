import { describe, expect, it } from 'vitest';
import { defineFlow, isDefinedFlow } from '../../../src/sdk/define-flow.js';

describe('defineFlow / isDefinedFlow', () => {
  it('brands the returned object so the runner can recognize it', () => {
    const flow = defineFlow(async () => {});
    expect(isDefinedFlow(flow)).toBe(true);
  });

  it('rejects plain objects, functions, and primitives', () => {
    expect(isDefinedFlow({})).toBe(false);
    expect(isDefinedFlow(() => {})).toBe(false);
    expect(isDefinedFlow(null)).toBe(false);
    expect(isDefinedFlow(undefined)).toBe(false);
    expect(isDefinedFlow('flow')).toBe(false);
    expect(isDefinedFlow({ run: async () => {} })).toBe(false);
  });
});
