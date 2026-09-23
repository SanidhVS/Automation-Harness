export type ScopeSelector =
  | { readonly type: 'role'; readonly role: string; readonly name: string | null }
  | { readonly type: 'css'; readonly selector: string };

/** Parses `--scope`: `role=<role>[:<name>]` or a plain CSS selector (Section 13). */
export function parseScope(input: string): ScopeSelector {
  if (input.startsWith('role=')) {
    const rest = input.slice('role='.length);
    const separator = rest.indexOf(':');
    if (separator === -1) {
      return { type: 'role', role: rest, name: null };
    }
    return { type: 'role', role: rest.slice(0, separator), name: rest.slice(separator + 1) };
  }
  return { type: 'css', selector: input };
}

/** Renders a `ScopeSelector` as a Playwright locator selector string. */
export function scopeToLocatorSelector(scope: ScopeSelector): string {
  if (scope.type === 'css') return scope.selector;
  return scope.name === null
    ? `role=${scope.role}`
    : `role=${scope.role}[name=${JSON.stringify(scope.name)}]`;
}
