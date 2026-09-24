import { createInterface } from 'node:readline/promises';
import type { Prompter } from '../../application/ports/prompter.js';
import { NonInteractiveError } from '../../domain/errors.js';
import { PRODUCT_NAME } from '../../shared/product.js';

/** Blocks on stdin via `readline`. Fails fast with `NonInteractiveError` when stdin isn't a
 * TTY instead of hanging forever on a prompt nobody can answer (Section 9.3, 10.4 — Windows
 * parity H4: an agent's shell tool runs commands with non-TTY stdin, and `readline.question()`
 * never resolves there). */
export class ReadlinePrompter implements Prompter {
  async waitForEnter(message: string): Promise<void> {
    if (!process.stdin.isTTY) {
      throw new NonInteractiveError(
        'This step needs a person to press Enter in a real terminal, but stdin is not interactive here.',
        { hint: `Run this ${PRODUCT_NAME} command yourself in an interactive terminal.` },
      );
    }
    console.log(message);
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    try {
      await rl.question('');
    } finally {
      rl.close();
    }
  }
}
