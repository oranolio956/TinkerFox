import { useEffect, useState } from 'react';
import { useScriptsStore } from '@/lib/scripts-store';
import { ScriptList } from './components/ScriptList';
import { ScriptEditor } from './components/ScriptEditor';
import { DebugConsole } from './components/DebugConsole';
import { CommandPalette } from './components/CommandPalette';

export function App() {
  const [view, setView] = useState<'scripts' | 'editor' | 'debug'>('scripts');
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const { loadScripts, loading } = useScriptsStore();
  
  useEffect(() => {
    loadScripts();
    
    // Keyboard shortcut for command palette
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setCommandPaletteOpen(true);
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);
  
  return (
    <div className="flex h-screen bg-gray-900 text-white">
      {/* Left Sidebar */}
      <aside className="w-64 bg-gray-800 border-r border-gray-700 flex flex-col">
        {/* Logo */}
        <div className="p-6 border-b border-gray-700">
          <h1 className="text-2xl font-bold text-blue-500">ScriptFlow</h1>
        </div>
        
        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-2">
          <NavItem
            icon="📜"
            label="Scripts"
            active={view === 'scripts'}
            onClick={() => setView('scripts')}
            shortcut="⌘1"
          />
          
          <NavItem
            icon="✏️"
            label="Editor"
            active={view === 'editor'}
            onClick={() => setView('editor')}
            shortcut="⌘2"
          />
          
          <NavItem
            icon="🐛"
            label="Debug"
            active={view === 'debug'}
            onClick={() => setView('debug')}
            shortcut="⌘3"
          />
        </nav>
        
        {/* Command Palette Button */}
        <div className="p-4 border-t border-gray-700">
          <button
            onClick={() => setCommandPaletteOpen(true)}
            className="w-full flex items-center justify-between px-4 py-3 bg-gray-700 rounded-lg hover:bg-gray-600 transition-colors"
          >
            <div className="flex items-center gap-3">
              <span className="text-xl">⌘</span>
              <span>Command Palette</span>
            </div>
            <span className="text-xs text-gray-500">⌘K</span>
          </button>
        </div>
      </aside>
      
      {/* Main Content Area */}
      <main className="flex-1 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500" />
          </div>
        ) : (
          <>
            {view === 'scripts' && <ScriptList />}
            {view === 'editor' && <ScriptEditor />}
            {view === 'debug' && <DebugConsole />}
          </>
        )}
      </main>
      
      {/* Command Palette Overlay */}
      {commandPaletteOpen && (
        <CommandPalette onClose={() => setCommandPaletteOpen(false)} />
      )}
    </div>
  );
}

interface NavItemProps {
  icon: string;
  label: string;
  active: boolean;
  onClick: () => void;
  shortcut?: string;
}

function NavItem({ icon, label, active, onClick, shortcut }: NavItemProps) {
  return (
    <button
      onClick={onClick}
      className={`
        w-full flex items-center justify-between px-4 py-3 rounded-lg
        transition-all duration-200
        ${active 
          ? 'bg-blue-500/20 text-blue-500 font-semibold' 
          : 'text-gray-300 hover:bg-gray-700 hover:text-white'
        }
      `}
    >
      <div className="flex items-center gap-3">
        <span className="text-xl">{icon}</span>
        <span>{label}</span>
      </div>
      
      {shortcut && (
        <span className="text-xs text-gray-500">{shortcut}</span>
      )}
    </button>
  );
}