import React, { useState, useRef } from 'react';
import { useScriptsStore } from '../hooks/useScriptsStore';

interface ImportDialogProps {
  onClose: () => void;
  onSuccess: () => void;
}

export function ImportDialog({ onClose, onSuccess }: ImportDialogProps) {
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ success: number; failed: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { createScript } = useScriptsStore();

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    setResult(null);

    try {
      let importResult = { success: 0, failed: 0 };

      if (file.name.endsWith('.json')) {
        const text = await file.text();
        const data = JSON.parse(text);
        
        // Handle Tampermonkey JSON format
        if (Array.isArray(data)) {
          for (const item of data) {
            try {
              const code = item.code || item.source || '';
              if (code) {
                await createScript(code);
                importResult.success++;
              }
            } catch (error) {
              console.error('Failed to import script:', error);
              importResult.failed++;
            }
          }
        }
      } else if (file.name.endsWith('.user.js')) {
        // Handle single userscript file
        const text = await file.text();
        await createScript(text);
        importResult.success = 1;
      } else {
        throw new Error('Unsupported file format. Please use .json or .user.js files.');
      }

      setResult(importResult);
      
      if (importResult.success > 0) {
        // Celebration animation
        confetti();
        onSuccess();
      }
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Import failed');
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-lg p-6 w-96 border border-gray-700">
        <h2 className="text-xl font-bold mb-4">Import Scripts</h2>
        <p className="text-gray-400 mb-6">
          Import your scripts from Tampermonkey, Violentmonkey, or Greasemonkey.
          Supports .json backup files and .user.js files.
        </p>

        {/* Upload Area */}
        <div
          onClick={() => fileInputRef.current?.click()}
          className="border-2 border-dashed border-gray-600 rounded-lg p-8 text-center cursor-pointer hover:border-blue-500 transition-colors"
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,.user.js"
            onChange={handleFileSelect}
            className="hidden"
          />
          
          {importing ? (
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto" />
          ) : (
            <>
              <div className="text-4xl mb-2">📥</div>
              <p className="text-gray-300 font-semibold">Click to select file</p>
              <p className="text-sm text-gray-500 mt-2">.json or .user.js</p>
            </>
          )}
        </div>

        {/* Results */}
        {result && (
          <div className="mt-6 bg-blue-900 bg-opacity-20 border border-blue-700 rounded-lg p-4">
            <p className="text-green-400 font-semibold text-lg mb-2">
              🎉 Import Complete!
            </p>
            <p className="text-gray-300">
              Imported <span className="font-bold text-blue-400">{result.success}</span> scripts
            </p>
            {result.failed > 0 && (
              <p className="text-yellow-400 mt-1">
                {result.failed} scripts failed to import
              </p>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="mt-6 flex justify-end space-x-3">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// Simple confetti animation
function confetti() {
  for (let i = 0; i < 50; i++) {
    const confetti = document.createElement('div');
    confetti.className = 'confetti';
    confetti.style.left = Math.random() * 100 + '%';
    confetti.style.animationDelay = Math.random() * 3 + 's';
    confetti.style.backgroundColor = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444'][Math.floor(Math.random() * 4)];
    document.body.appendChild(confetti);
    setTimeout(() => confetti.remove(), 3000);
  }
}