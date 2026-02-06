import { NextResponse } from 'next/server';
import { readdir, stat } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import os from 'os';
import { isGitRepo } from '@/lib/git';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    let dir = searchParams.get('path') || os.homedir();

    // Expand ~ to home directory
    if (dir.startsWith('~')) {
      dir = path.join(os.homedir(), dir.slice(1));
    }

    if (!existsSync(dir)) {
      return NextResponse.json({ error: 'Directory not found' }, { status: 404 });
    }

    const entries = await readdir(dir, { withFileTypes: true });
    const folders: { name: string; path: string; isGitRepo: boolean }[] = [];

    for (const entry of entries) {
      // Skip hidden folders except .git related stuff we might want
      if (entry.name.startsWith('.') && entry.name !== '..') continue;
      
      if (entry.isDirectory()) {
        const fullPath = path.join(dir, entry.name);
        try {
          // Check if we can access it
          await stat(fullPath);
          const isRepo = await isGitRepo(fullPath);
          folders.push({
            name: entry.name,
            path: fullPath,
            isGitRepo: isRepo,
          });
        } catch {
          // Skip inaccessible folders
        }
      }
    }

    // Sort: git repos first, then alphabetically
    folders.sort((a, b) => {
      if (a.isGitRepo && !b.isGitRepo) return -1;
      if (!a.isGitRepo && b.isGitRepo) return 1;
      return a.name.localeCompare(b.name);
    });

    return NextResponse.json({
      current: dir,
      parent: path.dirname(dir),
      folders,
    });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
