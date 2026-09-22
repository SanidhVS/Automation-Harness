import { describe, expect, it } from 'vitest';
import {
  ConfigError,
  ProfileLockedError,
  SessionRequiredError,
  ValidationError,
} from '../../../src/domain/errors.js';
import { EXIT_CODES } from '../../../src/domain/exit-codes.js';

describe('error hierarchy', () => {
  it('maps each error type to its documented exit code', () => {
    expect(new ValidationError('bad args').code).toBe(EXIT_CODES.usageError);
    expect(new SessionRequiredError('login needed').code).toBe(EXIT_CODES.loginRequired);
    expect(new ProfileLockedError('locked').code).toBe(EXIT_CODES.profileLocked);
    expect(new ConfigError('invalid', ['version: required']).code).toBe(EXIT_CODES.invalidConfig);
  });

  it('carries a hint and cause through to the instance', () => {
    const cause = new Error('root cause');
    const error = new ValidationError('bad args', { hint: 'try again', cause });
    expect(error.hint).toBe('try again');
    expect(error.cause).toBe(cause);
    expect(error.name).toBe('ValidationError');
  });

  it('collects issues on ConfigError', () => {
    const error = new ConfigError('invalid site.json', ['name: required', 'baseUrl: invalid']);
    expect(error.issues).toHaveLength(2);
  });
});
