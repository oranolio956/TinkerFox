// Virtualized Script List for handling large numbers of scripts
import React, { useMemo, useCallback } from 'react';
import { FixedSizeList as List } from 'react-window';
import { UserScript } from '@/types';
import { useScriptsStore } from '@/lib/scripts-store';

interface VirtualizedScriptListProps {
  scripts: UserScript[];
  height: number;
  onScriptSelect: (script: UserScript) => void;
  onScriptToggle: (scriptId: string) => void;
  searchQuery: string;
}

interface ScriptItemProps {
  index: number;
  style: React.CSSProperties;
  data: {
    scripts: UserScript[];
    onScriptSelect: (script: UserScript) => void;
    onScriptToggle: (scriptId: string) => void;
    searchQuery: string;
  };
}

const ScriptItem = React.memo(({ index, style, data }: ScriptItemProps) => {
  const { scripts, onScriptSelect, onScriptToggle, searchQuery } = data;
  const script = scripts[index];

  const handleClick = useCallback(() => {
    onScriptSelect(script);
  }, [script, onScriptSelect]);

  const handleToggle = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onScriptToggle(script.id);
  }, [script.id, onScriptToggle]);

  // Highlight search matches
  const highlightText = useCallback((text: string, query: string) => {
    if (!query) return text;
    
    const regex = new RegExp(`(${query})`, 'gi');
    const parts = text.split(regex);
    
    return parts.map((part, index) => 
      regex.test(part) ? (
        <mark key={index} className="bg-yellow-200 text-yellow-900 px-1 rounded">
          {part}
        </mark>
      ) : part
    );
  }, []);

  return (
    <div style={style} className="px-4 py-2">
      <div
        onClick={handleClick}
        className="bg-gray-800 border border-gray-700 rounded-lg p-3 cursor-pointer hover:bg-gray-750 transition-colors"
      >
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-semibold text-base text-white">
            {highlightText(script.name, searchQuery)}
          </h3>
          <button
            onClick={handleToggle}
            className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${
              script.enabled
                ? 'bg-green-500 border-green-500 text-white'
                : 'border-gray-400 text-gray-400 hover:border-green-500'
            }`}
          >
            {script.enabled && '✓'}
          </button>
        </div>
        
        {script.metadata.description && (
          <p className="text-sm text-gray-400 mb-2">
            {highlightText(script.metadata.description, searchQuery)}
          </p>
        )}
        
        <div className="flex items-center gap-4 text-xs text-gray-500">
          <span>v{script.version}</span>
          <span>•</span>
          <span>{script.runCount} runs</span>
          {script.lastRunAt && (
            <>
              <span>•</span>
              <span>
                Last run: {new Date(script.lastRunAt).toLocaleDateString()}
              </span>
            </>
          )}
        </div>
        
        {script.metadata.match && script.metadata.match.length > 0 && (
          <div className="mt-2">
            <div className="flex flex-wrap gap-1">
              {script.metadata.match.slice(0, 2).map((pattern, idx) => (
                <span
                  key={idx}
                  className="bg-blue-900 text-blue-200 px-2 py-1 rounded text-xs"
                >
                  {pattern}
                </span>
              ))}
              {script.metadata.match.length > 2 && (
                <span className="bg-gray-700 text-gray-300 px-2 py-1 rounded text-xs">
                  +{script.metadata.match.length - 2} more
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
});

ScriptItem.displayName = 'ScriptItem';

export const VirtualizedScriptList: React.FC<VirtualizedScriptListProps> = ({
  scripts,
  height,
  onScriptSelect,
  onScriptToggle,
  searchQuery,
}) => {
  const itemData = useMemo(() => ({
    scripts,
    onScriptSelect,
    onScriptToggle,
    searchQuery,
  }), [scripts, onScriptSelect, onScriptToggle, searchQuery]);

  const itemSize = 120; // Height of each script item

  if (scripts.length === 0) {
    return (
      <div className="flex items-center justify-center h-32 text-gray-500">
        <div className="text-center">
          <p className="text-lg mb-2">No scripts found</p>
          <p className="text-sm">
            {searchQuery ? 'Try adjusting your search terms' : 'Create your first script'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <List
      height={height}
      itemCount={scripts.length}
      itemSize={itemSize}
      itemData={itemData}
      overscanCount={5} // Render 5 extra items for smooth scrolling
      className="scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-gray-800"
    >
      {ScriptItem}
    </List>
  );
};