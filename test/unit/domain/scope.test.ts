import { describe, expect, it } from 'vitest';
import { parseScope, scopeToLocatorSelector } from '../../../src/domain/scope.js';

describe('parseScope', () => {
  it('parses role=<role> with no name', () => {
    expect(parseScope('role=button')).toEqual({ type: 'role', role: 'button', name: null });
  });

  it('parses role=<role>:<name>', () => {
    expect(parseScope('role=button:Account menu')).toEqual({
      type: 'role',
      role: 'button',
      name: 'Account menu',
    });
  });

  it('treats anything else as a CSS selector', () => {
    expect(parseScope('#results')).toEqual({ type: 'css', selector: '#results' });
    expect(parseScope('.result-card')).toEqual({ type: 'css', selector: '.result-card' });
  });
});

describe('scopeToLocatorSelector', () => {
  it('renders a role with no name', () => {
    expect(scopeToLocatorSelector({ type: 'role', role: 'button', name: null })).toBe(
      'role=button',
    );
  });

  it('renders a role with a name, quoted', () => {
    expect(scopeToLocatorSelector({ type: 'role', role: 'button', name: 'Account menu' })).toBe(
      'role=button[name="Account menu"]',
    );
  });

  it('renders a CSS selector unchanged', () => {
    expect(scopeToLocatorSelector({ type: 'css', selector: '#results' })).toBe('#results');
  });
});
