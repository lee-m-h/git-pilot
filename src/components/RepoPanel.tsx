'use client';

import { useState, useEffect, useCallback } from 'react';
import type { RepoStatus, Branch, FileChange } from '@/types';
import CommitGraph from './CommitGraph';

interface RepoDetails {
  id: string;
  name: string;
  path: string;
  status: RepoStatus;
  branches: Branch[];
  commits: { hash: string; message: string; date: string; author: string }[];
}

interface RepoPanelProps {
  repoId: string | null;
  onRefresh?: () => void;
}

export default function RepoPanel({ repoId, onRefresh }: RepoPanelProps) {
  const [repo, setRepo] = useState<RepoDetails | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [commitMessage, setCommitMessage] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [showBranchDropdown, setShowBranchDropdown] = useState(false);
  const [newBranchName, setNewBranchName] = useState('');
  const [showNewBranchInput, setShowNewBranchInput] = useState(false);
  const [showMergeDropdown, setShowMergeDropdown] = useState(false);
  const [mergeMode, setMergeMode] = useState<'merge' | 'rebase'>('merge');
  const [selectedCommit, setSelectedCommit] = useState<{ hash: string; message: string } | null>(null);
  const [commitDiff, setCommitDiff] = useState<{ files: { path: string; additions: number; deletions: number; status: string }[]; diff: string } | null>(null);
  const [diffLoading, setDiffLoading] = useState(false);
  const [showGraph, setShowGraph] = useState(true);
  const [graphRefreshTrigger, setGraphRefreshTrigger] = useState(0);
  const [selectedFile, setSelectedFile] = useState<{ path: string; staged: boolean } | null>(null);
  const [fileDiff, setFileDiff] = useState<string | null>(null);
  const [fileDiffLoading, setFileDiffLoading] = useState(false);

  const fetchRepo = useCallback(async () => {
    if (!repoId) return;
    
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/repos/${repoId}`);
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || 'Failed to fetch repository');
      }
      
      setRepo(data);
      setSelectedFiles(new Set());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to fetch');
    } finally {
      setLoading(false);
    }
  }, [repoId]);

  useEffect(() => {
    fetchRepo();
  }, [fetchRepo]);

  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 3000);
  };

  const doAction = async (action: string, data: Record<string, unknown> = {}) => {
    if (!repoId) return;
    
    setActionLoading(action);
    try {
      const res = await fetch(`/api/repos/${repoId}/actions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...data }),
      });
      
      const result = await res.json();
      
      if (!res.ok) {
        throw new Error(result.error || 'Action failed');
      }
      
      showToast('success', result.message);
      await fetchRepo();
      setGraphRefreshTrigger(prev => prev + 1);
      onRefresh?.();
      
      if (action === 'commit') {
        setCommitMessage('');
      }
    } catch (e) {
      showToast('error', e instanceof Error ? e.message : 'Action failed');
    } finally {
      setActionLoading(null);
    }
  };

  const toggleFileSelection = (path: string) => {
    const newSelected = new Set(selectedFiles);
    if (newSelected.has(path)) {
      newSelected.delete(path);
    } else {
      newSelected.add(path);
    }
    setSelectedFiles(newSelected);
  };

  const selectAllFiles = () => {
    if (!repo) return;
    const allFiles = [
      ...repo.status.unstaged.map(f => f.path),
      ...repo.status.untracked,
    ];
    setSelectedFiles(new Set(allFiles));
  };

  const deselectAllFiles = () => {
    setSelectedFiles(new Set());
  };

  const viewFileDiff = async (path: string, staged: boolean) => {
    if (!repoId) return;
    
    setSelectedFile({ path, staged });
    setFileDiffLoading(true);
    setFileDiff(null);
    
    try {
      const res = await fetch(`/api/repos/${repoId}/actions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'get-file-diff', path, staged }),
      });
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || 'Failed to fetch diff');
      }
      
      setFileDiff(data.diff || '(No changes)');
    } catch (e) {
      showToast('error', e instanceof Error ? e.message : 'Failed to fetch diff');
      setSelectedFile(null);
    } finally {
      setFileDiffLoading(false);
    }
  };

  const viewCommitDiff = async (hash: string, message: string) => {
    if (!repoId) return;
    
    setSelectedCommit({ hash, message });
    setDiffLoading(true);
    setCommitDiff(null);
    
    try {
      const res = await fetch(`/api/repos/${repoId}/commits/${hash}`);
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || 'Failed to fetch diff');
      }
      
      setCommitDiff(data);
    } catch (e) {
      showToast('error', e instanceof Error ? e.message : 'Failed to fetch diff');
      setSelectedCommit(null);
    } finally {
      setDiffLoading(false);
    }
  };

  if (!repoId) {
    return (
      <div className="flex-1 flex items-center justify-center text-[var(--muted)]">
        <div className="text-center">
          <svg className="w-16 h-16 mx-auto mb-4 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
          </svg>
          <p>Select a repository from the sidebar</p>
        </div>
      </div>
    );
  }

  if (loading && !repo) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-[var(--primary)] border-t-transparent"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center text-[var(--danger)]">
        <div className="text-center">
          <p className="mb-4">{error}</p>
          <button
            onClick={fetchRepo}
            className="px-4 py-2 bg-[var(--primary)] rounded-lg hover:bg-[var(--primary-hover)] transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!repo) return null;

  const hasChanges = !repo.status.isClean;
  const hasStagedChanges = repo.status.staged.length > 0;
  const hasUnstagedChanges = repo.status.unstaged.length > 0 || repo.status.untracked.length > 0;

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Toast */}
      {toast && (
        <div className={`
          fixed top-4 right-4 px-4 py-3 rounded-lg shadow-lg z-50 flex items-center gap-2
          ${toast.type === 'success' ? 'bg-[var(--success)]' : 'bg-[var(--danger)]'}
        `}>
          {toast.type === 'success' ? (
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          ) : (
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          )}
          <span className="text-sm font-medium">{toast.message}</span>
        </div>
      )}

      {/* Header */}
      <div className="p-4 border-b border-[var(--border)] bg-[var(--card)]">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-xl font-bold">{repo.name}</h2>
            <p className="text-sm text-[var(--muted)]">{repo.path}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => doAction('fetch')}
              disabled={actionLoading !== null}
              className="px-3 py-1.5 text-sm rounded-lg border border-[var(--border)] hover:bg-[var(--card-hover)] disabled:opacity-50 transition-colors"
              title="Fetch"
            >
              {actionLoading === 'fetch' ? '...' : '↓ Fetch'}
            </button>
            <button
              onClick={() => doAction('pull')}
              disabled={actionLoading !== null}
              className="px-3 py-1.5 text-sm rounded-lg border border-[var(--border)] hover:bg-[var(--card-hover)] disabled:opacity-50 transition-colors"
              title="Pull"
            >
              {actionLoading === 'pull' ? '...' : '↓ Pull'}
            </button>
            <button
              onClick={fetchRepo}
              disabled={loading}
              className="p-1.5 rounded-lg border border-[var(--border)] hover:bg-[var(--card-hover)] disabled:opacity-50 transition-colors"
              title="Refresh"
            >
              <svg className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          </div>
        </div>

        {/* Branch Selector */}
        <div className="flex items-center gap-3">
          <div className="relative">
            <button
              onClick={() => setShowBranchDropdown(!showBranchDropdown)}
              className="flex items-center gap-2 px-3 py-1.5 bg-[var(--background)] border border-[var(--border)] rounded-lg hover:border-[var(--primary)] transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              <span className="font-medium">{repo.status.currentBranch}</span>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {showBranchDropdown && (
              <div className="absolute top-full left-0 mt-1 w-64 bg-[var(--card)] border border-[var(--border)] rounded-lg shadow-xl z-10 max-h-64 overflow-y-auto">
                {/* New Branch Input */}
                {showNewBranchInput ? (
                  <div className="p-2 border-b border-[var(--border)]">
                    <input
                      type="text"
                      value={newBranchName}
                      onChange={(e) => setNewBranchName(e.target.value)}
                      placeholder="Branch name..."
                      className="w-full px-2 py-1 text-sm bg-[var(--background)] border border-[var(--border)] rounded focus:outline-none focus:border-[var(--primary)]"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && newBranchName.trim()) {
                          doAction('create-branch', { name: newBranchName.trim() });
                          setNewBranchName('');
                          setShowNewBranchInput(false);
                          setShowBranchDropdown(false);
                        } else if (e.key === 'Escape') {
                          setShowNewBranchInput(false);
                          setNewBranchName('');
                        }
                      }}
                    />
                  </div>
                ) : (
                  <button
                    onClick={() => setShowNewBranchInput(true)}
                    className="w-full px-3 py-2 text-sm text-left hover:bg-[var(--card-hover)] flex items-center gap-2 text-[var(--primary)] border-b border-[var(--border)]"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    New Branch
                  </button>
                )}

                {repo.branches.map((branch) => (
                  <div
                    key={branch.name}
                    className={`
                      group w-full px-3 py-2 text-sm text-left hover:bg-[var(--card-hover)] flex items-center justify-between
                      ${branch.current ? 'bg-[var(--primary)]/10 text-[var(--primary)]' : ''}
                    `}
                  >
                    <button
                      className="flex-1 text-left truncate"
                      onClick={() => {
                        if (!branch.current) {
                          doAction('checkout', { branch: branch.name });
                        }
                        setShowBranchDropdown(false);
                      }}
                    >
                      {branch.name}
                    </button>
                    <div className="flex items-center gap-1">
                      {branch.current && (
                        <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                      {!branch.current && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (confirm(`Delete branch "${branch.name}"?`)) {
                              doAction('delete-branch', { branch: branch.name });
                              setShowBranchDropdown(false);
                            }
                          }}
                          className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-[var(--danger)] hover:text-white transition-all"
                          title="Delete branch"
                        >
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Merge/Rebase Dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowMergeDropdown(!showMergeDropdown)}
              className="flex items-center gap-2 px-3 py-1.5 bg-[var(--background)] border border-[var(--border)] rounded-lg hover:border-[var(--primary)] transition-colors text-sm"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
              </svg>
              <span>{mergeMode === 'merge' ? 'Merge' : 'Rebase'}</span>
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {showMergeDropdown && (
              <div className="absolute top-full left-0 mt-1 w-56 bg-[var(--card)] border border-[var(--border)] rounded-lg shadow-xl z-10 max-h-80 overflow-y-auto">
                {/* Mode Toggle */}
                <div className="p-2 border-b border-[var(--border)] flex gap-1">
                  <button
                    onClick={() => setMergeMode('merge')}
                    className={`flex-1 px-2 py-1 text-xs rounded ${mergeMode === 'merge' ? 'bg-[var(--primary)] text-white' : 'hover:bg-[var(--card-hover)]'}`}
                  >
                    Merge
                  </button>
                  <button
                    onClick={() => setMergeMode('rebase')}
                    className={`flex-1 px-2 py-1 text-xs rounded ${mergeMode === 'rebase' ? 'bg-[var(--primary)] text-white' : 'hover:bg-[var(--card-hover)]'}`}
                  >
                    Rebase
                  </button>
                </div>

                <div className="p-2 text-xs text-[var(--muted)] border-b border-[var(--border)]">
                  {mergeMode === 'merge' 
                    ? `Merge into ${repo.status.currentBranch}:`
                    : `Rebase ${repo.status.currentBranch} onto:`
                  }
                </div>

                {repo.branches
                  .filter(b => !b.current)
                  .map((branch) => (
                    <button
                      key={branch.name}
                      onClick={() => {
                        doAction(mergeMode, { branch: branch.name });
                        setShowMergeDropdown(false);
                      }}
                      className="w-full px-3 py-2 text-sm text-left hover:bg-[var(--card-hover)] flex items-center gap-2"
                    >
                      <svg className="w-4 h-4 text-[var(--muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                      <span className="truncate">{branch.name}</span>
                    </button>
                  ))}
              </div>
            )}
          </div>

          {/* Ahead/Behind indicators */}
          {(repo.status.ahead > 0 || repo.status.behind > 0) && (
            <div className="flex items-center gap-2 text-sm">
              {repo.status.ahead > 0 && (
                <span className="text-[var(--success)]">↑{repo.status.ahead}</span>
              )}
              {repo.status.behind > 0 && (
                <span className="text-[var(--warning)]">↓{repo.status.behind}</span>
              )}
            </div>
          )}

          {/* Status badge */}
          <span className={`
            px-2 py-0.5 rounded-full text-xs font-medium
            ${repo.status.isClean 
              ? 'bg-[var(--success)]/20 text-[var(--success)]' 
              : 'bg-[var(--warning)]/20 text-[var(--warning)]'
            }
          `}>
            {repo.status.isClean ? 'Clean' : 'Modified'}
          </span>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {/* Changes Section */}
        {hasChanges && (
          <div className="space-y-4">
            {/* Staged Changes */}
            {hasStagedChanges && (
              <div className="bg-[var(--card)] rounded-lg border border-[var(--border)]">
                <div className="px-4 py-3 border-b border-[var(--border)] flex items-center justify-between">
                  <h3 className="font-medium text-[var(--success)]">
                    Staged Changes ({repo.status.staged.length})
                  </h3>
                  <button
                    onClick={() => doAction('unstage', { files: repo.status.staged.map(f => f.path) })}
                    className="text-xs text-[var(--muted)] hover:text-white transition-colors"
                  >
                    Unstage All
                  </button>
                </div>
                <ul className="divide-y divide-[var(--border)]">
                  {repo.status.staged.map((file) => (
                    <FileRow 
                      key={file.path} 
                      file={file} 
                      onAction={() => doAction('unstage', { files: [file.path] })}
                      actionLabel="Unstage"
                      onViewDiff={() => viewFileDiff(file.path, true)}
                    />
                  ))}
                </ul>
              </div>
            )}

            {/* Unstaged Changes */}
            {hasUnstagedChanges && (
              <div className="bg-[var(--card)] rounded-lg border border-[var(--border)]">
                <div className="px-4 py-3 border-b border-[var(--border)] flex items-center justify-between">
                  <h3 className="font-medium text-[var(--warning)]">
                    Unstaged Changes ({repo.status.unstaged.length + repo.status.untracked.length})
                  </h3>
                  <div className="flex items-center gap-2">
                    {selectedFiles.size > 0 ? (
                      <>
                        <button
                          onClick={deselectAllFiles}
                          className="text-xs text-[var(--muted)] hover:text-white transition-colors"
                        >
                          Deselect
                        </button>
                        <button
                          onClick={() => doAction('stage', { files: Array.from(selectedFiles) })}
                          className="text-xs text-[var(--success)] hover:text-white transition-colors"
                        >
                          Stage Selected ({selectedFiles.size})
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={selectAllFiles}
                          className="text-xs text-[var(--muted)] hover:text-white transition-colors"
                        >
                          Select All
                        </button>
                        <button
                          onClick={() => doAction('stage', { all: true })}
                          className="text-xs text-[var(--success)] hover:text-white transition-colors"
                        >
                          Stage All
                        </button>
                      </>
                    )}
                  </div>
                </div>
                <ul className="divide-y divide-[var(--border)]">
                  {repo.status.unstaged.map((file) => (
                    <FileRow 
                      key={file.path} 
                      file={file}
                      selected={selectedFiles.has(file.path)}
                      onToggle={() => toggleFileSelection(file.path)}
                      onAction={() => doAction('stage', { files: [file.path] })}
                      actionLabel="Stage"
                      onDiscard={() => doAction('discard', { files: [file.path] })}
                      onViewDiff={() => viewFileDiff(file.path, false)}
                    />
                  ))}
                  {repo.status.untracked.map((path) => (
                    <FileRow 
                      key={path} 
                      file={{ path, status: '?', staged: false }}
                      selected={selectedFiles.has(path)}
                      onToggle={() => toggleFileSelection(path)}
                      onAction={() => doAction('stage', { files: [path] })}
                      actionLabel="Stage"
                    />
                  ))}
                </ul>
              </div>
            )}

            {/* Commit Section */}
            {hasStagedChanges && (
              <div className="bg-[var(--card)] rounded-lg border border-[var(--border)] p-4">
                <h3 className="font-medium mb-3">Commit</h3>
                <textarea
                  value={commitMessage}
                  onChange={(e) => setCommitMessage(e.target.value)}
                  placeholder="Commit message..."
                  className="w-full px-3 py-2 bg-[var(--background)] border border-[var(--border)] rounded-lg text-sm resize-none focus:outline-none focus:border-[var(--primary)]"
                  rows={3}
                />
                <div className="flex items-center justify-end gap-2 mt-3">
                  <button
                    onClick={() => doAction('commit', { message: commitMessage })}
                    disabled={!commitMessage.trim() || actionLoading !== null}
                    className="px-4 py-2 bg-[var(--success)] hover:bg-[var(--success)]/80 rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {actionLoading === 'commit' ? 'Committing...' : 'Commit'}
                  </button>
                  <button
                    onClick={async () => {
                      await doAction('commit', { message: commitMessage });
                      if (commitMessage.trim()) {
                        await doAction('push');
                      }
                    }}
                    disabled={!commitMessage.trim() || actionLoading !== null}
                    className="px-4 py-2 bg-[var(--primary)] hover:bg-[var(--primary-hover)] rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {actionLoading === 'push' ? 'Pushing...' : 'Commit & Push'}
                  </button>
                </div>
              </div>
            )}

            {/* Push button when there are commits to push */}
            {!hasStagedChanges && repo.status.ahead > 0 && (
              <button
                onClick={() => doAction('push')}
                disabled={actionLoading !== null}
                className="w-full px-4 py-3 bg-[var(--primary)] hover:bg-[var(--primary-hover)] rounded-lg font-medium disabled:opacity-50 transition-colors"
              >
                {actionLoading === 'push' ? 'Pushing...' : `Push ${repo.status.ahead} commit${repo.status.ahead > 1 ? 's' : ''}`}
              </button>
            )}
          </div>
        )}

        {/* Clean State */}
        {!hasChanges && (
          <div className="text-center py-12">
            <svg className="w-16 h-16 mx-auto mb-4 text-[var(--success)] opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-[var(--muted)]">Working tree clean</p>
            {repo.status.ahead > 0 && (
              <button
                onClick={() => doAction('push')}
                disabled={actionLoading !== null}
                className="mt-4 px-6 py-2 bg-[var(--primary)] hover:bg-[var(--primary-hover)] rounded-lg font-medium disabled:opacity-50 transition-colors"
              >
                Push {repo.status.ahead} commit{repo.status.ahead > 1 ? 's' : ''}
              </button>
            )}
          </div>
        )}

        {/* Commits Section */}
        <div className="mt-6">
          {/* Tab Header */}
          <div className="flex items-center gap-2 mb-3">
            <button
              onClick={() => setShowGraph(true)}
              className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                showGraph 
                  ? 'bg-[var(--primary)] text-white' 
                  : 'bg-[var(--card)] border border-[var(--border)] hover:bg-[var(--card-hover)]'
              }`}
            >
              📊 Graph
            </button>
            <button
              onClick={() => setShowGraph(false)}
              className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                !showGraph 
                  ? 'bg-[var(--primary)] text-white' 
                  : 'bg-[var(--card)] border border-[var(--border)] hover:bg-[var(--card-hover)]'
              }`}
            >
              📝 List
            </button>
          </div>

          {showGraph ? (
            <CommitGraph 
              repoId={repoId!} 
              onSelectCommit={viewCommitDiff}
              refreshTrigger={graphRefreshTrigger}
            />
          ) : (
            repo.commits.length > 0 && (
              <div className="bg-[var(--card)] rounded-lg border border-[var(--border)]">
                <div className="px-4 py-3 border-b border-[var(--border)]">
                  <h3 className="font-medium">Recent Commits</h3>
                </div>
                <ul className="divide-y divide-[var(--border)]">
                  {repo.commits.map((commit) => (
                    <li 
                      key={commit.hash} 
                      className="px-4 py-2 flex items-start gap-3 hover:bg-[var(--card-hover)] cursor-pointer transition-colors"
                      onClick={() => viewCommitDiff(commit.hash, commit.message)}
                    >
                      <code className="text-xs text-[var(--primary)] bg-[var(--primary)]/10 px-1.5 py-0.5 rounded font-mono">
                        {commit.hash}
                      </code>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm truncate">{commit.message}</p>
                        <p className="text-xs text-[var(--muted)]">{commit.author} • {commit.date}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )
          )}
        </div>
      </div>

      {/* Click outside to close dropdown */}
      {(showBranchDropdown || showMergeDropdown) && (
        <div 
          className="fixed inset-0 z-0" 
          onClick={() => {
            setShowBranchDropdown(false);
            setShowMergeDropdown(false);
          }}
        />
      )}

      {/* File Diff Modal */}
      {selectedFile && (
        <div 
          className="fixed inset-0 bg-black/60 flex items-center justify-center z-50"
          onClick={() => setSelectedFile(null)}
        >
          <div 
            className="bg-[var(--card)] rounded-xl w-[900px] max-w-[90vw] max-h-[85vh] flex flex-col shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="p-4 border-b border-[var(--border)] flex items-start justify-between">
              <div className="flex-1 min-w-0 mr-4">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                    selectedFile.staged 
                      ? 'bg-[var(--success)]/20 text-[var(--success)]' 
                      : 'bg-[var(--warning)]/20 text-[var(--warning)]'
                  }`}>
                    {selectedFile.staged ? 'Staged' : 'Unstaged'}
                  </span>
                </div>
                <p className="text-sm font-mono truncate">{selectedFile.path}</p>
              </div>
              <button
                onClick={() => setSelectedFile(null)}
                className="p-1 rounded hover:bg-[var(--card-hover)] transition-colors flex-shrink-0"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-auto">
              {fileDiffLoading ? (
                <div className="flex-1 flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-2 border-[var(--primary)] border-t-transparent"></div>
                </div>
              ) : fileDiff ? (
                <pre className="p-4 text-xs font-mono whitespace-pre overflow-x-auto">
                  {fileDiff.split('\n').map((line, i) => {
                    let className = '';
                    if (line.startsWith('+') && !line.startsWith('+++')) {
                      className = 'bg-[var(--success)]/20 text-[var(--success)]';
                    } else if (line.startsWith('-') && !line.startsWith('---')) {
                      className = 'bg-[var(--danger)]/20 text-[var(--danger)]';
                    } else if (line.startsWith('@@')) {
                      className = 'text-[var(--primary)] bg-[var(--primary)]/10';
                    } else if (line.startsWith('diff --git')) {
                      className = 'text-[var(--muted)] font-bold';
                    }
                    return (
                      <div key={i} className={`${className} px-2 -mx-2`}>
                        {line || ' '}
                      </div>
                    );
                  })}
                </pre>
              ) : (
                <div className="flex-1 flex items-center justify-center py-12 text-[var(--muted)]">
                  No changes
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Commit Diff Modal */}
      {selectedCommit && (
        <div 
          className="fixed inset-0 bg-black/60 flex items-center justify-center z-50"
          onClick={() => setSelectedCommit(null)}
        >
          <div 
            className="bg-[var(--card)] rounded-xl w-[900px] max-w-[90vw] max-h-[85vh] flex flex-col shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="p-4 border-b border-[var(--border)] flex items-start justify-between">
              <div className="flex-1 min-w-0 mr-4">
                <div className="flex items-center gap-2 mb-1">
                  <code className="text-sm text-[var(--primary)] bg-[var(--primary)]/10 px-2 py-0.5 rounded font-mono">
                    {selectedCommit.hash}
                  </code>
                </div>
                <p className="text-sm truncate">{selectedCommit.message}</p>
              </div>
              <button
                onClick={() => setSelectedCommit(null)}
                className="p-1 rounded hover:bg-[var(--card-hover)] transition-colors flex-shrink-0"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-hidden flex flex-col">
              {diffLoading ? (
                <div className="flex-1 flex items-center justify-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-2 border-[var(--primary)] border-t-transparent"></div>
                </div>
              ) : commitDiff ? (
                <>
                  {/* Changed Files Summary */}
                  <div className="p-3 border-b border-[var(--border)] bg-[var(--background)]">
                    <div className="flex items-center gap-4 text-sm">
                      <span className="text-[var(--muted)]">{commitDiff.files.length} files changed</span>
                      <span className="text-[var(--success)]">
                        +{commitDiff.files.reduce((sum, f) => sum + f.additions, 0)}
                      </span>
                      <span className="text-[var(--danger)]">
                        -{commitDiff.files.reduce((sum, f) => sum + f.deletions, 0)}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {commitDiff.files.map((file, idx) => (
                        <span 
                          key={`${file.path}-${file.status}-${idx}`}
                          className="text-xs px-2 py-1 rounded bg-[var(--card)] border border-[var(--border)]"
                        >
                          <span className={file.status === 'A' ? 'text-[var(--success)]' : file.status === 'D' ? 'text-[var(--danger)]' : 'text-[var(--warning)]'}>
                            {file.status}
                          </span>
                          {' '}
                          <span className="font-mono">{file.path.split('/').pop()}</span>
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Diff Content */}
                  <div className="flex-1 overflow-auto">
                    <pre className="p-4 text-xs font-mono whitespace-pre overflow-x-auto">
                      {commitDiff.diff.split('\n').map((line, i) => {
                        let className = '';
                        if (line.startsWith('+') && !line.startsWith('+++')) {
                          className = 'bg-[var(--success)]/20 text-[var(--success)]';
                        } else if (line.startsWith('-') && !line.startsWith('---')) {
                          className = 'bg-[var(--danger)]/20 text-[var(--danger)]';
                        } else if (line.startsWith('@@')) {
                          className = 'text-[var(--primary)] bg-[var(--primary)]/10';
                        } else if (line.startsWith('diff --git')) {
                          className = 'text-[var(--muted)] font-bold mt-4 pt-4 border-t border-[var(--border)]';
                        }
                        return (
                          <div key={i} className={`${className} px-2 -mx-2`}>
                            {line || ' '}
                          </div>
                        );
                      })}
                    </pre>
                  </div>
                </>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

interface FileRowProps {
  file: FileChange;
  selected?: boolean;
  onToggle?: () => void;
  onAction: () => void;
  actionLabel: string;
  onDiscard?: () => void;
  onViewDiff?: () => void;
}

function FileRow({ file, selected, onToggle, onAction, actionLabel, onDiscard, onViewDiff }: FileRowProps) {
  const statusColors: Record<string, string> = {
    'M': 'text-[var(--warning)]',
    'A': 'text-[var(--success)]',
    'D': 'text-[var(--danger)]',
    'R': 'text-[var(--primary)]',
    '?': 'text-[var(--muted)]',
  };

  const statusLabels: Record<string, string> = {
    'M': 'Modified',
    'A': 'Added',
    'D': 'Deleted',
    'R': 'Renamed',
    '?': 'Untracked',
  };

  return (
    <li 
      className="px-4 py-2 flex items-center gap-3 hover:bg-[var(--card-hover)] group cursor-pointer"
      onClick={() => onViewDiff?.()}
    >
      {onToggle && (
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggle}
          onClick={(e) => e.stopPropagation()}
          className="rounded border-[var(--border)]"
        />
      )}
      <span className={`text-xs font-mono w-6 ${statusColors[file.status]}`}>
        {file.status}
      </span>
      <span className="flex-1 text-sm truncate font-mono">{file.path}</span>
      <span className="text-xs text-[var(--muted)] opacity-0 group-hover:opacity-100">
        {statusLabels[file.status]}
      </span>
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100">
        {onDiscard && (
          <button
            onClick={(e) => { e.stopPropagation(); onDiscard(); }}
            className="px-2 py-1 text-xs text-[var(--danger)] hover:bg-[var(--danger)]/20 rounded transition-colors"
          >
            Discard
          </button>
        )}
        <button
          onClick={(e) => { e.stopPropagation(); onAction(); }}
          className="px-2 py-1 text-xs text-[var(--primary)] hover:bg-[var(--primary)]/20 rounded transition-colors"
        >
          {actionLabel}
        </button>
      </div>
    </li>
  );
}
