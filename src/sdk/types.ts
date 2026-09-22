import type { BrowserContext, Locator, Page } from 'playwright';
import type { CsvRow } from '../domain/output.js';

export type StepFn = (label: string, fn: () => Promise<void>) => Promise<void>;

export interface OutputApi {
  addRow(row: CsvRow): void;
  addRows(rows: readonly CsvRow[]): void;
  setJson(value: unknown): void;
  readonly rowCount: number;
  saveFile(name: string, data: string | Uint8Array): void;
}

export interface CollectUntilOptions<Row> {
  readonly count: number;
  readonly extract: () => Promise<Row[]>;
  readonly next: () => Promise<boolean>;
  readonly dedupeBy?: (row: Row) => unknown;
  readonly maxRounds?: number;
}

export interface Helpers {
  /** The only sanctioned fixed wait — a random delay within the site's pacing bounds. */
  pause(): Promise<void>;
  clickIfVisible(locator: Locator, options?: { readonly timeoutMs?: number }): Promise<boolean>;
  dismissIfVisible(locator: Locator, options?: { readonly timeoutMs?: number }): Promise<boolean>;
  collectUntil<Row>(options: CollectUntilOptions<Row>): Promise<Row[]>;
  scrollToLoadMore(page: Page, options?: { readonly timeoutMs?: number }): Promise<boolean>;
  textOf(locator: Locator): Promise<string | null>;
  attrOf(locator: Locator, name: string): Promise<string | null>;
  assert(condition: boolean, message: string): void;
}

export interface FlowContext<P> {
  readonly page: Page;
  readonly context: BrowserContext;
  readonly params: Readonly<P>;
  readonly step: StepFn;
  readonly output: OutputApi;
  readonly helpers: Helpers;
  readonly log: { info(message: string): void; warn(message: string): void };
  checkpoint(message: string): Promise<void>;
  readonly runDir: string;
}
