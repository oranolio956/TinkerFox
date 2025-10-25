import { useState, useEffect, useRef } from 'react';
import Editor from '@monaco-editor/react';
import { useScriptsStore } from '@/lib/scripts-store';

export function ScriptEditor() {
  const { selectedScript, updateScript } = useScriptsStore();
  const [code, setCode] = useState('');
  const [hasChanges, setHasChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [monacoError, setMonacoError] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const saveTimeoutRef = useRef<number>();

  // Update code when selected script changes
  useEffect(() => {
    if (selectedScript) {
      setCode(selectedScript.code);
      setHasChanges(false);
    } else {
      setCode('');
      setHasChanges(false);
    }
  }, [selectedScript?.id]);

  // Auto-save functionality
  useEffect(() => {
    if (!hasChanges || !selectedScript) return;

    // Clear existing timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    // Set new timeout
    saveTimeoutRef.current = window.setTimeout(async () => {
      if (selectedScript) {
        setIsSaving(true);
        try {
          await updateScript(selectedScript.id, code, 'Auto-save');
          setHasChanges(false);
        } catch (error) {
          console.error('Failed to save script:', error);
        } finally {
          setIsSaving(false);
        }
      }
    }, 2000); // Auto-save after 2 seconds of inactivity

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [code, hasChanges, selectedScript, updateScript]);

  // Manual save with Ctrl+S
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        if (selectedScript && hasChanges) {
          handleSave();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedScript, hasChanges]);

  const handleSave = async () => {
    if (!selectedScript || !hasChanges) return;

    setIsSaving(true);
    try {
      await updateScript(selectedScript.id, code, 'Manual save');
      setHasChanges(false);
    } catch (error) {
      console.error('Failed to save script:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCodeChange = (value: string | undefined) => {
    setCode(value || '');
    setHasChanges(true);
  };

  const handleMonacoError = () => {
    console.warn('Monaco Editor failed to load, falling back to textarea');
    setMonacoError(true);
  };

  if (!selectedScript) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-gray-400">
        <div className="text-center">
          <div className="text-4xl mb-4">📝</div>
          <h3 className="text-lg font-medium mb-2">No Script Selected</h3>
          <p className="text-sm">Select a script from the list to start editing</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Editor Header */}
      <div className="bg-gray-800 border-b border-gray-700 px-4 py-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-medium text-white">{selectedScript.name}</h2>
            <p className="text-sm text-gray-400">
              v{selectedScript.version} • {selectedScript.metadata.author || 'Unknown author'}
            </p>
          </div>
          
          <div className="flex items-center space-x-2">
            {hasChanges && (
              <span className="text-sm text-yellow-400">Unsaved changes</span>
            )}
            {isSaving && (
              <span className="text-sm text-blue-400">Saving...</span>
            )}
            <button
              onClick={handleSave}
              disabled={!hasChanges || isSaving}
              className="px-3 py-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded text-sm transition-colors"
            >
              Save (⌘S)
            </button>
          </div>
        </div>
      </div>

      {/* Code Editor */}
      <div className="flex-1">
        {monacoError ? (
          <textarea
            ref={textareaRef}
            value={code}
            onChange={(e) => handleCodeChange(e.target.value)}
            className="w-full h-full bg-gray-900 text-white p-4 font-mono text-sm resize-none border-none outline-none"
            placeholder="// Start typing your script here..."
            style={{ fontFamily: 'Fira Code, JetBrains Mono, Consolas, monospace' }}
          />
        ) : (
          <Editor
            height="100%"
            language="javascript"
            theme="vs-dark"
            value={code}
            onChange={handleCodeChange}
            onMountError={handleMonacoError}
            options={{
              fontSize: 13,
              fontFamily: 'Fira Code, JetBrains Mono, Consolas, monospace',
              minimap: { enabled: true },
              lineNumbers: 'on',
              rulers: [80, 120],
              wordWrap: 'on',
              formatOnType: true,
              formatOnPaste: true,
              tabSize: 2,
              insertSpaces: true,
              scrollBeyondLastLine: false,
              smoothScrolling: true,
              cursorBlinking: 'smooth',
              cursorSmoothCaretAnimation: 'on',
              automaticLayout: true,
              suggest: {
                showKeywords: true,
                showSnippets: true,
              },
              quickSuggestions: {
                other: true,
                comments: false,
                strings: true,
              },
            }}
          />
        )}
      </div>

      {/* Editor Footer */}
      <div className="bg-gray-800 border-t border-gray-700 px-4 py-2 text-xs text-gray-400">
        <div className="flex items-center justify-between">
          <span>
            {code.split('\n').length} lines • {code.length} characters
          </span>
          <span>
            {selectedScript.metadata.match.length} match patterns
          </span>
        </div>
      </div>
    </div>
  );
}