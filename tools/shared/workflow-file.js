import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import childProcess from 'node:child_process';
import { fileURLToPath } from 'node:url';

const helper = fileURLToPath(new URL('./workflow-file.ps1', import.meta.url));
function windows(request) {
  const executable = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32/WindowsPowerShell/v1.0/powershell.exe');
  const result = childProcess.spawnSync(executable, ['-NoLogo', '-NoProfile', '-NonInteractive', '-File', helper], { input: JSON.stringify(request), encoding: 'utf8', windowsHide: true, maxBuffer: 4 * 1024 * 1024 });
  if (result.status !== 0 || result.error) throw new Error(`Workflow security helper failed; original is not overwritten in place. Check local NTFS, owner rights and PowerShell policy: ${result.error?.message || result.stderr}`);
  return JSON.parse(result.stdout);
}
export function workflowLock(filename) {
  const lock = `${filename}.lock`;
  if (process.platform === 'win32') return windows({ operation: 'lock', filename });
  const descriptor = fs.openSync(lock, 'wx', 0o600);
  try {
    try { fs.fsyncSync(descriptor); } finally { fs.closeSync(descriptor); }
    return fs.statSync(filename);
  }
  catch (error) { fs.unlinkSync(lock); throw error; }
}
export function writeWorkflowFile(filename, value, replace, expected) {
  if (process.platform === 'win32') return windows({ operation: 'write', filename, bytes: Buffer.from(value).toString('base64'), replace, expected });
  const temporary = `${filename}.${crypto.randomUUID()}.tmp`;
  let descriptor;
  try {
    descriptor = fs.openSync(temporary, 'wx', 0o600);
    if (replace) {
      const staged = fs.fstatSync(descriptor);
      if (staged.uid !== expected.uid || staged.gid !== expected.gid) fs.fchownSync(descriptor, expected.uid, expected.gid);
      fs.fchmodSync(descriptor, expected.mode & 0o7777);
      const secured = fs.fstatSync(descriptor);
      if (secured.uid !== expected.uid || secured.gid !== expected.gid || secured.mode !== expected.mode) throw new Error('Cannot preserve workflow owner/group/mode');
    }
    fs.writeFileSync(descriptor, value);
    fs.fsyncSync(descriptor);
    fs.closeSync(descriptor);
    descriptor = undefined;
    if (replace) {
      const current = fs.lstatSync(filename);
      if (current.isSymbolicLink() || ['dev', 'ino', 'uid', 'gid', 'mode', 'size', 'mtimeMs', 'ctimeMs'].some(key => current[key] !== expected[key]) || current.nlink !== 1) throw new Error('Workflow identity or metadata changed before commit');
      fs.renameSync(temporary, filename);
    } else fs.linkSync(temporary, filename);
    const directory = fs.openSync(path.dirname(filename), 'r');
    try { fs.fsyncSync(directory); } finally { fs.closeSync(directory); }
  } finally {
    if (descriptor !== undefined) fs.closeSync(descriptor);
    if (fs.existsSync(temporary)) fs.unlinkSync(temporary);
  }
}