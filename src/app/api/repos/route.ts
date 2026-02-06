import { NextResponse } from 'next/server';
import { getSortedRepos, addRepo, reorderRepos, toggleFavorite } from '@/lib/storage';
import { isGitRepo } from '@/lib/git';
import path from 'path';

export async function GET() {
  try {
    const repos = await getSortedRepos();
    return NextResponse.json(repos);
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const { action, id, orderedIds } = await request.json();
    
    if (action === 'toggle-favorite' && id) {
      const repo = await toggleFavorite(id);
      return NextResponse.json(repo);
    }
    
    if (action === 'reorder' && orderedIds) {
      await reorderRepos(orderedIds);
      return NextResponse.json({ success: true });
    }
    
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { path: repoPath } = await request.json();
    
    if (!repoPath) {
      return NextResponse.json({ error: 'Path is required' }, { status: 400 });
    }

    // Validate it's a git repo
    const isValid = await isGitRepo(repoPath);
    if (!isValid) {
      return NextResponse.json({ error: 'Not a valid git repository' }, { status: 400 });
    }

    const name = path.basename(repoPath);
    const repo = await addRepo({ name, path: repoPath });
    
    return NextResponse.json(repo);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
