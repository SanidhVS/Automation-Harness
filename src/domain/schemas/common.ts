import { z } from 'zod';

/** Lowercase, hyphen-separated identifier used for site and automation names. */
export const kebabCaseName = z
  .string()
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'must be kebab-case (lowercase letters, digits, hyphens)');

export const httpUrl = z.url();
