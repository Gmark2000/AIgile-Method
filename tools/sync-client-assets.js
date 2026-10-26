import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { modernizeAgent, modernizePrompt } from './shared/client-assets.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const write = process.argv.includes('--write');
const stage = fs.mkdtempSync(path.join(os.tmpdir(), 'aigile generated staging '));
const destination = path.join(stage, 'consumer');
function execute(command, args, cwd = stage, env = process.env) {
  const result = spawnSync(command, args, { cwd, env, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
  if (result.status !== 0) throw new Error(`${command} ${args.join(' ')} exited ${result.status}: ${result.stdout}\n${result.stderr}`);
  return result.stdout;
}
const tracked = execute('git', ['ls-files', '-z'], root).split('\0').filter(Boolean);
const trackedSet = new Set(tracked);
function copy(relative) {
  const source = path.join(root, relative);
  if (fs.lstatSync(source).isSymbolicLink()) throw new Error(`Refusing source symlink: ${relative}`);
  fs.mkdirSync(path.dirname(path.join(stage, relative)), { recursive: true });
  fs.copyFileSync(source, path.join(stage, relative));
}
function collect(directory, relative) {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    if (entry.isSymbolicLink()) throw new Error(`Refusing source symlink: ${entry.name}`);
    const next = path.posix.join(relative, entry.name);
    return entry.isDirectory() ? collect(path.join(directory, entry.name), next) : [next];
  });
}
const changed = [];
const workflowInputs = [
  'core/agents/workflow-creator.agent.md',
  'core/skills/aigile-workflow-creator/SKILL.md',
  'core/skills-portable/aigile-workflow-creator/SKILL.md',
  'core/workflows/deterministic/bug-resolve.yaml',
  'core/workflows/deterministic/feature-delivery.yaml',
  'core/workflows/deterministic/security-remediation.yaml',
  'core/workflows/deterministic/pr-quality-gate.yaml',
  'docs/workflows.md',
  'tools/shared/doctor.js',
  'tools/shared/workflow.js',
  'tools/shared/workflow-schema.js',
  'tools/shared/workflow-file.js',
  'tools/shared/workflow-file.ps1',
  'tools/tests/workflow-acl-fixture.ps1',
  'tools/tests/workflow.test.js',
  'tools/tests/workflow-cli.test.js',
];
function update(relative, content) {
  const filename = path.join(root, relative);
  if (fs.existsSync(filename) && fs.readFileSync(filename).equals(Buffer.from(content))) return;
  changed.push(relative);
  if (write) {
    fs.mkdirSync(path.dirname(filename), { recursive: true });
    fs.writeFileSync(filename, content);
  }
}
try {
  const inputs = new Set([
    ...tracked.filter(relative => /^(core\/|tools\/|docs\/|mcp\/|package\.json$|README\.md$|CHANGELOG\.md$|LICENSE)/.test(relative) && !/mvel-workflow-engineer/.test(relative)),
    ...collect(path.join(root, 'core/skills-portable'), 'core/skills-portable'),
    ...collect(path.join(root, 'tools/shared'), 'tools/shared'),
    ...collect(path.join(root, 'tools/tests'), 'tools/tests'),
    'tools/sync-client-assets.js',
    ...workflowInputs,
  ]);
  for (const relative of inputs) copy(relative);
  fs.symlinkSync(path.join(root, 'node_modules'), path.join(stage, 'node_modules'), process.platform === 'win32' ? 'junction' : 'dir');
  for (const relative of [...inputs].filter(relative => /^core\/agents\/.*\.agent\.md$|^core\/prompts\/.*\.prompt\.md$/.test(relative))) {
    const content = fs.readFileSync(path.join(stage, relative), 'utf8');
    const modern = relative.endsWith('.agent.md') ? modernizeAgent(content) : modernizePrompt(content);
    fs.writeFileSync(path.join(stage, relative), modern);
    update(relative, modern);
  }
  fs.mkdirSync(destination);
  execute(process.execPath, [path.join(stage, 'tools/cli.js'), 'install', '--for-copilot', '--yes'], destination);
  execute(process.execPath, [path.join(stage, 'tools/cli.js'), 'bundle']);
  execute(process.execPath, [path.join(stage, 'tools/validate-bundles.js')]);
  const mirrors = new Set([
    ...tracked.filter(relative => /^(\.github\/(agents|prompts|skills)\/|\.aigile-core\/)/.test(relative)),
    '.github/agents/workflow-creator.agent.md',
    ...workflowInputs.filter(relative => relative.startsWith('core/')).map(relative => relative.replace(/^core\//, '.aigile-core/')),
  ]);
  for (const relative of mirrors) {
    const source = path.join(destination, relative);
    if (fs.existsSync(source)) update(relative, fs.readFileSync(source));
  }
  for (const relative of collect(path.join(stage, 'plugin'), 'plugin')) {
    if (trackedSet.has(relative) || relative.startsWith('plugin/core/workflows/deterministic/')) update(relative, fs.readFileSync(path.join(stage, relative)));
  }
  for (const relative of tracked.filter(relative => relative.startsWith('.claude-plugin/'))) {
    if (fs.existsSync(path.join(stage, relative))) update(relative, fs.readFileSync(path.join(stage, relative)));
  }
  const releaseFiles = [...new Set([
    ...['core', 'docs', 'mcp', 'tools', 'dist', 'plugin', '.claude-plugin'].flatMap(directory => collect(path.join(stage, directory), directory)),
    ...[...inputs].filter(relative => /^(README\.md|CHANGELOG\.md|LICENSE[^/]*|package\.json)$/.test(relative)),
  ])].filter(relative => !relative.startsWith('tools/installer/')).sort();
  for (const relative of releaseFiles.filter(relative => /^(dist|plugin|\.claude-plugin)\//.test(relative))) {
    update(relative, fs.readFileSync(path.join(stage, relative)));
  }
  const packagePath = path.join(stage, 'package.json');
  const metadata = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
  metadata.files = releaseFiles;
  const packageContent = JSON.stringify(metadata, null, 2) + '\n';
  fs.writeFileSync(packagePath, packageContent);
  update('package.json', packageContent);
  console.log(`${write ? 'Synchronized' : 'Compared'} canonical metadata and tracked mirrors; ${changed.length} ${write ? 'updated' : 'different'} files. Staged bundle validation passed.`);
  if (changed.length && !write) {
    console.error(changed.join('\n'));
    process.exitCode = 1;
  }
  if (process.argv.includes('--pack')) {
    if (changed.length && !write) throw new Error('Release inputs differ. Run npm run sync:clients, review the generated release allowlist and mirrors, then retry.');
    const npmCli = process.env.AIGILE_NPM_CLI || path.join(path.dirname(process.execPath), 'node_modules/npm/bin/npm-cli.js');
    if (!fs.existsSync(npmCli)) throw new Error('Set AIGILE_NPM_CLI to the npm CLI script for package validation.');
    const packArgs = ['pack', '--ignore-scripts', '--json', '--cache', path.join(stage, 'npm-cache')];
    const expected = JSON.parse(execute(process.execPath, [npmCli, ...packArgs, '--dry-run']))[0];
    const dryRun = JSON.parse(execute(process.execPath, [npmCli, ...packArgs, '--dry-run'], root))[0];
    const names = expected.files.map(file => file.path).sort();
    const actualNames = dryRun.files.map(file => file.path).sort();
    if (JSON.stringify(names) !== JSON.stringify(actualNames)) throw new Error('Actual npm pack file list differs from staged release gate');
    for (const relative of names) {
      if (!fs.readFileSync(path.join(root, relative)).equals(fs.readFileSync(path.join(stage, relative)))) throw new Error(`Actual release bytes differ from staging: ${relative}`);
    }
    const packed = JSON.parse(execute(process.execPath, [npmCli, ...packArgs, '--pack-destination', stage], root))[0];
    if (JSON.stringify(packed.files.map(file => file.path).sort()) !== JSON.stringify(names)) throw new Error('Actual tarball file list differs from release gate');
    for (const required of ['tools/shared/client-assets.js', 'tools/shared/managed-install.js', 'core/skills-portable/goal.md', 'tools/tests/codex-install.test.js', ...workflowInputs]) {
      if (!names.includes(required)) throw new Error(`Package missing ${required}`);
    }
    if (names.some(name => /mvel-workflow-engineer|package-lock\.json|^tools\/installer\//.test(name))) throw new Error('Package contains excluded local or retired assets');
    const extracted = path.join(stage, 'extracted package space');
    fs.mkdirSync(extracted);
    execute('tar', ['-xzf', packed.filename, '-C', path.relative(stage, extracted)]);
    const packageRoot = path.join(extracted, 'package');
    for (const relative of names) {
      if (!fs.readFileSync(path.join(packageRoot, relative)).equals(fs.readFileSync(path.join(stage, relative)))) throw new Error(`Extracted release bytes differ from staging: ${relative}`);
    }
    for (const dependency of ['yaml', '@iarna/toml']) {
      fs.cpSync(path.join(root, 'node_modules', dependency), path.join(packageRoot, 'node_modules', dependency), { recursive: true });
    }
    const tests = execute(process.execPath, ['--test', ...['codex-install.test.js', 'workflow.test.js', 'workflow-cli.test.js'].map(filename => path.join(packageRoot, 'tools/tests', filename))], packageRoot);
    console.log(`Release gate = actual npm pack --dry-run = actual tarball: ${names.length} identical files; source and extracted bytes match. MVEL: 0; lockfile: 0; retired installer: 0.`);
    console.log(`Extracted actual root package into a path with spaces and validated using installed dependency copies.`);
    console.log(tests.split('\n').filter(line => /^# (tests|pass|fail|skipped|duration)/.test(line)).join('\n'));
  }
} finally {
  fs.rmSync(stage, { recursive: true, force: true });
}