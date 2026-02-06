import { NextResponse } from 'next/server';
import { getRepoById, removeRepo } from '@/lib/storage';
import { getStatus, getBranches, getRecentCommits } from '@/lib/git';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const repo = await getRepoById(id);
    
    if (!repo) {
      return NextResponse.json({ error: 'Repository not found' }, { status: 404 });
    }

    const [status, branches, commits] = await Promise.all([
      getStatus(repo.path),
      getBranches(repo.path),
      getRecentCommits(repo.path, 5),
    ]);

    return NextResponse.json({
      ...repo,
      status,
      branches,
      commits,
    });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await removeRepo(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
