import { createInterface } from 'node:readline/promises';
import type { Prompter } from '../../application/ports/prompter.js';

/** Blocks on stdin via `readline`. Only usable when stdin is a TTY — callers are
 * responsible for checking that first (Section 9.3, 10.4). */
export class ReadlinePrompter implements Prompter {
  async waitForEnter(message: string): Promise<void> {
    console.log(message);
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    try {
      await rl.question('');
    } finally {
      rl.close();
    }
  }
}
