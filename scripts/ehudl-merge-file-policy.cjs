#!/usr/bin/env node
/**
 * Merge the Ehud Levitan attachment policy into an EXISTING LibreChat YAML file.
 * Does not print secrets, touch credentials, change model definitions, or write
 * anything unless --apply is supplied. Intended to run AFTER Railway renders
 * LIBRECHAT_CONFIG into /app/librechat.yaml and BEFORE the server starts.
 *
 * Usage:
 *   node scripts/ehudl-merge-file-policy.cjs /app/librechat.yaml
 *   node scripts/ehudl-merge-file-policy.cjs /app/librechat.yaml --apply
 */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const yaml = require('js-yaml');

const filePath = process.argv[2];
const apply = process.argv.includes('--apply');
if (!filePath || process.argv.some((a, i) => i > 2 && a !== '--apply')) {
  process.stderr.write('Usage: node scripts/ehudl-merge-file-policy.cjs <config.yaml> [--apply]\n');
  process.exit(2);
}
let cfg;
try {
  cfg = yaml.load(fs.readFileSync(filePath, 'utf8'), { filename: filePath });
  if (!cfg || typeof cfg !== 'object' || Array.isArray(cfg)) {
    throw new Error('root must be a YAML mapping');
  }
} catch (error) {
  process.stderr.write('Config could not be parsed; no changes made: ' + error.message + '\n');
  process.exit(1);
}
const allowed = [
  'image/png',
  'image/jpeg',
  'image/webp',
  'application/pdf',
  'text/plain',
  'text/csv',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
];
cfg.fileConfig ??= {};
cfg.fileConfig.endpoints ??= {};
const d = cfg.fileConfig.endpoints.default ??= {};
// Preserve endpoint-specific settings, but enforce these limits on default.
// Other endpoints may override these values; check Agents separately.
d.fileLimit = 5;
d.fileSizeLimit = 25;
d.totalSizeLimit = 50;
const prev = Array.isArray(d.supportedMimeTypes) ? d.supportedMimeTypes : [];
// Do not broaden an existing restrictive allowlist with undocumented formats.
d.supportedMimeTypes = [...new Set([...prev, ...allowed])];
cfg.fileConfig.serverFileSizeLimit = Math.max(25, Number(cfg.fileConfig.serverFileSizeLimit) || 0);
cfg.fileConfig.clientImageResize = {
  ...cfg.fileConfig.clientImageResize,
  enabled: true,
  maxWidth: 1900,
  maxHeight: 1900,
};
if (!apply) {
  process.stdout.write('Valid config; dry run only. Proposed policy: 5 files, 25MB per file, 50MB total.\n');
  process.exit(0);
}
const output = yaml.dump(cfg, { lineWidth: -1, noRefs: true });
const tmp = path.join(path.dirname(filePath), '.' + path.basename(filePath) + '.policy-tmp');
try {
  fs.writeFileSync(tmp, output, { mode: 0o600, flag: 'wx' });
  fs.renameSync(tmp, filePath);
  process.stdout.write('Applied attachment policy to existing YAML.\n');
} catch (error) {
  try { fs.unlinkSync(tmp); } catch {}
  process.stderr.write('Config update failed; original file was not deliberately replaced: ' + error.message + '\n');
  process.exit(1);
}
