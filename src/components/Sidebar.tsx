'use client';

import { useState, useRef } from 'react';
import type { Repo } from '@/types';
import ThemeToggle from './ThemeToggle';

interface SidebarProps {
  repos: Repo[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onAdd: () => void;
  onRemove: (id: string) => void;
  onToggleFavorite: (id: string) => void;
  onReorder: (orderedIds: string[]) => void;
}

export default function Sidebar({ repos, selectedId, onSelect, onAdd, onRemove, onToggleFavorite, onReorder }: SidebarProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const dragCounter = useRef(0);

  const handleDragStart = (e: React.DragEvent, id: string) => {
    setDraggedId(id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragEnd = () => {
    setDraggedId(null);
    setDragOverId(null);
    dragCounter.current = 0;
  };

  const handleDragEnter = (e: React.DragEvent, id: string) => {
    e.preventDefault();
    dragCounter.current++;
    if (id !== draggedId) {
      setDragOverId(id);
    }
  };

  const handleDragLeave = () => {
    dragCounter.current--;
    if (dragCounter.current === 0) {
      setDragOverId(null);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    if (!draggedId || draggedId === targetId) return;

    const newOrder = [...repos];
    const draggedIndex = newOrder.findIndex(r => r.id === draggedId);
    const targetIndex = newOrder.findIndex(r => r.id === targetId);
    
    const [removed] = newOrder.splice(draggedIndex, 1);
    newOrder.splice(targetIndex, 0, removed);
    
    onReorder(newOrder.map(r => r.id));
    setDraggedId(null);
    setDragOverId(null);
  };

  // Separate favorites and regular repos
  const favorites = repos.filter(r => r.favorite);
  const regular = repos.filter(r => !r.favorite);

  const renderRepoItem = (repo: Repo) => (
    <li
      key={repo.id}
      draggable
      onDragStart={(e) => handleDragStart(e, repo.id)}
      onDragEnd={handleDragEnd}
      onDragEnter={(e) => handleDragEnter(e, repo.id)}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={(e) => handleDrop(e, repo.id)}
      className={`
        group relative flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-all
        ${selectedId === repo.id 
          ? 'bg-[var(--primary)] text-white' 
          : 'hover:bg-[var(--card-hover)]'
        }
        ${draggedId === repo.id ? 'opacity-50' : ''}
        ${dragOverId === repo.id ? 'border-t-2 border-[var(--primary)]' : ''}
      `}
      onClick={() => onSelect(repo.id)}
      onMouseEnter={() => setHoveredId(repo.id)}
      onMouseLeave={() => setHoveredId(null)}
    >
      {/* Drag handle */}
      <svg className="w-3 h-3 text-[var(--muted)] opacity-0 group-hover:opacity-50 cursor-grab flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
        <circle cx="9" cy="6" r="1.5" />
        <circle cx="15" cy="6" r="1.5" />
        <circle cx="9" cy="12" r="1.5" />
        <circle cx="15" cy="12" r="1.5" />
        <circle cx="9" cy="18" r="1.5" />
        <circle cx="15" cy="18" r="1.5" />
      </svg>
      
      {/* Folder icon */}
      <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
      </svg>
      
      <span className="flex-1 truncate text-sm">{repo.name}</span>
      
      {/* Action buttons */}
      {(hoveredId === repo.id || repo.favorite) && selectedId !== repo.id && (
        <div className="flex items-center gap-0.5">
          {/* Favorite button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleFavorite(repo.id);
            }}
            className={`p-1 rounded transition-colors ${repo.favorite ? 'text-yellow-500' : 'text-[var(--muted)] hover:text-yellow-500'}`}
            title={repo.favorite ? '즐겨찾기 해제' : '즐겨찾기'}
          >
            <svg className="w-3 h-3" fill={repo.favorite ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
            </svg>
          </button>
          
          {/* Remove button */}
          {hoveredId === repo.id && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onRemove(repo.id);
              }}
              className="p-1 rounded hover:bg-[var(--danger)] hover:text-white transition-colors text-[var(--muted)]"
              title="Remove repository"
            >
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      )}
    </li>
  );

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
        {/* Favorites Section */}
        {favorites.length > 0 && (
          <>
            <div className="flex items-center justify-between px-2 py-1 mb-2">
              <span className="text-xs text-[var(--muted)] uppercase tracking-wider flex items-center gap-1">
                <svg className="w-3 h-3 text-yellow-500" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                </svg>
                즐겨찾기
              </span>
              <span className="text-xs text-[var(--muted)]">{favorites.length}</span>
            </div>
            <ul className="space-y-1 mb-4">
              {favorites.map(renderRepoItem)}
            </ul>
          </>
        )}

        {/* Regular Repos Section */}
        <div className="flex items-center justify-between px-2 py-1 mb-2">
          <span className="text-xs text-[var(--muted)] uppercase tracking-wider">Repositories</span>
          <span className="text-xs text-[var(--muted)]">{regular.length}</span>
        </div>

        {repos.length === 0 ? (
          <p className="text-sm text-[var(--muted)] px-2 py-4 text-center">
            No repositories added yet
          </p>
        ) : (
          <ul className="space-y-1">
            {regular.map(renderRepoItem)}
          </ul>
        )}
      </div>

      {/* Footer */}
      <div className="p-3 border-t border-[var(--border)] space-y-2">
        <div className="flex justify-center">
          <ThemeToggle />
        </div>
        <button
          onClick={onAdd}
          className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-[var(--primary)] hover:bg-[var(--primary-hover)] rounded-lg transition-colors text-sm font-medium text-white"
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
