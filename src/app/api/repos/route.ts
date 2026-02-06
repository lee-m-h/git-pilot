import { NextResponse } from 'next/server';
import { getRepos, addRepo } from '@/lib/storage';
import { isGitRepo } from '@/lib/git';
import path from 'path';

export async function GET() {
  try {
    const repos = await getRepos();
    return NextResponse.json(repos);
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
