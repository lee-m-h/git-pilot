import { NextResponse } from 'next/server';
import { getRepoById } from '@/lib/storage';
import { getCommitGraph } from '@/lib/git';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50');
    
    const repo = await getRepoById(id);
    
    if (!repo) {
      return NextResponse.json({ error: 'Repository not found' }, { status: 404 });
    }

    const commits = await getCommitGraph(repo.path, limit);
    return NextResponse.json(commits);
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
