'use client';

import { useState, useEffect, useCallback } from 'react';
import Sidebar from '@/components/Sidebar';
import RepoPanel from '@/components/RepoPanel';
import FolderPicker from '@/components/FolderPicker';
import type { Repo } from '@/types';

export default function Home() {
  const [repos, setRepos] = useState<Repo[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showPicker, setShowPicker] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchRepos = useCallback(async () => {
    try {
      const res = await fetch('/api/repos');
      const data = await res.json();
      setRepos(data);
      
      // Auto-select first repo if none selected
      if (!selectedId && data.length > 0) {
        setSelectedId(data[0].id);
      }
    } catch (error) {
      console.error('Failed to fetch repos:', error);
    } finally {
      setLoading(false);
    }
  }, [selectedId]);

  useEffect(() => {
    fetchRepos();
  }, [fetchRepos]);

  const handleAddRepo = async (path: string) => {
    try {
      const res = await fetch('/api/repos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path }),
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        alert(data.error || 'Failed to add repository');
        return;
      }
      
      setRepos([...repos, data]);
      setSelectedId(data.id);
      setShowPicker(false);
    } catch (error) {
      alert('Failed to add repository');
    }
  };

  const handleRemoveRepo = async (id: string) => {
    if (!confirm('Remove this repository from the list?')) return;
    
    try {
      await fetch(`/api/repos/${id}`, { method: 'DELETE' });
      setRepos(repos.filter(r => r.id !== id));
      
      if (selectedId === id) {
        setSelectedId(repos.length > 1 ? repos.find(r => r.id !== id)?.id || null : null);
      }
    } catch (error) {
      alert('Failed to remove repository');
    }
  };

  const handleToggleFavorite = async (id: string) => {
    try {
      await fetch('/api/repos', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'toggle-favorite', id }),
      });
      await fetchRepos();
    } catch (error) {
      console.error('Failed to toggle favorite');
    }
  };

  const handleReorder = async (orderedIds: string[]) => {
    // Optimistic update
    const reordered = orderedIds.map(id => repos.find(r => r.id === id)!).filter(Boolean);
    setRepos(reordered);
    
    try {
      await fetch('/api/repos', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reorder', orderedIds }),
      });
    } catch (error) {
      console.error('Failed to reorder repos');
      fetchRepos(); // Revert on error
    }
  };

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-[var(--primary)] border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="h-screen flex">
      <Sidebar
        repos={repos}
        selectedId={selectedId}
        onSelect={setSelectedId}
        onAdd={() => setShowPicker(true)}
        onRemove={handleRemoveRepo}
        onToggleFavorite={handleToggleFavorite}
        onReorder={handleReorder}
      />
      
      <RepoPanel 
        repoId={selectedId} 
        onRefresh={fetchRepos}
      />

      <FolderPicker
        isOpen={showPicker}
        onClose={() => setShowPicker(false)}
        onSelect={handleAddRepo}
      />
    </div>
  );
}
