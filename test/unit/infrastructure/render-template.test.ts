import { describe, expect, it } from 'vitest';
import { renderTemplateString } from '../../../src/infrastructure/templates/render-template.js';

describe('renderTemplateString', () => {
  it('replaces every {{KEY}} placeholder', () => {
    expect(
      renderTemplateString('Hello {{NAME}}, welcome to {{PLACE}}.', {
        NAME: 'Ada',
        PLACE: 'Rerun',
      }),
    ).toBe('Hello Ada, welcome to Rerun.');
  });

  it('replaces repeated occurrences of the same placeholder', () => {
    expect(renderTemplateString('{{X}}-{{X}}', { X: 'a' })).toBe('a-a');
  });

  it('throws if a placeholder has no matching variable', () => {
    expect(() => renderTemplateString('{{MISSING}}', {})).toThrow(/MISSING/);
  });

  it('ignores variables the template does not reference', () => {
    expect(renderTemplateString('no placeholders here', { UNUSED: 'x' })).toBe(
      'no placeholders here',
    );
  });
});
