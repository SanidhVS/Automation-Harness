import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ConsoleLogger } from '../../../src/infrastructure/logging/console-logger.js';
import { ValidationError } from '../../../src/domain/errors.js';

describe('ConsoleLogger', () => {
  let logSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    logSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it('writes info to stdout', () => {
    new ConsoleLogger({ verbose: false }).info('hello');
    expect(logSpy).toHaveBeenCalledWith('hello');
  });

  it('suppresses debug when not verbose', () => {
    new ConsoleLogger({ verbose: false }).debug('detail');
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it('prints debug when verbose', () => {
    new ConsoleLogger({ verbose: true }).debug('detail');
    expect(errorSpy).toHaveBeenCalledWith('detail');
  });

  it('prints message and hint on one line each for a RerunError, no stack by default', () => {
    const error = new ValidationError('bad input', { hint: 'try --help' });
    new ConsoleLogger({ verbose: false }).error(error);
    expect(errorSpy).toHaveBeenCalledWith('bad input');
    expect(errorSpy).toHaveBeenCalledWith('try --help');
    expect(errorSpy).toHaveBeenCalledTimes(2);
  });

  it('adds the stack trace when verbose', () => {
    const error = new ValidationError('bad input');
    new ConsoleLogger({ verbose: true }).error(error);
    expect(errorSpy).toHaveBeenCalledWith(error.stack);
  });
});
