import { exec } from 'child_process';
import { promisify } from 'util';
import type { RepoStatus, FileChange, Branch } from '@/types';

const execAsync = promisify(exec);

async function git(cwd: string, args: string): Promise<string> {
  try {
    const { stdout } = await execAsync(`git ${args}`, { cwd, maxBuffer: 10 * 1024 * 1024 });
    return stdout.trim();
  } catch (error: unknown) {
    const execError = error as { stdout?: string; stderr?: string; message?: string };
    if (execError.stdout) return execError.stdout.trim();
    throw new Error(execError.stderr || execError.message || 'Git command failed');
  }
}

export async function isGitRepo(path: string): Promise<boolean> {
  try {
    await git(path, 'rev-parse --git-dir');
    return true;
  } catch {
    return false;
  }
}

export async function getStatus(cwd: string): Promise<RepoStatus> {
  const [branch, statusOutput, aheadBehind] = await Promise.all([
    git(cwd, 'branch --show-current'),
    git(cwd, 'status --porcelain'),
    git(cwd, 'rev-list --left-right --count @{u}...HEAD').catch(() => '0\t0'),
  ]);

  const [behind, ahead] = aheadBehind.split('\t').map(Number);

  const staged: FileChange[] = [];
  const unstaged: FileChange[] = [];
  const untracked: string[] = [];

  const lines = statusOutput.split('\n').filter(Boolean);
  
  for (const line of lines) {
    const indexStatus = line[0];
    const workStatus = line[1];
    const filePath = line.slice(3);

    if (indexStatus === '?') {
      untracked.push(filePath);
    } else {
      if (indexStatus !== ' ' && indexStatus !== '?') {
        staged.push({
          path: filePath,
          status: indexStatus as FileChange['status'],
          staged: true,
        });
      }
      if (workStatus !== ' ' && workStatus !== '?') {
        unstaged.push({
          path: filePath,
          status: workStatus as FileChange['status'],
          staged: false,
        });
      }
    }
  }

  return {
    currentBranch: branch || 'HEAD',
    isClean: staged.length === 0 && unstaged.length === 0 && untracked.length === 0,
    staged,
    unstaged,
    untracked,
    ahead,
    behind,
  };
}

export async function getBranches(cwd: string): Promise<Branch[]> {
  const output = await git(cwd, 'branch -a --format="%(refname:short)|%(HEAD)|%(upstream:short)"');
  const branches: Branch[] = [];
  const seen = new Set<string>();

  for (const line of output.split('\n').filter(Boolean)) {
    const [name, head, remote] = line.split('|');
    
    // Skip remote tracking branches that have local equivalents
    if (name.startsWith('origin/')) {
      const localName = name.replace('origin/', '');
      if (!seen.has(localName)) {
        branches.push({
          name: localName,
          current: false,
          remote: name,
        });
        seen.add(localName);
      }
      continue;
    }

    if (!seen.has(name)) {
      branches.push({
        name,
        current: head === '*',
        remote: remote || undefined,
      });
      seen.add(name);
    }
  }

  return branches.sort((a, b) => {
    if (a.current) return -1;
    if (b.current) return 1;
    return a.name.localeCompare(b.name);
  });
}

export async function checkout(cwd: string, branch: string): Promise<void> {
  await git(cwd, `checkout ${branch}`);
}

export async function stageFiles(cwd: string, files: string[]): Promise<void> {
  if (files.length === 0) return;
  const escaped = files.map(f => `"${f}"`).join(' ');
  await git(cwd, `add ${escaped}`);
}

export async function unstageFiles(cwd: string, files: string[]): Promise<void> {
  if (files.length === 0) return;
  const escaped = files.map(f => `"${f}"`).join(' ');
  await git(cwd, `reset HEAD ${escaped}`);
}

export async function stageAll(cwd: string): Promise<void> {
  await git(cwd, 'add -A');
}

export async function commit(cwd: string, message: string): Promise<string> {
  const output = await git(cwd, `commit -m "${message.replace(/"/g, '\\"')}"`);
  const match = output.match(/\[[\w-]+ ([a-f0-9]+)\]/);
  return match?.[1] || '';
}

export async function push(cwd: string): Promise<void> {
  await git(cwd, 'push');
}

export async function pull(cwd: string): Promise<string> {
  return git(cwd, 'pull');
}

export async function fetch(cwd: string): Promise<void> {
  await git(cwd, 'fetch --all --prune');
}

export async function getRecentCommits(cwd: string, limit = 10): Promise<{ hash: string; message: string; date: string; author: string }[]> {
  const output = await git(cwd, `log -${limit} --pretty=format:"%h|%s|%ar|%an"`);
  return output.split('\n').filter(Boolean).map(line => {
    const [hash, message, date, author] = line.split('|');
    return { hash, message, date, author };
  });
}

export async function discardChanges(cwd: string, files: string[]): Promise<void> {
  if (files.length === 0) return;
  const escaped = files.map(f => `"${f}"`).join(' ');
  await git(cwd, `checkout -- ${escaped}`);
}

export async function createBranch(cwd: string, name: string): Promise<void> {
  await git(cwd, `checkout -b ${name}`);
}

export async function merge(cwd: string, branch: string): Promise<string> {
  return git(cwd, `merge ${branch}`);
}

export async function rebase(cwd: string, branch: string): Promise<string> {
  return git(cwd, `rebase ${branch}`);
}

export async function abortRebase(cwd: string): Promise<void> {
  await git(cwd, 'rebase --abort');
}

export async function abortMerge(cwd: string): Promise<void> {
  await git(cwd, 'merge --abort');
}

export async function getCommitDiff(cwd: string, hash: string): Promise<{
  files: { path: string; additions: number; deletions: number; status: string }[];
  diff: string;
}> {
  const [statOutput, diffOutput] = await Promise.all([
    git(cwd, `show ${hash} --stat --format=""`),
    git(cwd, `show ${hash} --format="" --no-color`),
  ]);

  const files: { path: string; additions: number; deletions: number; status: string }[] = [];
  
  // Parse stat output
  const statLines = statOutput.split('\n').filter(line => line.includes('|'));
  for (const line of statLines) {
    const match = line.match(/^\s*(.+?)\s*\|\s*(\d+)\s*([+-]*)/);
    if (match) {
      const [, path, changes, symbols] = match;
      const additions = (symbols.match(/\+/g) || []).length;
      const deletions = (symbols.match(/-/g) || []).length;
      files.push({
        path: path.trim(),
        additions,
        deletions,
        status: additions > 0 && deletions > 0 ? 'M' : additions > 0 ? 'A' : 'D',
      });
    }
  }

  return { files, diff: diffOutput };
}

export async function getFileDiff(cwd: string, path: string, staged: boolean): Promise<string> {
  const args = staged ? `diff --cached -- "${path}"` : `diff -- "${path}"`;
  return git(cwd, args);
}

export interface GraphCommit {
  hash: string;
  shortHash: string;
  message: string;
  author: string;
  date: string;
  parents: string[];
  branches: string[];
  tags: string[];
  isHead: boolean;
}

export async function getCommitGraph(cwd: string, limit = 50): Promise<GraphCommit[]> {
  // Get commit data with parent info, use topo-order for proper graph layout
  const format = '%H|%h|%s|%an|%ar|%P|%D';
  const output = await git(cwd, `log --all --topo-order -${limit} --pretty=format:"${format}"`);
  
  const commits: GraphCommit[] = [];
  
  for (const line of output.split('\n').filter(Boolean)) {
    const [hash, shortHash, message, author, date, parentsStr, refs] = line.split('|');
    
    const parents = parentsStr ? parentsStr.split(' ').filter(Boolean) : [];
    const branches: string[] = [];
    const tags: string[] = [];
    let isHead = false;
    
    if (refs) {
      const refParts = refs.split(', ');
      for (const ref of refParts) {
        if (ref.includes('HEAD')) {
          isHead = true;
        }
        if (ref.startsWith('tag: ')) {
          tags.push(ref.replace('tag: ', ''));
        } else if (!ref.includes('HEAD ->') && !ref.includes('HEAD')) {
          branches.push(ref.replace('origin/', '').replace('HEAD -> ', ''));
        } else if (ref.includes('HEAD ->')) {
          branches.push(ref.replace('HEAD -> ', ''));
        }
      }
    }
    
    commits.push({
      hash,
      shortHash,
      message,
      author,
      date,
      parents,
      branches: [...new Set(branches)],
      tags,
      isHead,
    });
  }
  
  return commits;
}
