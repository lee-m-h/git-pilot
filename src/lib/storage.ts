import { readFile, writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import type { Repo } from '@/types';

const DATA_DIR = path.join(process.cwd(), 'data');
const REPOS_FILE = path.join(DATA_DIR, 'repos.json');

async function ensureDataDir(): Promise<void> {
  if (!existsSync(DATA_DIR)) {
    await mkdir(DATA_DIR, { recursive: true });
  }
}

export async function getRepos(): Promise<Repo[]> {
  await ensureDataDir();
  try {
    const data = await readFile(REPOS_FILE, 'utf-8');
    return JSON.parse(data);
  } catch {
    return [];
  }
}

export async function saveRepos(repos: Repo[]): Promise<void> {
  await ensureDataDir();
  await writeFile(REPOS_FILE, JSON.stringify(repos, null, 2));
}

export async function addRepo(repo: Omit<Repo, 'id' | 'addedAt'>): Promise<Repo> {
  const repos = await getRepos();
  
  // Check if path already exists
  if (repos.some(r => r.path === repo.path)) {
    throw new Error('Repository already added');
  }

  const newRepo: Repo = {
    ...repo,
    id: crypto.randomUUID(),
    addedAt: new Date().toISOString(),
  };

  repos.push(newRepo);
  await saveRepos(repos);
  return newRepo;
}

export async function removeRepo(id: string): Promise<void> {
  const repos = await getRepos();
  const filtered = repos.filter(r => r.id !== id);
  await saveRepos(filtered);
}

export async function getRepoById(id: string): Promise<Repo | undefined> {
  const repos = await getRepos();
  return repos.find(r => r.id === id);
}

export async function toggleFavorite(id: string): Promise<Repo | undefined> {
  const repos = await getRepos();
  const repo = repos.find(r => r.id === id);
  if (repo) {
    repo.favorite = !repo.favorite;
    await saveRepos(repos);
  }
  return repo;
}

export async function reorderRepos(orderedIds: string[]): Promise<void> {
  const repos = await getRepos();
  orderedIds.forEach((id, index) => {
    const repo = repos.find(r => r.id === id);
    if (repo) {
      repo.order = index;
    }
  });
  await saveRepos(repos);
}

export async function getSortedRepos(): Promise<Repo[]> {
  const repos = await getRepos();
  return repos.sort((a, b) => {
    // Favorites first
    if (a.favorite && !b.favorite) return -1;
    if (!a.favorite && b.favorite) return 1;
    // Then by order
    const orderA = a.order ?? 999;
    const orderB = b.order ?? 999;
    return orderA - orderB;
  });
}
