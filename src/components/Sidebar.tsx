'use client';

import { useState } from 'react';
import type { Repo } from '@/types';

interface SidebarProps {
  repos: Repo[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onAdd: () => void;
  onRemove: (id: string) => void;
}

export default function Sidebar({ repos, selectedId, onSelect, onAdd, onRemove }: SidebarProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  return (
    <aside className="w-64 h-screen bg-[var(--card)] border-r border-[var(--border)] flex flex-col">
      {/* Header */}
      <div className="pt-10 pb-4 px-4 border-b border-[var(--border)]">
        <div className="flex items-center gap-2">
          <svg className="w-6 h-6 text-[var(--primary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
          </svg>
          <h1 className="font-bold text-lg">Git Pilot</h1>
        </div>
      </div>

      {/* Repo List */}
      <div className="flex-1 overflow-y-auto p-2">
        <div className="flex items-center justify-between px-2 py-1 mb-2">
          <span className="text-xs text-[var(--muted)] uppercase tracking-wider">Repositories</span>
          <span className="text-xs text-[var(--muted)]">{repos.length}</span>
        </div>

        {repos.length === 0 ? (
          <p className="text-sm text-[var(--muted)] px-2 py-4 text-center">
            No repositories added yet
          </p>
        ) : (
          <ul className="space-y-1">
            {repos.map((repo) => (
              <li
                key={repo.id}
                className={`
                  group relative flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors
                  ${selectedId === repo.id 
                    ? 'bg-[var(--primary)] text-white' 
                    : 'hover:bg-[var(--card-hover)]'
                  }
                `}
                onClick={() => onSelect(repo.id)}
                onMouseEnter={() => setHoveredId(repo.id)}
                onMouseLeave={() => setHoveredId(null)}
              >
                <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                </svg>
                <span className="flex-1 truncate text-sm">{repo.name}</span>
                
                {hoveredId === repo.id && selectedId !== repo.id && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemove(repo.id);
                    }}
                    className="absolute right-2 p-1 rounded hover:bg-[var(--danger)] hover:text-white transition-colors"
                    title="Remove repository"
                  >
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Add Button */}
      <div className="p-3 border-t border-[var(--border)]">
        <button
          onClick={onAdd}
          className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-[var(--primary)] hover:bg-[var(--primary-hover)] rounded-lg transition-colors text-sm font-medium"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Repository
        </button>
      </div>
    </aside>
  );
}
