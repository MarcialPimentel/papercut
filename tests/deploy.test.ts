// Runs the real "Work out which build to deploy" script from .github/workflows/deploy.yml
// against a throwaway git repo, to check an older commit never goes live after a newer one.

import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';

/** The pick step's shell script, with the workflow's `${{ github.event_name }}` filled in. */
function pickScript(event: string) {
  const yml = readFileSync('.github/workflows/deploy.yml', 'utf8').replace(/\r/g, '');
  const step = yml.slice(yml.indexOf('id: pick'));
  const body = step.slice(step.indexOf('run: |') + 'run: |'.length + 1);
  const lines: string[] = [];
  for (const line of body.split('\n')) {
    if (line.trim() && !line.startsWith('          ')) break; // the next step
    lines.push(line.slice(10));
  }
  return lines.join('\n').replaceAll('${{ github.event_name }}', event);
}

// On Windows, use Git's bash (plain "bash" there can be WSL's).
const gitBash = join(process.env.ProgramFiles ?? 'C:\\Program Files', 'Git', 'bin', 'bash.exe');
const BASH = process.platform === 'win32' && existsSync(gitBash) ? gitBash : 'bash';

const root = mkdtempSync(join(tmpdir(), 'papercut-deploy-'));
afterAll(() => rmSync(root, { recursive: true, force: true }));
const env = { ...process.env, GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@t', GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@t' };
const git = (cwd: string, ...args: string[]) => execFileSync('git', args, { cwd, env, encoding: 'utf8' }).trim();

/** A "main" with two merges, and a checkout of it like the workflow's. */
function repo() {
  const origin = join(root, 'origin'), work = join(root, 'work');
  git(root, 'init', '-q', '-b', 'main', origin);
  git(origin, 'commit', '-q', '--allow-empty', '-m', 'first merge');
  const older = git(origin, 'rev-parse', 'HEAD');
  git(origin, 'commit', '-q', '--allow-empty', '-m', 'second merge');
  const newer = git(origin, 'rev-parse', 'HEAD');
  git(root, 'clone', '-q', origin, work);
  return { work, older, newer };
}
const { work, older, newer } = repo();

function pick(event: string, sha: string) {
  const out = join(root, `out-${event}-${sha.slice(0, 7)}`);
  writeFileSync(out, '');
  const script = join(root, 'pick.sh');
  writeFileSync(script, pickScript(event));
  const log = execFileSync(BASH, [script], { cwd: work, env: { ...env, DEFAULT_SHA: sha, REQUESTED: '', GITHUB_OUTPUT: out }, encoding: 'utf8' });
  return { log, out: readFileSync(out, 'utf8') };
}

describe('deploy: which build goes live', () => {
  it("skips an older commit whose CI finished after a newer merge's", () => {
    const r = pick('workflow_run', older);
    expect(r.out).toContain('skip=true');
    expect(r.out).not.toContain('sha=');
    expect(r.log).toContain('main has moved on');
  });

  it("deploys main's newest commit", () => {
    const r = pick('workflow_run', newer);
    expect(r.out).toContain(`sha=${newer}`);
    expect(r.out).not.toContain('skip=true');
  });
});
