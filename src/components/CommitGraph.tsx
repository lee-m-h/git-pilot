'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';

interface GraphCommit {
  hash: string;
  shortHash: string;
  message: string;
  author: string;
  date: string;
  parents: string[];
  branches: string[];
  tags: string[];
  isHead: boolean;
}

interface CommitGraphProps {
  repoId: string;
  onSelectCommit: (hash: string, message: string) => void;
}

const COLORS = [
  '#3b82f6', // blue
  '#22c55e', // green
  '#f59e0b', // amber
  '#ef4444', // red
  '#8b5cf6', // violet
  '#06b6d4', // cyan
  '#ec4899', // pink
  '#f97316', // orange
];

const ROW_HEIGHT = 32;
const COL_WIDTH = 14;
const NODE_RADIUS = 4;
const PADDING_LEFT = 8;

export default function CommitGraph({ repoId, onSelectCommit }: CommitGraphProps) {
  const [commits, setCommits] = useState<GraphCommit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchGraph = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/repos/${repoId}/graph?limit=100`);
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || 'Failed to fetch graph');
      }
      
      setCommits(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to fetch');
    } finally {
      setLoading(false);
    }
  }, [repoId]);

  useEffect(() => {
    fetchGraph();
  }, [fetchGraph]);

  // Calculate graph layout
  const { nodePositions, edges, maxLane } = useMemo(() => {
    const hashToIndex = new Map<string, number>();
    commits.forEach((c, i) => hashToIndex.set(c.hash, i));

    // Assign lanes to each commit
    const lanes: number[] = new Array(commits.length).fill(-1);
    const laneOccupied: boolean[] = []; // which lanes are currently occupied
    
    // Track which hash is expected in which lane
    const laneExpects: (string | null)[] = [];

    for (let i = 0; i < commits.length; i++) {
      const commit = commits[i];
      
      // Check if any lane is expecting this commit
      let assignedLane = laneExpects.indexOf(commit.hash);
      
      if (assignedLane === -1) {
        // Find first free lane
        assignedLane = laneOccupied.findIndex(o => !o);
        if (assignedLane === -1) {
          assignedLane = laneOccupied.length;
        }
      }
      
      lanes[i] = assignedLane;
      laneOccupied[assignedLane] = true;
      laneExpects[assignedLane] = null;

      // Reserve lanes for parents
      if (commit.parents.length > 0) {
        // First parent continues in same lane
        laneExpects[assignedLane] = commit.parents[0];
        
        // Additional parents need their own lanes
        for (let p = 1; p < commit.parents.length; p++) {
          const parentHash = commit.parents[p];
          // Check if parent already has a lane reserved
          if (!laneExpects.includes(parentHash)) {
            // Find a free lane for this parent
            let parentLane = laneOccupied.findIndex((o, idx) => !o && idx !== assignedLane);
            if (parentLane === -1) {
              parentLane = laneOccupied.length;
            }
            laneOccupied[parentLane] = true;
            laneExpects[parentLane] = parentHash;
          }
        }
      } else {
        // No parents - this lane ends here
        laneOccupied[assignedLane] = false;
      }
      
      // Free up lane if no future commit will use it
      const remainingCommits = commits.slice(i + 1);
      for (let lane = 0; lane < laneExpects.length; lane++) {
        if (laneExpects[lane] && !remainingCommits.some(c => c.hash === laneExpects[lane])) {
          laneOccupied[lane] = false;
          laneExpects[lane] = null;
        }
      }
    }

    // Build node positions
    const nodePositions = commits.map((commit, i) => ({
      hash: commit.hash,
      x: lanes[i] * COL_WIDTH + PADDING_LEFT,
      y: i * ROW_HEIGHT + ROW_HEIGHT / 2,
      lane: lanes[i],
      color: COLORS[lanes[i] % COLORS.length],
    }));

    // Build edges
    const edges: { x1: number; y1: number; x2: number; y2: number; color: string }[] = [];
    
    for (let i = 0; i < commits.length; i++) {
      const commit = commits[i];
      const node = nodePositions[i];
      
      for (let p = 0; p < commit.parents.length; p++) {
        const parentHash = commit.parents[p];
        const parentIndex = hashToIndex.get(parentHash);
        
        if (parentIndex !== undefined) {
          const parentNode = nodePositions[parentIndex];
          edges.push({
            x1: node.x,
            y1: node.y,
            x2: parentNode.x,
            y2: parentNode.y,
            color: p === 0 ? node.color : parentNode.color,
          });
        } else {
          // Parent not in visible range - draw line to bottom
          edges.push({
            x1: node.x,
            y1: node.y,
            x2: node.x,
            y2: commits.length * ROW_HEIGHT,
            color: node.color,
          });
        }
      }
    }

    const maxLane = Math.max(...lanes, 0) + 1;
    return { nodePositions, edges, maxLane };
  }, [commits]);

  const graphWidth = maxLane * COL_WIDTH + PADDING_LEFT * 2;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-[var(--primary)] border-t-transparent"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64 text-[var(--danger)]">
        {error}
      </div>
    );
  }

  return (
    <div className="bg-[var(--card)] rounded-lg border border-[var(--border)] overflow-hidden">
      <div className="px-4 py-3 border-b border-[var(--border)] flex items-center justify-between">
        <h3 className="font-medium">Commit Graph</h3>
        <button
          onClick={fetchGraph}
          className="p-1 rounded hover:bg-[var(--card-hover)] transition-colors"
          title="Refresh"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>
      </div>
      
      <div className="overflow-auto max-h-[500px]">
        <div className="flex min-w-max">
          {/* Graph SVG */}
          <svg 
            width={graphWidth} 
            height={commits.length * ROW_HEIGHT + 10}
            className="flex-shrink-0"
          >
            {/* Edges */}
            {edges.map((edge, i) => {
              if (edge.x1 === edge.x2) {
                // Straight vertical line
                return (
                  <line
                    key={i}
                    x1={edge.x1}
                    y1={edge.y1}
                    x2={edge.x2}
                    y2={edge.y2}
                    stroke={edge.color}
                    strokeWidth={2}
                  />
                );
              } else {
                // Diagonal or curved line for merges/branches
                return (
                  <path
                    key={i}
                    d={`M ${edge.x1} ${edge.y1} C ${edge.x1} ${(edge.y1 + edge.y2) / 2}, ${edge.x2} ${(edge.y1 + edge.y2) / 2}, ${edge.x2} ${edge.y2}`}
                    stroke={edge.color}
                    strokeWidth={2}
                    fill="none"
                  />
                );
              }
            })}

            {/* Nodes */}
            {nodePositions.map((node, i) => (
              <circle
                key={node.hash}
                cx={node.x}
                cy={node.y}
                r={commits[i].isHead ? NODE_RADIUS + 2 : NODE_RADIUS}
                fill={commits[i].isHead ? node.color : 'var(--background)'}
                stroke={node.color}
                strokeWidth={2}
              />
            ))}
          </svg>

          {/* Commit info */}
          <div className="flex-1">
            {commits.map((commit, i) => (
              <div
                key={commit.hash}
                className="flex items-center gap-2 px-3 hover:bg-[var(--card-hover)] cursor-pointer transition-colors"
                style={{ height: ROW_HEIGHT }}
                onClick={() => onSelectCommit(commit.hash, commit.message)}
              >
                {/* Branches & Tags */}
                <div className="flex items-center gap-1 min-w-0 flex-shrink-0">
                  {commit.branches.slice(0, 2).map((branch) => (
                    <span
                      key={branch}
                      className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--primary)]/20 text-[var(--primary)] truncate max-w-[80px]"
                      title={branch}
                    >
                      {branch}
                    </span>
                  ))}
                  {commit.branches.length > 2 && (
                    <span className="text-[10px] text-[var(--muted)]">
                      +{commit.branches.length - 2}
                    </span>
                  )}
                  {commit.tags.slice(0, 1).map((tag) => (
                    <span
                      key={tag}
                      className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--warning)]/20 text-[var(--warning)] truncate max-w-[60px]"
                      title={tag}
                    >
                      🏷 {tag}
                    </span>
                  ))}
                </div>

                {/* Hash */}
                <code className="text-xs text-[var(--primary)] font-mono flex-shrink-0 w-16">
                  {commit.shortHash}
                </code>

                {/* Message */}
                <span className="text-sm truncate flex-1 min-w-0">
                  {commit.message}
                </span>

                {/* Date */}
                <span className="text-xs text-[var(--muted)] flex-shrink-0 w-20 text-right">
                  {commit.date}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
