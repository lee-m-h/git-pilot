import { NextResponse } from 'next/server';
import { getRepoById } from '@/lib/storage';
import {
  checkout,
  stageFiles,
  unstageFiles,
  stageAll,
  commit,
  push,
  pull,
  fetch,
  discardChanges,
  createBranch,
  merge,
  rebase,
  abortMerge,
  abortRebase,
  deleteBranch,
  deleteRemoteBranch,
  searchCommits,
  getFileDiff,
} from '@/lib/git';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const repo = await getRepoById(id);
    
    if (!repo) {
      return NextResponse.json({ error: 'Repository not found' }, { status: 404 });
    }

    const { action, ...data } = await request.json();

    switch (action) {
      case 'checkout': {
        await checkout(repo.path, data.branch);
        return NextResponse.json({ success: true, message: `Switched to ${data.branch}` });
      }

      case 'stage': {
        if (data.all) {
          await stageAll(repo.path);
        } else {
          await stageFiles(repo.path, data.files || []);
        }
        return NextResponse.json({ success: true, message: 'Files staged' });
      }

      case 'unstage': {
        await unstageFiles(repo.path, data.files || []);
        return NextResponse.json({ success: true, message: 'Files unstaged' });
      }

      case 'commit': {
        if (!data.message?.trim()) {
          return NextResponse.json({ error: 'Commit message is required' }, { status: 400 });
        }
        const hash = await commit(repo.path, data.message);
        return NextResponse.json({ success: true, message: `Committed: ${hash}`, hash });
      }

      case 'push': {
        await push(repo.path);
        return NextResponse.json({ success: true, message: 'Pushed to remote' });
      }

      case 'pull': {
        const result = await pull(repo.path);
        return NextResponse.json({ success: true, message: result || 'Already up to date' });
      }

      case 'fetch': {
        await fetch(repo.path);
        return NextResponse.json({ success: true, message: 'Fetched from remote' });
      }

      case 'discard': {
        await discardChanges(repo.path, data.files || []);
        return NextResponse.json({ success: true, message: 'Changes discarded' });
      }

      case 'create-branch': {
        if (!data.name?.trim()) {
          return NextResponse.json({ error: 'Branch name is required' }, { status: 400 });
        }
        await createBranch(repo.path, data.name);
        return NextResponse.json({ success: true, message: `Created and switched to ${data.name}` });
      }

      case 'merge': {
        if (!data.branch?.trim()) {
          return NextResponse.json({ error: 'Branch name is required' }, { status: 400 });
        }
        const result = await merge(repo.path, data.branch);
        return NextResponse.json({ success: true, message: result || `Merged ${data.branch}` });
      }

      case 'rebase': {
        if (!data.branch?.trim()) {
          return NextResponse.json({ error: 'Branch name is required' }, { status: 400 });
        }
        const result = await rebase(repo.path, data.branch);
        return NextResponse.json({ success: true, message: result || `Rebased onto ${data.branch}` });
      }

      case 'abort-merge': {
        await abortMerge(repo.path);
        return NextResponse.json({ success: true, message: 'Merge aborted' });
      }

      case 'abort-rebase': {
        await abortRebase(repo.path);
        return NextResponse.json({ success: true, message: 'Rebase aborted' });
      }

      case 'delete-branch': {
        if (!data.branch?.trim()) {
          return NextResponse.json({ error: 'Branch name is required' }, { status: 400 });
        }
        await deleteBranch(repo.path, data.branch, data.force);
        return NextResponse.json({ success: true, message: `Deleted branch ${data.branch}` });
      }

      case 'delete-remote-branch': {
        if (!data.branch?.trim()) {
          return NextResponse.json({ error: 'Branch name is required' }, { status: 400 });
        }
        await deleteRemoteBranch(repo.path, data.branch);
        return NextResponse.json({ success: true, message: `Deleted remote branch ${data.branch}` });
      }

      case 'search-commits': {
        if (!data.query?.trim()) {
          return NextResponse.json({ error: 'Search query is required' }, { status: 400 });
        }
        const results = await searchCommits(repo.path, data.query, data.limit || 20);
        return NextResponse.json({ success: true, results });
      }

      case 'get-file-diff': {
        if (!data.path?.trim()) {
          return NextResponse.json({ error: 'File path is required' }, { status: 400 });
        }
        const diff = await getFileDiff(repo.path, data.path, data.staged ?? false);
        return NextResponse.json({ success: true, diff });
      }

      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
