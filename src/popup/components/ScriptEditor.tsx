import { useEffect, useRef, useState } from 'react';
import Editor, { Monaco } from '@monaco-editor/react';
import { useScriptsStore } from '@/lib/scripts-store';
import * as monaco from 'monaco-editor';

export function ScriptEditor() {
  const { selectedScript, updateScript } = useScriptsStore();
  const [code, setCode] = useState(selectedScript?.code || '');
  const [hasChanges, setHasChanges] = useState(false);
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  
  // Auto-save timer
  const saveTimerRef = useRef<number>();
  
  useEffect(() => {
    if (selectedScript) {
      setCode(selectedScript.code);
      setHasChanges(false);
    }
  }, [selectedScript?.id]);
  
  // Auto-save every 2 seconds
  useEffect(() => {
    if (!hasChanges || !selectedScript) return;
    
    clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async () => {
      await updateScript(selectedScript.id, code);
      setHasChanges(false);
    }, 2000);
    
    return () => clearTimeout(saveTimerRef.current);
  }, [code, hasChanges]);
  
  // Manual save shortcut (Cmd+S)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        if (selectedScript) {
          updateScript(selectedScript.id, code);
          setHasChanges(false);
        }
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [code, selectedScript]);
  
  // Configure Monaco on mount
  function handleEditorMount(editor: monaco.editor.IStandaloneCodeEditor, monacoInstance: Monaco) {
    editorRef.current = editor;
    
    // Custom userscript language support
    monacoInstance.languages.register({ id: 'userscript' });
    
    // Syntax highlighting for metadata
    monacoInstance.languages.setMonarchTokensProvider('userscript', {
      tokenizer: {
        root: [
          [/\/\/ ==UserScript==/, 'comment.metadata'],
          [/\/\/ @\w+/, 'keyword.metadata'],
          [/\/\/ ==\/UserScript==/, 'comment.metadata'],
          [/\/\/.*$/, 'comment'],
        ],
      },
    });
    
    // Auto-complete for metadata
    monacoInstance.languages.registerCompletionItemProvider('userscript', {
      provideCompletionItems: (model, position) => {
        const word = model.getWordUntilPosition(position);
        const range = {
          startLineNumber: position.lineNumber,
          endLineNumber: position.lineNumber,
          startColumn: word.startColumn,
          endColumn: word.endColumn,
        };
        
        const suggestions = [
          {
            label: '@name',
            kind: monacoInstance.languages.CompletionItemKind.Keyword,
            insertText: '@name ${1:Script Name}',
            insertTextRules: monacoInstance.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            range,
          },
          {
            label: '@match',
            kind: monacoInstance.languages.CompletionItemKind.Keyword,
            insertText: '@match ${1:*://*/*}',
            insertTextRules: monacoInstance.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            range,
          },
          {
            label: '@grant',
            kind: monacoInstance.languages.CompletionItemKind.Keyword,
            insertText: '@grant ${1:GM_getValue}',
            insertTextRules: monacoInstance.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            range,
          },
          {
            label: '@version',
            kind: monacoInstance.languages.CompletionItemKind.Keyword,
            insertText: '@version ${1:1.0.0}',
            insertTextRules: monacoInstance.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            range,
          },
        ];
        
        return { suggestions };
      },
    });
    
    // Format on paste
    editor.onDidPaste(() => {
      editor.getAction('editor.action.formatDocument')?.run();
    });
  }
  
  if (!selectedScript) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500">
        <div className="text-center">
          <p className="text-xl mb-2">No script selected</p>
          <p className="text-sm">Select a script from the list or create a new one</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="h-full flex flex-col">
      {/* Editor Header */}
      <div className="bg-gray-800 border-b border-gray-700 px-6 py-4 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">{selectedScript.name}</h2>
          <p className="text-sm text-gray-400">
            v{selectedScript.version} • Last updated {new Date(selectedScript.updatedAt).toLocaleDateString()}
          </p>
        </div>
        
        <div className="flex items-center gap-4">
          {hasChanges && (
            <span className="text-sm text-yellow-500">Unsaved changes</span>
          )}
          
          <button
            onClick={() => updateScript(selectedScript.id, code)}
            className="px-4 py-2 bg-blue-500 rounded-lg hover:bg-blue-600 transition-colors text-white"
          >
            Save (⌘S)
          </button>
        </div>
      </div>
      
      {/* Monaco Editor */}
      <div className="flex-1">
        <Editor
          height="100%"
          language="javascript"
          theme="vs-dark"
          value={code}
          onChange={(value) => {
            setCode(value || '');
            setHasChanges(true);
          }}
          onMount={handleEditorMount}
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
          }}
        />
      </div>
    </div>
  );
}