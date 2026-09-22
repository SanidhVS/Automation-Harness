import type { ManifestParam } from '../schemas/manifest.js';

export type ParamValue = string | number | boolean;

export interface ParamIssue {
  readonly param: string;
  readonly message: string;
}

export interface ParamResolution {
  readonly values: Record<string, ParamValue>;
  readonly missing: readonly string[];
  readonly issues: readonly ParamIssue[];
}

const truthy = new Set(['true', 'yes', '1']);
const falsy = new Set(['false', 'no', '0']);

function coerce(param: ManifestParam, raw: ParamValue): ParamValue | ParamIssue {
  switch (param.type) {
    case 'string': {
      if (typeof raw !== 'string') {
        return { param: param.name, message: 'must be a string' };
      }
      return raw;
    }
    case 'number': {
      const num = typeof raw === 'number' ? raw : Number(raw);
      if (typeof raw === 'boolean' || Number.isNaN(num)) {
        return { param: param.name, message: 'must be a number' };
      }
      if (param.min !== undefined && num < param.min) {
        return { param: param.name, message: `must be >= ${String(param.min)}` };
      }
      if (param.max !== undefined && num > param.max) {
        return { param: param.name, message: `must be <= ${String(param.max)}` };
      }
      return num;
    }
    case 'boolean': {
      if (typeof raw === 'boolean') return raw;
      const normalized = String(raw).toLowerCase();
      if (truthy.has(normalized)) return true;
      if (falsy.has(normalized)) return false;
      return { param: param.name, message: 'must be true/false/yes/no/1/0' };
    }
    case 'enum': {
      if (typeof raw !== 'string' || !param.options.includes(raw)) {
        return {
          param: param.name,
          message: `must be one of: ${param.options.join(', ')}`,
        };
      }
      return raw;
    }
  }
}

function isParamIssue(value: ParamValue | ParamIssue): value is ParamIssue {
  return typeof value === 'object';
}

/** Resolves manifest param definitions against CLI/file overrides: applies defaults, coerces
 * and validates types, and reports missing required params. Pure — no prompting or I/O. */
export function resolveParams(
  paramDefs: readonly ManifestParam[],
  overrides: Readonly<Record<string, ParamValue>>,
): ParamResolution {
  const values: Record<string, ParamValue> = {};
  const missing: string[] = [];
  const issues: ParamIssue[] = [];

  for (const param of paramDefs) {
    const raw = overrides[param.name];
    if (raw !== undefined) {
      const result = coerce(param, raw);
      if (isParamIssue(result)) {
        issues.push(result);
      } else {
        values[param.name] = result;
      }
      continue;
    }
    if (param.default !== undefined) {
      values[param.name] = param.default;
      continue;
    }
    if (param.required) {
      missing.push(param.name);
    }
  }

  return { values, missing, issues };
}
