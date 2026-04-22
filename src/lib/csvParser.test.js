import { describe, it, expect } from 'vitest';
import { parseCSV, extractPlaceholders, interpolate } from './csvParser';

describe('parseCSV', () => {
  it('returns empty headers/rows when input has fewer than 2 lines', () => {
    expect(parseCSV('')).toEqual({ headers: [], rows: [] });
    expect(parseCSV('name,email')).toEqual({ headers: [], rows: [] });
  });

  it('parses a simple comma-separated file', () => {
    const csv = 'name,email\nAlice,a@x.com\nBob,b@x.com';
    const { headers, rows } = parseCSV(csv);
    expect(headers).toEqual(['name', 'email']);
    expect(rows).toEqual([
      { name: 'Alice', email: 'a@x.com' },
      { name: 'Bob', email: 'b@x.com' },
    ]);
  });

  it('normalizes CRLF and lone CR line endings', () => {
    const { rows: crlf } = parseCSV('a,b\r\n1,2\r\n3,4');
    const { rows: cr } = parseCSV('a,b\r1,2\r3,4');
    const { rows: lf } = parseCSV('a,b\n1,2\n3,4');
    expect(crlf).toEqual(lf);
    expect(cr).toEqual(lf);
  });

  it('handles quoted fields that contain commas', () => {
    const { rows } = parseCSV('name,note\nAlice,"hello, world"\nBob,plain');
    expect(rows).toEqual([
      { name: 'Alice', note: 'hello, world' },
      { name: 'Bob', note: 'plain' },
    ]);
  });

  it('handles escaped double quotes inside quoted fields', () => {
    const { rows } = parseCSV('name,note\nAlice,"she said ""hi"""');
    expect(rows[0].note).toBe('she said "hi"');
  });

  it('trims whitespace around headers and values', () => {
    const { headers, rows } = parseCSV('  name , email \n  Alice , a@x.com ');
    expect(headers).toEqual(['name', 'email']);
    expect(rows).toEqual([{ name: 'Alice', email: 'a@x.com' }]);
  });

  it('skips blank lines', () => {
    const { rows } = parseCSV('a,b\n1,2\n\n3,4\n');
    expect(rows).toEqual([
      { a: '1', b: '2' },
      { a: '3', b: '4' },
    ]);
  });

  it('fills missing trailing columns with empty strings', () => {
    const { rows } = parseCSV('a,b,c\n1,2');
    expect(rows).toEqual([{ a: '1', b: '2', c: '' }]);
  });
});

describe('extractPlaceholders', () => {
  it('returns an empty array when no placeholders are present', () => {
    expect(extractPlaceholders('plain script')).toEqual([]);
    expect(extractPlaceholders('')).toEqual([]);
  });

  it('extracts unique {{word}} placeholders preserving first-seen order', () => {
    expect(extractPlaceholders('login with {{email}} and {{password}}'))
      .toEqual(['email', 'password']);
    expect(extractPlaceholders('{{a}} {{b}} {{a}}')).toEqual(['a', 'b']);
  });

  it('only matches \\w+ tokens', () => {
    // Spaces / hyphens / special chars don't match `\w+` so they are ignored.
    expect(extractPlaceholders('{{ spaced }} {{dash-name}} {{ok_name}}'))
      .toEqual(['ok_name']);
  });
});

describe('interpolate', () => {
  it('replaces placeholders with row values', () => {
    expect(interpolate('hi {{name}}', { name: 'Alice' })).toBe('hi Alice');
  });

  it('leaves unknown placeholders as-is for visibility', () => {
    expect(interpolate('hi {{name}} {{missing}}', { name: 'Alice' }))
      .toBe('hi Alice {{missing}}');
  });

  it('leaves strings without placeholders unchanged', () => {
    expect(interpolate('no placeholders here', { name: 'Alice' }))
      .toBe('no placeholders here');
  });
});
