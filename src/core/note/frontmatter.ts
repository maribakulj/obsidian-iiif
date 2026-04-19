/**
 * Minimal YAML frontmatter serializer.
 *
 * Handles only what we emit: strings, numbers, booleans, ISO dates, and
 * arrays of those. No nested objects, no anchors, no flow style. Strings
 * are single-quoted when they contain characters that would otherwise
 * require YAML escaping; embedded single quotes are doubled per the
 * YAML 1.2 single-quoted scalar rules.
 */

export type FrontmatterValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | Array<string | number | boolean>;

export type Frontmatter = Record<string, FrontmatterValue>;

export function serializeFrontmatter(fm: Frontmatter): string {
  const lines: string[] = [];
  for (const [key, value] of Object.entries(fm)) {
    if (value === undefined || value === null) continue;
    if (Array.isArray(value)) {
      if (value.length === 0) continue;
      lines.push(`${key}:`);
      for (const item of value) {
        lines.push(`  - ${formatScalar(item)}`);
      }
    } else {
      lines.push(`${key}: ${formatScalar(value)}`);
    }
  }
  return lines.length > 0 ? lines.join("\n") + "\n" : "";
}

function formatScalar(v: string | number | boolean): string {
  if (typeof v === "boolean") return v ? "true" : "false";
  if (typeof v === "number") return Number.isFinite(v) ? String(v) : "null";
  return formatString(v);
}

function formatString(s: string): string {
  if (s.length === 0) return '""';
  if (needsQuoting(s)) {
    return `'${s.replace(/'/g, "''")}'`;
  }
  return s;
}

/**
 * Quote when the value would otherwise be parsed as something other than
 * a plain string, or when it contains YAML-significant chars.
 */
function needsQuoting(s: string): boolean {
  if (/^[\s]/.test(s) || /[\s]$/.test(s)) return true;
  if (/[:#&*!|>'"%@`,\[\]\{\}]/.test(s)) return true;
  if (/^(true|false|null|yes|no|on|off|~)$/i.test(s)) return true;
  if (/^-?\d+(\.\d+)?([eE][+-]?\d+)?$/.test(s)) return true;
  return false;
}
