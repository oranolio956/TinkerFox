import { useState, useEffect } from 'react';
import { useScriptsStore } from '@/lib/scripts-store';
import { ScriptList } from './ScriptList';
import { ScriptEditor } from './ScriptEditor';
import { CommandPalette } from './CommandPalette';
import { DebugConsole } from './DebugConsole';
import { Header } from './Header';
import { Footer } from './Footer';

export function Popup() {
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const { loadScripts, loading, activeTab, setActiveTab } = useScriptsStore();

  useEffect(() => {
    loadScripts();
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setShowCommandPalette(true);
      }
      if (e.key === 'Escape') {
        setShowCommandPalette(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  if (loading) {
    return (
      <div className="w-96 h-96 bg-gray-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
      </div>
    );
  }

  return (
    <div className="w-full h-full bg-gray-900 text-white flex flex-col">
      <Header 
        activeTab={activeTab} 
        onTabChange={setActiveTab}
        onCommandPalette={() => setShowCommandPalette(true)}
      />
      
      <main className="flex-1 overflow-hidden">
        {activeTab === 'scripts' && <ScriptList />}
        {activeTab === 'editor' && <ScriptEditor />}
        {activeTab === 'debug' && <DebugConsole />}
      </main>
      
      <Footer />
      
      {showCommandPalette && (
        <CommandPalette onClose={() => setShowCommandPalette(false)} />
      )}
    </div>
  );
}