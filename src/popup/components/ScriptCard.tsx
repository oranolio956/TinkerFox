import { UserScript } from '../../types';
import { useScriptsStore } from '@/lib/scripts-store';

interface ScriptCardProps {
  script: UserScript;
  onToggle: () => void;
  onDelete: () => void;
  isSelected?: boolean;
}

export function ScriptCard({ script, onToggle, onDelete }: ScriptCardProps) {
  const { selectScript } = useScriptsStore();
  
  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm(`Delete "${script.name}"?`)) {
      onDelete();
    }
  };

  const handleCardClick = () => {
    selectScript(script.id);
  };

  return (
    <div 
      onClick={handleCardClick}
      className="bg-gray-800 border border-gray-700 rounded-lg p-3 hover:bg-gray-750 transition-colors cursor-pointer"
    >
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-white truncate">{script.name}</h3>
          {script.metadata.description && (
            <p className="text-sm text-gray-400 mt-1 line-clamp-2">
              {script.metadata.description}
            </p>
          )}
        </div>
        
        <div className="flex items-center space-x-2 ml-2">
          <button
            onClick={onToggle}
            className={`w-8 h-4 rounded-full transition-colors ${
              script.enabled ? 'bg-blue-600' : 'bg-gray-600'
            }`}
          >
            <div
              className={`w-3 h-3 bg-white rounded-full transition-transform ${
                script.enabled ? 'translate-x-4' : 'translate-x-0.5'
              }`}
            />
          </button>
          
          <button
            onClick={handleDelete}
            className="text-gray-400 hover:text-red-400 transition-colors"
            title="Delete script"
          >
            🗑️
          </button>
        </div>
      </div>
      
      <div className="flex items-center justify-between text-xs text-gray-500">
        <div className="flex items-center space-x-3">
          <span>v{script.version}</span>
          {script.metadata.author && (
            <span>by {script.metadata.author}</span>
          )}
        </div>
        
        <div className="flex items-center space-x-2">
          {script.runCount > 0 && (
            <span>{script.runCount} runs</span>
          )}
          {script.lastRunAt && (
            <span>
              {new Date(script.lastRunAt).toLocaleDateString()}
            </span>
          )}
        </div>
      </div>
      
      {/* Match patterns */}
      {script.metadata.match.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {script.metadata.match.slice(0, 2).map((pattern, index) => (
            <span
              key={index}
              className="px-2 py-1 bg-gray-700 text-xs rounded"
            >
              {pattern}
            </span>
          ))}
          {script.metadata.match.length > 2 && (
            <span className="px-2 py-1 bg-gray-700 text-xs rounded">
              +{script.metadata.match.length - 2} more
            </span>
          )}
        </div>
      )}
    </div>
  );
}