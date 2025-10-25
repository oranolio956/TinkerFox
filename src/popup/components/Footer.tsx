
export function Footer() {
  return (
    <footer className="bg-gray-800 border-t border-gray-700 px-4 py-2 text-xs text-gray-400">
      <div className="flex items-center justify-between">
        <span>ScriptFlow v1.0.0</span>
        <div className="flex space-x-3">
          <button className="hover:text-white transition-colors">Settings</button>
          <button className="hover:text-white transition-colors">Help</button>
        </div>
      </div>
    </footer>
  );
}