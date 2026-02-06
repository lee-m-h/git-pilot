'use client';

import { useState, useEffect, useCallback } from 'react';

interface FolderInfo {
  name: string;
  path: string;
  isGitRepo: boolean;
}

interface BrowseResult {
  current: string;
  parent: string;
  folders: FolderInfo[];
}

interface FolderPickerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (path: string) => void;
}

export default function FolderPicker({ isOpen, onClose, onSelect }: FolderPickerProps) {
  const [currentPath, setCurrentPath] = useState('~');
  const [folders, setFolders] = useState<FolderInfo[]>([]);
  const [parentPath, setParentPath] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inputPath, setInputPath] = useState('');

  const browse = useCallback(async (path: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/browse?path=${encodeURIComponent(path)}`);
      const data: BrowseResult = await res.json();
      
      if (!res.ok) {
        throw new Error((data as unknown as { error: string }).error || 'Failed to browse');
      }
      
      setCurrentPath(data.current);
      setParentPath(data.parent);
      setFolders(data.folders);
      setInputPath(data.current);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to browse');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      browse('~');
    }
  }, [isOpen, browse]);

  const handleGoUp = () => {
    if (parentPath && parentPath !== currentPath) {
      browse(parentPath);
    }
  };

  const handleGoToPath = () => {
    if (inputPath.trim()) {
      browse(inputPath.trim());
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={onClose}>
      <div 
        className="bg-[var(--card)] rounded-xl w-[600px] max-h-[80vh] flex flex-col shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 border-b border-[var(--border)]">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold">Select Git Repository</h2>
            <button
              onClick={onClose}
              className="p-1 rounded hover:bg-[var(--card-hover)] transition-colors"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          
          {/* Path Input */}
          <div className="flex gap-2">
            <input
              type="text"
              value={inputPath}
              onChange={(e) => setInputPath(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleGoToPath()}
              className="flex-1 px-3 py-2 bg-[var(--background)] border border-[var(--border)] rounded-lg text-sm focus:outline-none focus:border-[var(--primary)]"
              placeholder="Enter path..."
            />
            <button
              onClick={handleGoToPath}
              className="px-4 py-2 bg-[var(--primary)] hover:bg-[var(--primary-hover)] rounded-lg text-sm transition-colors"
            >
              Go
            </button>
          </div>
        </div>

        {/* Navigation */}
        <div className="px-4 py-2 border-b border-[var(--border)] flex items-center gap-2 text-sm">
          <button
            onClick={handleGoUp}
            disabled={!parentPath || parentPath === currentPath}
            className="p-1.5 rounded hover:bg-[var(--card-hover)] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            title="Go up"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
            </svg>
          </button>
          <span className="text-[var(--muted)] truncate">{currentPath}</span>
        </div>

        {/* Folder List */}
        <div className="flex-1 overflow-y-auto p-2 min-h-[300px]">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-[var(--primary)] border-t-transparent"></div>
            </div>
          ) : error ? (
            <div className="flex items-center justify-center h-full text-[var(--danger)]">
              {error}
            </div>
          ) : folders.length === 0 ? (
            <div className="flex items-center justify-center h-full text-[var(--muted)]">
              No folders found
            </div>
          ) : (
            <ul className="space-y-0.5">
              {folders.map((folder) => (
                <li
                  key={folder.path}
                  className={`
                    flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-colors
                    ${folder.isGitRepo ? 'hover:bg-[var(--primary)]/20' : 'hover:bg-[var(--card-hover)]'}
                  `}
                  onClick={() => folder.isGitRepo ? onSelect(folder.path) : browse(folder.path)}
                  onDoubleClick={() => !folder.isGitRepo && browse(folder.path)}
                >
                  {folder.isGitRepo ? (
                    <svg className="w-5 h-5 text-[var(--success)]" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/>
                    </svg>
                  ) : (
                    <svg className="w-5 h-5 text-[var(--muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                    </svg>
                  )}
                  <span className={`flex-1 text-sm ${folder.isGitRepo ? 'font-medium text-[var(--success)]' : ''}`}>
                    {folder.name}
                  </span>
                  {folder.isGitRepo && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--success)]/20 text-[var(--success)]">
                      Git
                    </span>
                  )}
                  {!folder.isGitRepo && (
                    <svg className="w-4 h-4 text-[var(--muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Footer hint */}
        <div className="px-4 py-3 border-t border-[var(--border)] text-xs text-[var(--muted)]">
          💡 Click a <span className="text-[var(--success)]">green folder</span> to add it, or click a folder to navigate into it
        </div>
      </div>
    </div>
  );
}
