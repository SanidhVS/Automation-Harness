import { describe, expect, it } from 'vitest';
import { PRODUCT_NAME, PRODUCT_DISPLAY_NAME } from '../../src/shared/product.js';

describe('product identity', () => {
  it('defines the CLI name and display name', () => {
    expect(PRODUCT_NAME).toBe('rerun');
    expect(PRODUCT_DISPLAY_NAME).toBe('Rerun');
  });
});
