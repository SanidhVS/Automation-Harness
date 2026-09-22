import type { Locator, Page } from 'playwright';
import { FlowAssertionError } from '../domain/errors.js';
import type { CollectUntilOptions, Helpers } from './types.js';

const DEFAULT_CLICK_TIMEOUT_MS = 2000;
const DEFAULT_SCROLL_TIMEOUT_MS = 5000;
const DEFAULT_MAX_ROUNDS = 50;

async function sleep(ms: number): Promise<void> {
  await new Promise<void>((resolve) => setTimeout(resolve, ms));
}

async function clickIfVisible(
  locator: Locator,
  options?: { readonly timeoutMs?: number },
): Promise<boolean> {
  const timeoutMs = options?.timeoutMs ?? DEFAULT_CLICK_TIMEOUT_MS;
  try {
    await locator.waitFor({ state: 'visible', timeout: timeoutMs });
    await locator.click();
    return true;
  } catch {
    return false;
  }
}

async function textOf(locator: Locator): Promise<string | null> {
  try {
    return (await locator.innerText()).trim();
  } catch {
    return null;
  }
}

async function attrOf(locator: Locator, name: string): Promise<string | null> {
  try {
    return await locator.getAttribute(name);
  } catch {
    return null;
  }
}

async function scrollToLoadMore(
  page: Page,
  options?: { readonly timeoutMs?: number },
): Promise<boolean> {
  const timeoutMs = options?.timeoutMs ?? DEFAULT_SCROLL_TIMEOUT_MS;
  const before = await page.evaluate(() => document.body.scrollHeight);
  await page.evaluate(() => {
    window.scrollTo(0, document.body.scrollHeight);
  });
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const after = await page.evaluate(() => document.body.scrollHeight);
    if (after > before) return true;
    await sleep(100);
  }
  return false;
}

function assert(condition: boolean, message: string): void {
  if (!condition) throw new FlowAssertionError(message);
}

/** Builds the `helpers` object exposed on `FlowContext` — pacing-aware `pause()` plus the
 * generic pagination/extraction helpers (Section 10.3). */
export function createHelpers(pacing: {
  readonly minDelayMs: number;
  readonly maxDelayMs: number;
}): Helpers {
  const pause = async (): Promise<void> => {
    const span = pacing.maxDelayMs - pacing.minDelayMs;
    const ms = pacing.minDelayMs + (span > 0 ? Math.random() * span : 0);
    await sleep(ms);
  };

  async function collectUntil<Row>(options: CollectUntilOptions<Row>): Promise<Row[]> {
    const { count, extract, next, dedupeBy, maxRounds = DEFAULT_MAX_ROUNDS } = options;
    const seen = new Set<unknown>();
    const results: Row[] = [];
    let consecutiveNoNew = 0;

    for (let round = 0; round < maxRounds && results.length < count; round++) {
      const batch = await extract();
      let addedThisRound = 0;
      for (const row of batch) {
        if (results.length >= count) break;
        if (dedupeBy) {
          const key = dedupeBy(row);
          if (seen.has(key)) continue;
          seen.add(key);
        }
        results.push(row);
        addedThisRound++;
      }

      if (results.length >= count) break;

      if (addedThisRound === 0) {
        consecutiveNoNew++;
        if (consecutiveNoNew >= 2) break;
      } else {
        consecutiveNoNew = 0;
      }

      const hasMore = await next();
      if (!hasMore) break;
      await pause();
    }

    return results.slice(0, count);
  }

  return {
    pause,
    clickIfVisible,
    dismissIfVisible: clickIfVisible,
    collectUntil,
    scrollToLoadMore,
    textOf,
    attrOf,
    assert,
  };
}
