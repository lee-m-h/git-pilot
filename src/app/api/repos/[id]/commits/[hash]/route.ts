import { NextResponse } from 'next/server';
import { getRepoById } from '@/lib/storage';
import { getCommitDiff } from '@/lib/git';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string; hash: string }> }
) {
  try {
    const { id, hash } = await params;
    const repo = await getRepoById(id);
    
    if (!repo) {
      return NextResponse.json({ error: 'Repository not found' }, { status: 404 });
    }

    const diff = await getCommitDiff(repo.path, hash);
    return NextResponse.json(diff);
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
