import { useState, useEffect, useRef } from 'react';
import Fuse from 'fuse.js';
import { useScriptsStore } from '@/lib/scripts-store';
import { Command } from '@/types';
import { ImportDialog } from './ImportDialog';

interface CommandPaletteProps {
  onClose: () => void;
}

export function CommandPalette({ onClose }: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  
  const { scripts, createScript, selectScript, loadScripts } = useScriptsStore();
  
  // Build command list
  const commands: Command[] = [
    // Quick Actions
    {
      id: 'create-script',
      label: 'Create New Script',
      icon: '➕',
      action: () => {
        createScript('// ==UserScript==\n// @name New Script\n// @version 1.0.0\n// @match *://example.com/*\n// ==/UserScript==\n\nconsole.log("Hello, ScriptFlow!");');
        onClose();
      },
      shortcut: '⌘N',
      category: 'Quick Actions',
    },
    {
      id: 'import-tampermonkey',
      label: 'Import from Tampermonkey',
      icon: '📥',
      action: () => {
        setShowImportDialog(true);
        onClose();
      },
      shortcut: '⌘I',
      category: 'Quick Actions',
    },
    
    // Script Navigation
    ...scripts.map(script => ({
      id: `script-${script.id}`,
      label: script.name,
      icon: script.enabled ? '🟢' : '🔴',
      action: () => {
        selectScript(script.id);
        onClose();
      },
      category: 'Your Scripts',
    })),
  ];
  
  // Fuzzy search
  const fuse = new Fuse(commands, {
    keys: ['label', 'category'],
    threshold: 0.3,
    distance: 100,
  });
  
  const results = query.length > 0
    ? fuse.search(query).map(r => r.item)
    : commands;
  
  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex(i => Math.min(i + 1, results.length - 1));
          break;
          
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex(i => Math.max(i - 1, 0));
          break;
          
        case 'Enter':
          e.preventDefault();
          if (results[selectedIndex]) {
            results[selectedIndex].action();
          }
          break;
          
        case 'Escape':
          e.preventDefault();
          onClose();
          break;
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [results, selectedIndex]);
  
  // Auto-focus input
  useEffect(() => {
    inputRef.current?.focus();
  }, []);
  
  // Group results by category
  const groupedResults = results.reduce((acc, cmd) => {
    if (!acc[cmd.category]) acc[cmd.category] = [];
    acc[cmd.category].push(cmd);
    return acc;
  }, {} as Record<string, Command[]>);
  
  return (
    <div 
      className="fixed inset-0 bg-black/50 flex items-start justify-center pt-32 z-50"
      onClick={onClose}
    >
      <div 
        className="bg-gray-900 rounded-xl shadow-2xl w-[600px] max-h-[400px] overflow-hidden border border-gray-700"
        onClick={e => e.stopPropagation()}
      >
        {/* Search Input */}
        <div className="p-4 border-b border-gray-700">
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            placeholder="Type a command or search..."
            className="w-full bg-transparent text-white text-lg outline-none placeholder-gray-500"
          />
        </div>
        
        {/* Results */}
        <div className="overflow-y-auto max-h-[320px]">
          {Object.entries(groupedResults).map(([category, cmds]) => (
            <div key={category}>
              {/* Category Header */}
              <div className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                {category}
              </div>
              
              {/* Commands */}
              {cmds.map((cmd, _idx) => {
                const globalIndex = results.indexOf(cmd);
                const isSelected = globalIndex === selectedIndex;
                
                return (
                  <button
                    key={cmd.id}
                    onClick={cmd.action}
                    className={`
                      w-full flex items-center justify-between px-4 py-3
                      transition-colors duration-150
                      ${isSelected 
                        ? 'bg-blue-500/20 text-blue-500' 
                        : 'text-gray-300 hover:bg-gray-800'
                      }
                    `}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-xl">{cmd.icon}</span>
                      <span className="font-medium">{cmd.label}</span>
                    </div>
                    
                    {cmd.shortcut && (
                      <span className="text-xs text-gray-500 font-mono">{cmd.shortcut}</span>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
          
          {/* No Results */}
          {results.length === 0 && (
            <div className="px-4 py-8 text-center text-gray-500">
              No commands found for "{query}"
            </div>
          )}
        </div>
      </div>
      
      {/* Import Dialog */}
      {showImportDialog && (
        <ImportDialog 
          onClose={() => setShowImportDialog(false)} 
          onSuccess={() => {
            loadScripts();
            setShowImportDialog(false);
          }} 
        />
      )}
    </div>
  );
}