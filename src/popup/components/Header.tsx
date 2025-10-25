import React from 'react';

interface HeaderProps {
  activeTab: 'scripts' | 'editor' | 'debug';
  onTabChange: (tab: 'scripts' | 'editor' | 'debug') => void;
  onCommandPalette: () => void;
}

export function Header({ activeTab, onTabChange, onCommandPalette }: HeaderProps) {
  return (
    <header className="bg-gray-800 border-b border-gray-700 px-4 py-3">
      <div className="flex items-center justify-between mb-3">
        <h1 className="text-lg font-bold text-blue-400">ScriptFlow</h1>
        <button
          onClick={onCommandPalette}
          className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-sm transition-colors"
        >
          ⌘K
        </button>
      </div>
      
      <nav className="flex space-x-1">
        <button
          onClick={() => onTabChange('scripts')}
          className={`px-3 py-1 rounded text-sm transition-colors ${
            activeTab === 'scripts'
              ? 'bg-blue-600 text-white'
              : 'text-gray-300 hover:bg-gray-700'
          }`}
        >
          Scripts
        </button>
        <button
          onClick={() => onTabChange('editor')}
          className={`px-3 py-1 rounded text-sm transition-colors ${
            activeTab === 'editor'
              ? 'bg-blue-600 text-white'
              : 'text-gray-300 hover:bg-gray-700'
          }`}
        >
          Editor
        </button>
        <button
          onClick={() => onTabChange('debug')}
          className={`px-3 py-1 rounded text-sm transition-colors ${
            activeTab === 'debug'
              ? 'bg-blue-600 text-white'
              : 'text-gray-300 hover:bg-gray-700'
          }`}
        >
          Debug
        </button>
      </nav>
    </header>
  );
}