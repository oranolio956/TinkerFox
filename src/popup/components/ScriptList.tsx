// import React from 'react';
import { useScriptsStore } from '@/lib/scripts-store';
import { UserScript } from '@/types';

export function ScriptList() {
  const { scripts, loading } = useScriptsStore();
  
  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500" />
      </div>
    );
  }
  
  return (
    <div className="h-full flex flex-col bg-gray-900">
      {/* Header */}
      <div className="bg-gray-800 border-b border-gray-700 px-6 py-4">
        <h2 className="text-lg font-semibold text-white">Your Scripts</h2>
        <p className="text-sm text-gray-400">{scripts.length} scripts installed</p>
      </div>
      
      {/* Script List */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {scripts.length === 0 ? (
          <div className="text-center text-gray-500 py-12">
            <p className="text-xl mb-2">No scripts yet</p>
            <p className="text-sm">Create your first script or import from Tampermonkey</p>
          </div>
        ) : (
          scripts.map(script => (
            <ScriptCard key={script.id} script={script} />
          ))
        )}
      </div>
    </div>
  );
}

interface ScriptCardProps {
  script: UserScript;
}

function ScriptCard({ script }: ScriptCardProps) {
  const { selectScript, toggleScript, deleteScript } = useScriptsStore();
  
  return (
    <div className="bg-gray-800 rounded-lg p-4 border border-gray-700 hover:border-gray-600 transition-colors">
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <button
            onClick={() => toggleScript(script.id)}
            className={`w-4 h-4 rounded-full border-2 transition-colors ${
              script.enabled 
                ? 'bg-green-500 border-green-500' 
                : 'border-gray-500'
            }`}
          />
          <div>
            <h3 className="font-semibold text-white">{script.name}</h3>
            <p className="text-sm text-gray-400">v{script.version}</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={() => selectScript(script.id)}
            className="px-3 py-1 bg-blue-500 rounded text-sm hover:bg-blue-600 transition-colors text-white"
          >
            Edit
          </button>
          <button
            onClick={() => deleteScript(script.id)}
            className="px-3 py-1 bg-red-500 rounded text-sm hover:bg-red-600 transition-colors text-white"
          >
            Delete
          </button>
        </div>
      </div>
      
      {/* Description */}
      {script.metadata.description && (
        <p className="text-sm text-gray-300 mb-3">{script.metadata.description}</p>
      )}
      
      {/* Metadata */}
      <div className="flex flex-wrap gap-2 text-xs">
        {script.metadata.match.slice(0, 2).map((pattern, idx) => (
          <span key={idx} className="bg-gray-700 px-2 py-1 rounded text-gray-300">
            {pattern}
          </span>
        ))}
        {script.metadata.match.length > 2 && (
          <span className="bg-gray-700 px-2 py-1 rounded text-gray-300">
            +{script.metadata.match.length - 2} more
          </span>
        )}
      </div>
      
      {/* Stats */}
      <div className="flex items-center gap-4 mt-3 text-xs text-gray-400">
        <span>Runs: {script.runCount}</span>
        {script.lastRunAt && (
          <span>Last run: {new Date(script.lastRunAt).toLocaleDateString()}</span>
        )}
      </div>
    </div>
  );
}