import { useState, useEffect } from 'react';
import { db } from '@/lib/database';
import { ScriptExecution } from '@/types';
import { useScriptsStore } from '@/lib/scripts-store';

export function DebugConsole() {
  const [executions, setExecutions] = useState<ScriptExecution[]>([]);
  const [filter, setFilter] = useState<string>('all');
  const { scripts } = useScriptsStore();
  
  useEffect(() => {
    loadExecutions();
    
    // Refresh every 2 seconds (live updates)
    const interval = setInterval(loadExecutions, 2000);
    return () => clearInterval(interval);
  }, [filter]);
  
  async function loadExecutions() {
    let logs = await db.executions
      .orderBy('timestamp')
      .reverse()
      .limit(100)
      .toArray();
    
    if (filter !== 'all') {
      logs = logs.filter(e => e.scriptId === filter);
    }
    
    setExecutions(logs);
  }
  
  async function clearLogs() {
    await db.executions.clear();
    setExecutions([]);
  }
  
  return (
    <div className="h-full flex flex-col bg-gray-900">
      {/* Header */}
      <div className="bg-gray-800 border-b border-gray-700 px-6 py-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-white">Debug Console</h2>
        
        <div className="flex items-center gap-4">
          {/* Filter */}
          <select
            value={filter}
            onChange={e => setFilter(e.target.value)}
            className="bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white"
          >
            <option value="all">All Scripts</option>
            {scripts.map(script => (
              <option key={script.id} value={script.id}>
                {script.name}
              </option>
            ))}
          </select>
          
          <button
            onClick={clearLogs}
            className="px-4 py-2 bg-gray-700 rounded-lg hover:bg-gray-600 transition-colors text-sm text-white"
          >
            Clear Logs
          </button>
        </div>
      </div>
      
      {/* Execution Logs */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4 font-mono text-sm">
        {executions.length === 0 ? (
          <div className="text-center text-gray-500 py-12">
            No script executions logged yet
          </div>
        ) : (
          executions.map(execution => (
            <ExecutionLog key={execution.id} execution={execution} />
          ))
        )}
      </div>
    </div>
  );
}

interface ExecutionLogProps {
  execution: ScriptExecution;
}

function ExecutionLog({ execution }: ExecutionLogProps) {
  const [script, setScript] = useState<any>(null);
  
  useEffect(() => {
    db.scripts.get(execution.scriptId).then(setScript);
  }, [execution.scriptId]);
  
  const statusColor = execution.success ? 'text-green-500' : 'text-red-500';
  const statusIcon = execution.success ? '✅' : '❌';
  const executionTimeColor = 
    execution.executionTime < 50 ? 'text-green-500' :
    execution.executionTime < 200 ? 'text-yellow-500' :
    'text-red-500';
  
  return (
    <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
      {/* Header */}
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-3">
          <span className="text-xl">{statusIcon}</span>
          <div>
            <p className="font-semibold text-white">{script?.name || 'Unknown Script'}</p>
            <p className="text-xs text-gray-400">
              {new Date(execution.timestamp).toLocaleString()}
            </p>
          </div>
        </div>
        
        <div className="text-right">
          <p className={`font-semibold ${statusColor}`}>
            {execution.success ? 'Success' : 'Failed'}
          </p>
          <p className={`text-xs ${executionTimeColor}`}>
            {execution.executionTime.toFixed(2)}ms
          </p>
        </div>
      </div>
      
      {/* URL */}
      <div className="mt-2 text-xs text-gray-400">
        <span className="font-semibold">URL:</span>{' '}
        <span className="text-blue-500">{execution.url}</span>
      </div>
      
      {/* Error Details */}
      {execution.error && (
        <div className="mt-3 bg-red-500/10 border border-red-500/30 rounded p-3">
          <p className="text-red-500 font-semibold text-xs mb-1">Error:</p>
          <pre className="text-xs text-red-500 whitespace-pre-wrap">
            {execution.error}
          </pre>
        </div>
      )}
    </div>
  );
}