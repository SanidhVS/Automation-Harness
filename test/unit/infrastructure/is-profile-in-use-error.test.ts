import { describe, expect, it } from 'vitest';
import { isProfileInUseError } from '../../../src/infrastructure/browser/playwright-launcher.js';

describe('isProfileInUseError', () => {
  it('recognizes Playwright "already in use" launch failures', () => {
    expect(isProfileInUseError(new Error('Browser is already in use for /path'))).toBe(true);
  });

  it('recognizes SingletonLock mentions', () => {
    expect(isProfileInUseError(new Error('Failed to create SingletonLock'))).toBe(true);
  });

  it('is false for unrelated errors', () => {
    expect(isProfileInUseError(new Error('net::ERR_CONNECTION_REFUSED'))).toBe(false);
  });

  it('is false for non-Error values', () => {
    expect(isProfileInUseError('already in use')).toBe(false);
  });
});
