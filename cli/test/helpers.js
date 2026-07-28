import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export function mkTmpRepo() {
  const dir = mkdtempSync(join(tmpdir(), 'house-'));
  mkdirSync(join(dir, '.house'), { recursive: true });
  mkdirSync(join(dir, 'docs', 'slices'), { recursive: true });
  mkdirSync(join(dir, 'docs', 'adr'), { recursive: true });
  writeFileSync(join(dir, '.house', 'events.jsonl'), '');
  writeFileSync(join(dir, '.house', 'config.yaml'), 'schema_version: 1\n');
  return dir;
}
