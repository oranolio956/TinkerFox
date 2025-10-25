import { useState, useEffect } from 'react';
import { useScriptsStore } from '@/lib/scripts-store';

interface ExecutionLog {
  id: string;
  scriptId: string;
  scriptName: string;
  url: string;
  success: boolean;
  error?: string;
  executionTime: number;
  timestamp: number;
}

export function DebugConsole() {
  const { scripts } = useScriptsStore();
  const [logs, setLogs] = useState<ExecutionLog[]>([]);
  const [filter, setFilter] = useState<string>('all');
  const [isLoading, setIsLoading] = useState(true);

  // Load execution logs
  useEffect(() => {
    loadLogs();
    // Refresh every 2 seconds for real-time updates
    const interval = setInterval(loadLogs, 2000);
    return () => clearInterval(interval);
  }, [filter]);

  const loadLogs = async () => {
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'GET_EXECUTION_LOGS',
        filter: filter !== 'all' ? filter : undefined
      });
      
      const logs = response.logs || [];
      setLogs(logs.sort((a: ExecutionLog, b: ExecutionLog) => b.timestamp - a.timestamp));
      setIsLoading(false);
    } catch (error) {
      console.error('Failed to load logs:', error);
      setLogs([]);
      setIsLoading(false);
    }
  };

  const clearLogs = () => {
    setLogs([]);
  };

  const getStatusIcon = (success: boolean) => {
    return success ? '✅' : '❌';
  };

  const getStatusColor = (success: boolean) => {
    return success ? 'text-green-400' : 'text-red-400';
  };

  const getExecutionTimeColor = (time: number) => {
    if (time < 50) return 'text-green-400';
    if (time < 200) return 'text-yellow-400';
    return 'text-red-400';
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="bg-gray-800 border-b border-gray-700 px-4 py-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Debug Console</h2>
          <div className="flex items-center space-x-3">
            {/* Filter */}
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="bg-gray-700 border border-gray-600 rounded px-3 py-1 text-sm focus:outline-none focus:border-blue-500"
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
              className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-sm transition-colors"
            >
              Clear
            </button>
          </div>
        </div>
      </div>

      {/* Logs */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {logs.length === 0 ? (
          <div className="text-center text-gray-400 py-12">
            <div className="text-4xl mb-4">🐛</div>
            <h3 className="text-lg font-medium mb-2">No Execution Logs</h3>
            <p className="text-sm">Script execution logs will appear here</p>
          </div>
        ) : (
          logs.map(log => (
            <div
              key={log.id}
              className="bg-gray-800 border border-gray-700 rounded-lg p-4"
            >
              {/* Header */}
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center space-x-3">
                  <span className="text-xl">{getStatusIcon(log.success)}</span>
                  <div>
                    <h3 className="font-medium text-white">{log.scriptName}</h3>
                    <p className="text-sm text-gray-400">
                      {new Date(log.timestamp).toLocaleString()}
                    </p>
                  </div>
                </div>
                
                <div className="text-right">
                  <p className={`font-semibold ${getStatusColor(log.success)}`}>
                    {log.success ? 'Success' : 'Failed'}
                  </p>
                  <p className={`text-sm ${getExecutionTimeColor(log.executionTime)}`}>
                    {log.executionTime.toFixed(2)}ms
                  </p>
                </div>
              </div>

              {/* URL */}
              <div className="mb-2">
                <span className="text-xs text-gray-500 font-semibold">URL:</span>
                <span className="text-xs text-blue-400 ml-2 font-mono">
                  {log.url}
                </span>
              </div>

              {/* Error Details */}
              {log.error && (
                <div className="mt-3 bg-red-900 bg-opacity-20 border border-red-700 rounded p-3">
                  <p className="text-red-400 font-semibold text-xs mb-1">Error:</p>
                  <pre className="text-xs text-red-300 whitespace-pre-wrap font-mono">
                    {log.error}
                  </pre>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}