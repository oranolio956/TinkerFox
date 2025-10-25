import { useState, useEffect } from 'react';
import { useScriptsStore } from '@/lib/scripts-store';
import { ScriptCard } from './ScriptCard';
import { ImportDialog } from './ImportDialog';

export function ScriptList() {
  const { scripts, createScript, deleteScript, toggleScript, updateScript } = useScriptsStore();
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'lastRun' | 'created' | 'enabled'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [selectedIndex, setSelectedIndex] = useState(0);

  const filteredScripts = scripts
    .filter(script =>
      script.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      script.metadata.description?.toLowerCase().includes(searchQuery.toLowerCase())
    )
    .sort((a, b) => {
      let comparison = 0;
      
      switch (sortBy) {
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'lastRun':
          comparison = (a.lastRunAt || 0) - (b.lastRunAt || 0);
          break;
        case 'created':
          comparison = a.createdAt - b.createdAt;
          break;
        case 'enabled':
          comparison = Number(a.enabled) - Number(b.enabled);
          break;
      }
      
      return sortOrder === 'asc' ? comparison : -comparison;
    });

  const handleCreateScript = async () => {
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
    
    await createScript(defaultCode);
  };

  const handleEnableAll = async () => {
    try {
      const disabledScripts = scripts.filter(s => !s.enabled);
      for (const script of disabledScripts) {
        await toggleScript(script.id);
      }
    } catch (error) {
      console.error('Failed to enable all scripts:', error);
    }
  };

  const handleDisableAll = async () => {
    try {
      const enabledScripts = scripts.filter(s => s.enabled);
      for (const script of enabledScripts) {
        await toggleScript(script.id);
      }
    } catch (error) {
      console.error('Failed to disable all scripts:', error);
    }
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => Math.min(prev + 1, filteredScripts.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => Math.max(prev - 1, 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (filteredScripts[selectedIndex]) {
          // Select the script and switch to editor
          const { selectScript } = useScriptsStore.getState();
          selectScript(filteredScripts[selectedIndex].id);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [filteredScripts, selectedIndex]);

  return (
    <div className="flex flex-col h-full">
      {/* Search and Actions */}
      <div className="p-4 border-b border-gray-700">
        <div className="flex items-center space-x-2 mb-3">
          <input
            type="text"
            placeholder="Search scripts..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 px-3 py-2 bg-gray-800 border border-gray-600 rounded text-sm focus:outline-none focus:border-blue-500"
          />
        </div>
        
        {/* Bulk Actions */}
        <div className="flex items-center space-x-2 mb-3">
          <button
            onClick={handleEnableAll}
            className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white text-xs rounded transition-colors"
          >
            Enable All
          </button>
          <button
            onClick={handleDisableAll}
            className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-xs rounded transition-colors"
          >
            Disable All
          </button>
        </div>
        
        {/* Sort Controls */}
        <div className="flex items-center space-x-2 mb-3">
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="px-2 py-1 bg-gray-800 border border-gray-600 rounded text-xs"
          >
            <option value="name">Name</option>
            <option value="lastRun">Last Run</option>
            <option value="created">Created</option>
            <option value="enabled">Status</option>
          </select>
          <button
            onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
            className="px-2 py-1 bg-gray-700 hover:bg-gray-600 text-white text-xs rounded transition-colors"
          >
            {sortOrder === 'asc' ? '↑' : '↓'}
          </button>
        </div>
        
        <div className="flex space-x-2">
          <button
            onClick={handleCreateScript}
            className="px-3 py-2 bg-blue-600 hover:bg-blue-700 rounded text-sm transition-colors"
          >
            + New Script
          </button>
          <button
            onClick={() => setShowImportDialog(true)}
            className="px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded text-sm transition-colors"
          >
            Import
          </button>
        </div>
      </div>

      {/* Scripts List */}
      <div className="flex-1 overflow-y-auto">
        {filteredScripts.length === 0 ? (
          <div className="p-8 text-center text-gray-400">
            {searchQuery ? (
              <div>
                <p className="text-lg mb-2">No scripts found</p>
                <p className="text-sm">Try a different search term</p>
              </div>
            ) : (
              <div>
                <p className="text-lg mb-2">No scripts yet</p>
                <p className="text-sm mb-4">Create your first script or import from Tampermonkey</p>
                <button
                  onClick={handleCreateScript}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded transition-colors"
                >
                  Create Script
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="p-2 space-y-2">
            {filteredScripts.map(script => (
              <ScriptCard
                key={script.id}
                script={script}
                onToggle={() => toggleScript(script.id)}
                onDelete={() => deleteScript(script.id)}
              />
            ))}
          </div>
        )}
      </div>

      {showImportDialog && (
        <ImportDialog
          onClose={() => setShowImportDialog(false)}
          onSuccess={() => {
            setShowImportDialog(false);
            // Scripts will be reloaded automatically
          }}
        />
      )}
    </div>
  );
}