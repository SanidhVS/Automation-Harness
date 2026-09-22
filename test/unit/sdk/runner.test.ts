import { describe, expect, it, vi } from 'vitest';
import { defineFlow } from '../../../src/sdk/define-flow.js';
import { runFlow, type FlowRunDeps } from '../../../src/sdk/runner.js';
import { CheckpointUnavailableError, FlowAssertionError } from '../../../src/domain/errors.js';
import type { Page, BrowserContext } from 'playwright';

function baseDeps(overrides: Partial<FlowRunDeps<Record<string, never>>> = {}) {
  return {
    page: {} as Page,
    context: {} as BrowserContext,
    params: {},
    runDir: '/tmp/run',
    pacing: { minDelayMs: 0, maxDelayMs: 0 },
    log: { info: vi.fn(), warn: vi.fn(), debug: vi.fn() },
    ...overrides,
  };
}

describe('runFlow', () => {
  it('collects rows, json, and savedFiles on success', async () => {
    const flow = defineFlow(async (ctx) => {
      await ctx.step('collect', async () => {
        ctx.output.addRow({ a: 1 });
        ctx.output.addRows([{ a: 2 }, { a: 3 }]);
        ctx.output.setJson({ ok: true });
        ctx.output.saveFile('notes.txt', 'hello');
      });
    });
    const result = await runFlow(flow, baseDeps());
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('expected success');
    expect(result.rows).toEqual([{ a: 1 }, { a: 2 }, { a: 3 }]);
    expect(result.jsonValue).toEqual({ ok: true });
    expect(result.rowCount).toBe(3);
    expect(result.savedFiles.get('notes.txt')).toBe('hello');
  });

  it('reports the failing step label/index when a step throws', async () => {
    const flow = defineFlow(async (ctx) => {
      await ctx.step('first', async () => {
        ctx.output.addRow({ ok: true });
      });
      await ctx.step('second (fails)', async () => {
        throw new Error('boom');
      });
    });
    const result = await runFlow(flow, baseDeps());
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected failure');
    expect(result.stepLabel).toBe('second (fails)');
    expect(result.stepIndex).toBe(1);
    expect((result.error as Error).message).toBe('boom');
  });

  it('propagates FlowAssertionError from helpers.assert as the failure', async () => {
    const flow = defineFlow(async (ctx) => {
      await ctx.step('verify', async () => {
        ctx.helpers.assert(false, 'nothing collected');
      });
    });
    const result = await runFlow(flow, baseDeps());
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected failure');
    expect(result.error).toBeInstanceOf(FlowAssertionError);
  });

  it('rejects nested step() calls', async () => {
    const flow = defineFlow(async (ctx) => {
      await ctx.step('outer', async () => {
        await ctx.step('inner', async () => {});
      });
    });
    const result = await runFlow(flow, baseDeps());
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected failure');
    expect((result.error as Error).message).toContain('nested');
  });

  it('checkpoint() throws CheckpointUnavailableError when no waitForEnter is given', async () => {
    const flow = defineFlow(async (ctx) => {
      await ctx.checkpoint('pause here');
    });
    const result = await runFlow(flow, baseDeps());
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected failure');
    expect(result.error).toBeInstanceOf(CheckpointUnavailableError);
  });

  it('checkpoint() calls waitForEnter with a formatted message when available', async () => {
    const waitForEnter = vi.fn(async () => {});
    const flow = defineFlow(async (ctx) => {
      await ctx.checkpoint('confirm the CAPTCHA is solved');
    });
    const result = await runFlow(flow, baseDeps({ waitForEnter }));
    expect(result.ok).toBe(true);
    expect(waitForEnter).toHaveBeenCalledWith(
      '⏸ confirm the CAPTCHA is solved. Press Enter to continue.',
    );
  });

  it('logs a debug line "→ <label>" for each step', async () => {
    const debug = vi.fn();
    const flow = defineFlow(async (ctx) => {
      await ctx.step('do the thing', async () => {});
    });
    await runFlow(flow, baseDeps({ log: { info: vi.fn(), warn: vi.fn(), debug } }));
    expect(debug).toHaveBeenCalledWith('→ do the thing');
  });
});
