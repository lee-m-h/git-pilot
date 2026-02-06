export interface Repo {
  id: string;
  name: string;
  path: string;
  addedAt: string;
}

export interface RepoStatus {
  currentBranch: string;
  isClean: boolean;
  staged: FileChange[];
  unstaged: FileChange[];
  untracked: string[];
  ahead: number;
  behind: number;
}

export interface FileChange {
  path: string;
  status: 'M' | 'A' | 'D' | 'R' | '?';
  staged: boolean;
}

export interface Branch {
  name: string;
  current: boolean;
  remote?: string;
}

export interface CommitResult {
  success: boolean;
  message: string;
  hash?: string;
}
