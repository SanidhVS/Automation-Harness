import { afterEach, describe, expect, it } from 'vitest';
import { ReadlinePrompter } from '../../../src/infrastructure/prompts/readline-prompter.js';
import { NonInteractiveError } from '../../../src/domain/errors.js';

describe('ReadlinePrompter', () => {
  const originalIsTTY = process.stdin.isTTY;

  afterEach(() => {
    process.stdin.isTTY = originalIsTTY;
  });

  it('fails fast instead of hanging when stdin is not a TTY', async () => {
    process.stdin.isTTY = false;
    await expect(new ReadlinePrompter().waitForEnter('press enter')).rejects.toThrow(
      NonInteractiveError,
    );
  });
});
