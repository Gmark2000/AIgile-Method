#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '..');
const dist = path.join(root, 'dist');

function fail(msg){
  console.error('❌', msg);
  process.exitCode = 1;
}

function ok(msg){
  console.log('✅', msg);
}

function mustExist(p){
  if(!fs.existsSync(p)) fail(`Missing: ${path.relative(root, p)}`);
  else ok(`Exists: ${path.relative(root, p)}`);
}

function checkMarkers(file){
  const txt = fs.readFileSync(file, 'utf8');
  if(!txt.includes('Web Agent Bundle Instructions')) fail(`${path.basename(file)} missing header`);
  const startCount = (txt.match(/==================== START:/g) || []).length;
  const endCount = (txt.match(/==================== END:/g) || []).length;
  if(startCount === 0 || endCount === 0) fail(`${path.basename(file)} missing START/END markers`);
  if(startCount !== endCount) fail(`${path.basename(file)} START/END count mismatch (${startCount} vs ${endCount})`);
  else ok(`${path.basename(file)} markers balanced (${startCount})`);
  if(!txt.includes('.aigile-core/')) fail(`${path.basename(file)} missing .aigile-core paths`);
}

function main(){
  mustExist(dist);
  const team = path.join(dist, 'teams', 'team-company.txt');
  const agentsDir = path.join(dist, 'agents');
  mustExist(team);
  mustExist(agentsDir);
  const dev = path.join(agentsDir, 'dev.txt');
  if(fs.existsSync(dev)) ok('dev agent bundle present');
  else console.warn('ℹ️ dev agent bundle not found (ok if no dev.md)');
  checkMarkers(team);
  if(fs.existsSync(dev)) checkMarkers(dev);

  // Sanity: ensure team includes at least one agent file content by looking for core/agents/
  const teamTxt = fs.readFileSync(team, 'utf8');
  if(!teamTxt.includes('/agents/')) fail('team-company.txt does not seem to include any agent content');
  else ok('team-company.txt includes agent content');
}

main();
