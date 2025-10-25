import React, { useState } from 'react';
import { useScriptsStore } from '../hooks/useScriptsStore';
import { ScriptCard } from './ScriptCard';
import { ImportDialog } from './ImportDialog';

export function ScriptList() {
  const { scripts, createScript, deleteScript, toggleScript } = useScriptsStore();
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const filteredScripts = scripts.filter(script =>
    script.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    script.metadata.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

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