import { safeParseMany } from '@/lib/safeParse';

export function normalizeEntityRows(rows, parser, label) {
  return safeParseMany(rows, parser, label);
}