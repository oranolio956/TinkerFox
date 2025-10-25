import React, { useState, useRef } from 'react';
import { TampermonkeyImporter } from '@/lib/importer';

interface ImportDialogProps {
  onClose: () => void;
  onSuccess: () => void;
}

export function ImportDialog({ onClose, onSuccess }: ImportDialogProps) {
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ success: number; failed: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setImporting(true);
    setResult(null);
    
    try {
      let importResult;
      
      if (file.name.endsWith('.zip')) {
        importResult = await TampermonkeyImporter.importFromZip(file);
      } else if (file.name.endsWith('.json')) {
        const text = await file.text();
        importResult = await TampermonkeyImporter.importFromJSON(text);
      } else {
        throw new Error('Unsupported file format. Please use .zip or .json');
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
  }
  
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-xl p-8 w-[500px] border border-gray-700">
        <h2 className="text-2xl font-bold mb-4 text-white">Import Scripts</h2>
        
        <p className="text-gray-400 mb-6">
          Import your scripts from Tampermonkey, Violentmonkey, or Greasemonkey.
          Supports .zip and .json backup files.
        </p>
        
        {/* Upload Area */}
        <div
          onClick={() => fileInputRef.current?.click()}
          className="border-2 border-dashed border-gray-600 rounded-lg p-12 text-center cursor-pointer hover:border-blue-500 transition-colors"
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".zip,.json"
            onChange={handleFileSelect}
            className="hidden"
          />
          
          {importing ? (
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto" />
          ) : (
            <>
              <p className="text-xl mb-2">📥</p>
              <p className="text-gray-300 font-semibold">Click to select file</p>
              <p className="text-sm text-gray-500 mt-2">.zip or .json</p>
            </>
          )}
        </div>
        
        {/* Results */}
        {result && (
          <div className="mt-6 bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
            <p className="text-green-500 font-semibold text-lg mb-2">
              🎉 Import Complete!
            </p>
            <p className="text-gray-300">
              Imported <span className="font-bold text-blue-500">{result.success}</span> scripts
            </p>
            {result.failed > 0 && (
              <p className="text-yellow-500 mt-1">
                {result.failed} scripts failed to import
              </p>
            )}
          </div>
        )}
        
        {/* Actions */}
        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-700 rounded-lg hover:bg-gray-600 transition-colors text-white"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// Confetti animation for successful import
function confetti() {
  // Simple confetti using CSS animations
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