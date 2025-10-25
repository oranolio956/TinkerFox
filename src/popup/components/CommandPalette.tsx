import React, { useState, useEffect, useRef } from 'react';
import { useScriptsStore } from '../hooks/useScriptsStore';

interface Command {
  id: string;
  label: string;
  icon: string;
  action: () => void;
  shortcut?: string;
  category: string;
}

interface CommandPaletteProps {
  onClose: () => void;
}

export function CommandPalette({ onClose }: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
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
        const defaultCode = `// ==UserScript==
// @name         New Script
// @namespace    http://tampermonkey.net/
// @version      1.0.0
// @description  A new userscript
// @author       You
// @match        *://*/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';
    
    // Your code here
    console.log('Hello from ScriptFlow!');
})();`;
        createScript(defaultCode);
        onClose();
      },
      shortcut: '⌘N',
      category: 'Quick Actions',
    },
    {
      id: 'reload-scripts',
      label: 'Reload Scripts',
      icon: '🔄',
      action: () => {
        loadScripts();
        onClose();
      },
      shortcut: '⌘R',
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

  // Filter commands based on query
  const filteredCommands = query.length > 0
    ? commands.filter(cmd =>
        cmd.label.toLowerCase().includes(query.toLowerCase()) ||
        cmd.category.toLowerCase().includes(query.toLowerCase())
      )
    : commands;

  // Group commands by category
  const groupedCommands = filteredCommands.reduce((acc, cmd) => {
    if (!acc[cmd.category]) {
      acc[cmd.category] = [];
    }
    acc[cmd.category].push(cmd);
    return acc;
  }, {} as Record<string, Command[]>);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex(prev => Math.min(prev + 1, filteredCommands.length - 1));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex(prev => Math.max(prev - 1, 0));
          break;
        case 'Enter':
          e.preventDefault();
          if (filteredCommands[selectedIndex]) {
            filteredCommands[selectedIndex].action();
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
  }, [filteredCommands, selectedIndex, onClose]);

  // Auto-focus input
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Reset selected index when query changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-start justify-center pt-32 z-50">
      <div className="bg-gray-800 rounded-lg shadow-xl w-96 max-h-96 overflow-hidden border border-gray-700">
        {/* Search Input */}
        <div className="p-4 border-b border-gray-700">
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type a command or search..."
            className="w-full bg-transparent text-white text-lg outline-none placeholder-gray-400"
          />
        </div>

        {/* Results */}
        <div className="overflow-y-auto max-h-80">
          {Object.entries(groupedCommands).map(([category, cmds]) => (
            <div key={category}>
              {/* Category Header */}
              <div className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide bg-gray-900">
                {category}
              </div>
              
              {/* Commands */}
              {cmds.map((cmd, idx) => {
                const globalIndex = filteredCommands.indexOf(cmd);
                const isSelected = globalIndex === selectedIndex;
                
                return (
                  <button
                    key={cmd.id}
                    onClick={cmd.action}
                    className={`w-full flex items-center justify-between px-4 py-3 transition-colors ${
                      isSelected
                        ? 'bg-blue-600 text-white'
                        : 'text-gray-300 hover:bg-gray-700'
                    }`}
                  >
                    <div className="flex items-center space-x-3">
                      <span className="text-xl">{cmd.icon}</span>
                      <span className="font-medium">{cmd.label}</span>
                    </div>
                    {cmd.shortcut && (
                      <span className="text-xs text-gray-400 font-mono">
                        {cmd.shortcut}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
          
          {/* No Results */}
          {filteredCommands.length === 0 && (
            <div className="px-4 py-8 text-center text-gray-400">
              No commands found for "{query}"
            </div>
          )}
        </div>
      </div>
    </div>
  );
}