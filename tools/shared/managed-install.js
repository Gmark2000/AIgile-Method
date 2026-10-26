import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export const hash = content => crypto.createHash('sha256').update(content).digest('hex');
const manifestName = '.aigile-manifest.json';
const read = filename => fs.existsSync(filename) ? fs.readFileSync(filename) : null;
const equal = (left, right) => left === null || right === null ? left === right : left.equals(right);
const permissions = filename => fs.existsSync(filename) ? fs.statSync(filename).mode & 0o777 : null;

function stageFile(filename, content, mode) {
  fs.writeFileSync(filename, content, { flag: 'wx', mode: mode & 0o600 });
  if (process.platform !== 'win32') fs.chmodSync(filename, mode);
}

export function safePath(root, relative) {
  if (!relative || relative.includes('\\') || path.posix.isAbsolute(relative) || relative.split('/').some(part => !part || part === '..' || part === '.') || relative.includes(':')) {
    throw new Error(`Unsafe managed path: ${relative}`);
  }
  let current = path.resolve(root);
  for (const part of [null, ...relative.split('/')]) {
    if (part) current = path.join(current, part);
    let stat;
    try { stat = fs.lstatSync(current); } catch (error) { if (error.code !== 'ENOENT') throw error; }
    if (stat?.isSymbolicLink()) throw new Error(`Refusing symlink: ${current}`);
  }
  return current;
}

export function blockRange(text, markers) {
  const [start, end] = markers;
  const starts = text.split(start).length - 1;
  const ends = text.split(end).length - 1;
  if (!starts && !ends) return null;
  if (starts !== 1 || ends !== 1 || text.indexOf(end) < text.indexOf(start)) throw new Error('Duplicate or malformed AIgile block markers');
  return { start: text.indexOf(start), end: text.indexOf(end) + end.length };
}

export function filePlan(directory, owner) {
  const entries = [];
  function walk(folder) {
    for (const entry of fs.readdirSync(folder, { withFileTypes: true })) {
      const filename = path.join(folder, entry.name);
      if (entry.isSymbolicLink()) throw new Error(`Refusing source symlink: ${filename}`);
      if (entry.isDirectory()) walk(filename);
      else entries.push({ path: path.relative(directory, filename).replace(/\\/g, '/'), content: fs.readFileSync(filename), owners: [owner] });
    }
  }
  walk(directory);
  return entries;
}

const recordKey = record => record.jsonPath ? `${record.path}#json:${JSON.stringify(record.jsonPath)}` : record.markers ? `${record.path}#${record.markers[0]}` : record.path;

function jsonDocument(content) {
  const document = content ? JSON.parse(content.toString('utf8')) : {};
  if (!document || typeof document !== 'object' || Array.isArray(document)) throw new Error('Managed JSON must be an object');
  return document;
}

function jsonValue(document, [section, name]) {
  const container = document[section];
  if (container === undefined) return undefined;
  if (section === 'inputs') {
    if (!Array.isArray(container) || container.some(item => !item || typeof item.id !== 'string') || new Set(container.map(item => item.id)).size !== container.length) throw new Error('Managed JSON inputs must have unique string ids');
    return container.find(item => item.id === name);
  }
  if (!container || typeof container !== 'object' || Array.isArray(container)) throw new Error(`Managed JSON ${section} must be an object`);
  return Object.hasOwn(container, name) ? container[name] : undefined;
}

function mergeJson(content, jsonPath, value) {
  const document = jsonDocument(content);
  const [section, name] = jsonPath;
  jsonValue(document, jsonPath);
  if (section === 'inputs') {
    const items = document[section] || [];
    const index = items.findIndex(item => item.id === name);
    if (index >= 0) items.splice(index, 1, ...(value === undefined ? [] : [value]));
    else if (value !== undefined) items.push(value);
    if (items.length) document[section] = items;
    else delete document[section];
  } else {
    const container = document[section] || {};
    if (value === undefined) delete container[name];
    else Object.defineProperty(container, name, { value, enumerable: true, writable: true, configurable: true });
    if (Object.keys(container).length) document[section] = container;
    else delete document[section];
  }
  return Object.keys(document).length ? Buffer.from(JSON.stringify(document, null, 2) + '\n') : null;
}

function referencesInput(value, name) {
  if (typeof value === 'string') return [...value.matchAll(/\$\{input:([^{}]+)\}/g)].some(match => match[1] === name);
  if (value && typeof value === 'object') return Object.values(value).some(child => referencesInput(child, name));
  return false;
}

export function applyManagedPlan(root, entries, { targets, version, uninstall = false, legacyTargets = {} } = {}) {
  const manifestPath = safePath(root, manifestName);
  const manifestBefore = read(manifestPath);
  const manifestMode = permissions(manifestPath);
  const previous = manifestBefore ? JSON.parse(manifestBefore.toString('utf8')) : {};
  if (!previous || typeof previous !== 'object' || Array.isArray(previous)) throw new Error('Invalid ownership manifest');
  if (previous.schemaVersion && previous.schemaVersion !== 2) throw new Error('Unsupported ownership manifest version');
  if (previous.schemaVersion === 2 && (!previous.files || typeof previous.files !== 'object' || Array.isArray(previous.files) || !previous.targets || typeof previous.targets !== 'object' || Array.isArray(previous.targets))) throw new Error('Invalid ownership manifest');
  const files = structuredClone(previous.schemaVersion === 2 ? previous.files : {}) || {};
  for (const [key, record] of Object.entries(files)) {
    if (!record || typeof record !== 'object') throw new Error('Invalid ownership manifest');
    safePath(root, record.path);
    if (!Array.isArray(record.owners) || !record.owners.length || record.owners.some(owner => typeof owner !== 'string') || typeof record.hash !== 'string' || !/^[a-f0-9]{64}$/.test(record.hash)) throw new Error('Invalid ownership manifest');
    if (record.markers && (!Array.isArray(record.markers) || record.markers.length !== 2 || record.markers.some(marker => typeof marker !== 'string' || !marker))) throw new Error('Invalid managed block markers');
    if (record.jsonPath && (record.markers || !Array.isArray(record.jsonPath) || record.jsonPath.length !== 2 || !['servers', 'mcpServers', 'inputs'].includes(record.jsonPath[0]) || typeof record.jsonPath[1] !== 'string' || !record.jsonPath[1])) throw new Error('Invalid managed JSON path');
    if (record.path === manifestName || key !== recordKey(record)) throw new Error('Invalid ownership manifest path');
  }
  const selected = new Set(Object.keys(targets));
  const desired = new Map();
  for (const entry of entries) {
    safePath(root, entry.path);
    if (entry.path === manifestName) throw new Error('Manifest cannot be a generated asset');
    const key = recordKey(entry);
    const content = Buffer.from(entry.content);
    if (desired.has(key)) {
      const existing = desired.get(key);
      if (!existing.content.equals(content)) throw new Error(`Targets disagree on ${entry.path}`);
      existing.owners = [...new Set([...existing.owners, ...entry.owners])];
    } else desired.set(key, { ...entry, content });
  }
  const changes = new Map();
  const conflicts = [];
  const snapshots = new Map();
  const modes = new Map();
  function snapshot(relative) {
    if (!snapshots.has(relative)) {
      const filename = safePath(root, relative);
      snapshots.set(relative, read(filename));
      modes.set(relative, permissions(filename));
    }
    return snapshots.get(relative);
  }
  function contentFor(record, content) {
    if (record.jsonPath) {
      const value = jsonValue(jsonDocument(content), record.jsonPath);
      return value === undefined ? null : Buffer.from(JSON.stringify(value));
    }
    if (!record.markers) return content;
    const text = content?.toString('utf8') || '';
    const range = blockRange(text, record.markers);
    return range ? Buffer.from(text.slice(range.start, range.end)) : null;
  }
  if (!uninstall) {
    for (const [key, record] of Object.entries(files)) {
      if (record.jsonPath || record.markers || !record.owners.some(owner => selected.has(owner)) || !['.vscode/mcp.json', '.mcp.json'].includes(record.path)) continue;
      const before = snapshot(record.path);
      if (before && hash(before) !== record.hash) throw new Error(`Preserved modified owned MCP file: ${record.path}. Restore its generated contents before changing hosts.`);
      const document = jsonDocument(before);
      delete files[key];
      for (const section of ['servers', 'mcpServers', 'inputs']) {
        if (!Object.hasOwn(document, section)) continue;
        const names = section === 'inputs' ? document[section].map(item => item.id) : Object.keys(document[section]);
        for (const name of names) {
          const jsonPath = [section, name];
          const value = jsonValue(document, jsonPath);
          const migrated = { ...record, jsonPath, hash: hash(JSON.stringify(value)) };
          files[recordKey(migrated)] = migrated;
        }
      }
    }
  }
  for (const entry of desired.values()) {
    if (entry.jsonPath && desired.has(entry.path)) throw new Error(`Targets disagree on structured MCP ownership: ${entry.path}`);
  }
  for (const [key, entry] of desired) {
    const before = snapshot(entry.path);
    const owned = files[key];
    const current = contentFor(entry, before);
    if (current && !current.equals(entry.content) && (!owned || hash(current) !== owned.hash)) {
      conflicts.push(entry.path);
      continue;
    }
    if (current && !owned) continue;
    let after = entry.content;
    let insertedSeparator = owned?.insertedSeparator || '';
    if (entry.markers) {
      const text = before?.toString('utf8') || '';
      const range = blockRange(text, entry.markers);
      if (!range) insertedSeparator = text && !text.endsWith('\n') ? '\n\n' : '';
      after = Buffer.from(range ? text.slice(0, range.start) + entry.content + text.slice(range.end) : text + insertedSeparator + entry.content);
    }
    if (entry.jsonPath) {
      if (files[entry.path]) throw new Error(`Legacy whole-file ownership for ${entry.path}; uninstall its owning target before selecting structured MCP ownership.`);
      after = mergeJson(changes.has(entry.path) ? changes.get(entry.path) : before, entry.jsonPath, JSON.parse(entry.content.toString('utf8')));
    } else if (changes.has(entry.path)) throw new Error(`Overlapping managed outputs: ${entry.path}`);
    changes.set(entry.path, after);
    files[key] = {
      path: entry.path, source: entry.source || entry.path, hash: hash(entry.content),
      owners: [...new Set([...(owned?.owners || []), ...entry.owners])].sort(),
      ...(entry.markers ? { markers: entry.markers, insertedSeparator } : {}),
      ...(entry.jsonPath ? { jsonPath: entry.jsonPath } : {})
    };
  }
  const removals = Object.entries(files).sort((left, right) => Number(left[1].jsonPath?.[0] === 'inputs') - Number(right[1].jsonPath?.[0] === 'inputs'));
  for (const [key, record] of removals) {
    if (desired.has(key) || !record.owners.some(owner => selected.has(owner))) continue;
    const remaining = record.owners.filter(owner => !selected.has(owner));
    if (remaining.length) { record.owners = remaining; continue; }
    const before = snapshot(record.path);
    const current = contentFor(record, before);
    if (current && hash(current) !== record.hash) { conflicts.push(record.path); continue; }
    if (record.jsonPath?.[0] === 'inputs') {
      const document = jsonDocument(changes.has(record.path) ? changes.get(record.path) : before);
      if (referencesInput(document.servers, record.jsonPath[1]) || referencesInput(document.mcpServers, record.jsonPath[1])) continue;
    }
    let after = null;
    if (record.jsonPath) {
      after = mergeJson(changes.has(record.path) ? changes.get(record.path) : before, record.jsonPath, undefined);
    } else if (record.markers && current) {
      const text = before.toString('utf8');
      const range = blockRange(text, record.markers);
      let start = range.start;
      if (record.insertedSeparator && text.slice(0, start).endsWith(record.insertedSeparator)) start -= record.insertedSeparator.length;
      const result = text.slice(0, start) + text.slice(range.end);
      after = result ? Buffer.from(result) : null;
    } else if (record.markers) after = before;
    changes.set(record.path, after);
    delete files[key];
  }
  if (conflicts.length && !uninstall) throw new Error(`Preserved modified or unowned files: ${[...new Set(conflicts)].join(', ')}. Back up and move conflicting files (or restore the last generated content), then retry. --yes does not overwrite them.`);
  const nextTargets = { ...legacyTargets, ...(previous.targets || {}) };
  for (const [target, capabilities] of Object.entries(targets)) {
    if (uninstall && !Object.values(files).some(record => record.owners.includes(target))) delete nextTargets[target];
    else if (!uninstall) nextTargets[target] = capabilities;
  }
  const manifest = { schemaVersion: 2, name: '@mark-gozner/aigile-method', version, targets: nextTargets, files };
  const manifestAfter = Buffer.from(JSON.stringify(manifest, null, 2) + '\n');
  const staged = [];
  const committed = [];
  let retainBackups = false;
  let failure;
  try {
    snapshots.set(manifestName, manifestBefore);
    modes.set(manifestName, manifestMode);
    changes.set(manifestName, manifestAfter);
    for (const [relative, after] of changes) {
      const before = snapshot(relative);
      if (equal(before, after)) continue;
      const filename = safePath(root, relative);
      const mode = modes.get(relative) ?? 0o600;
      if (process.platform === 'win32' && before !== null && !(mode & 0o200)) throw new Error(`Refusing read-only destination: ${relative}`);
      fs.mkdirSync(path.dirname(filename), { recursive: true });
      const temporary = after === null ? null : `${filename}.${crypto.randomUUID()}.tmp`;
      const backup = before === null ? null : `${filename}.${crypto.randomUUID()}.bak`;
      staged.push({ relative, filename, temporary, backup, before, after, mode });
      if (backup) stageFile(backup, before, mode & 0o600);
      if (temporary) stageFile(temporary, after, mode);
    }
    for (const [relative, before] of snapshots) {
      const filename = safePath(root, relative);
      if (!equal(read(filename), before) || permissions(filename) !== modes.get(relative)) throw new Error(`Concurrent edit detected: ${relative}`);
    }
    if (!equal(read(manifestPath), manifestBefore)) throw new Error('Concurrent manifest edit detected');
    for (const item of staged) {
      safePath(root, item.relative);
      if (!equal(read(item.filename), item.before) || permissions(item.filename) !== modes.get(item.relative)) throw new Error(`Concurrent edit detected: ${item.relative}`);
      item.afterMode = item.temporary ? permissions(item.temporary) : null;
      if (item.temporary) fs.renameSync(item.temporary, item.filename);
      else fs.rmSync(item.filename, { force: true });
      committed.push(item);
    }
  } catch (error) {
    failure = error;
    const failures = [];
    for (const item of committed.reverse()) {
      try {
        safePath(root, item.relative);
        if (!equal(read(item.filename), item.after) || permissions(item.filename) !== item.afterMode) throw new Error(`Concurrent edit detected: ${item.relative}`);
        if (item.backup) {
          item.recovery = `${item.filename}.${crypto.randomUUID()}.restore.tmp`;
          stageFile(item.recovery, item.before, item.mode);
          fs.renameSync(item.recovery, item.filename);
        } else fs.rmSync(item.filename, { force: true });
      } catch (rollbackError) {
        failures.push(`${item.relative}: ${rollbackError.message}`);
      }
    }
    retainBackups = failures.length > 0;
    if (retainBackups) error.message += `. Rollback incomplete: ${failures.join('; ')}. Recovery backups: ${staged.filter(item => item.backup && fs.existsSync(item.backup)).map(item => item.backup).join(', ')}. Preserve these files and restore manually before retrying.`;
    throw error;
  } finally {
    const cleanupFailures = [];
    for (const item of staged) {
      for (const filename of [item.temporary, item.recovery, !retainBackups && item.backup].filter(Boolean)) {
        try { fs.rmSync(filename, { force: true }); } catch (error) { cleanupFailures.push(`${filename}: ${error.message}`); }
      }
    }
    if (cleanupFailures.length) {
      const message = `Temporary-file cleanup failed: ${cleanupFailures.join('; ')}`;
      if (failure) failure.message += `. ${message}`;
      else throw new Error(`Commit completed. ${message}`);
    }
  }
  return { manifest, conflicts: [...new Set(conflicts)], changed: staged.filter(item => item.relative !== manifestName).length };
}