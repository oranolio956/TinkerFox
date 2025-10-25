# ScriptFlow

**Modern AI-augmented replacement for Tampermonkey**

ScriptFlow is a next-generation Chrome extension that provides advanced userscript management with intelligent features, built from the ground up for Manifest V3 compatibility.

## 🚀 Features

- **Modern Architecture**: Built with Manifest V3, TypeScript, and React
- **Advanced Script Management**: Create, edit, and manage userscripts with ease
- **Monaco Editor Integration**: Professional code editing with syntax highlighting
- **AI-Powered Features**: Intelligent script generation and optimization (coming soon)
- **Comprehensive Dashboard**: Full-featured options page for advanced management
- **Security First**: Sandboxed execution and CSP compliance
- **Developer Friendly**: TypeScript throughout, modern tooling, and extensible architecture

## 📁 Project Structure

```
ScriptFlow/
├── manifest.json                 # Chrome extension manifest (MV3)
├── package.json                  # Dependencies and scripts
├── tsconfig.json                 # TypeScript configuration
├── vite.config.ts               # Vite build configuration
├── src/
│   ├── background/
│   │   └── service_worker.ts    # Background service worker
│   ├── popup/
│   │   ├── index.html           # Popup HTML
│   │   ├── main.tsx             # Popup entry point
│   │   ├── App.tsx              # Main popup component
│   │   ├── components/          # Popup UI components
│   │   ├── hooks/               # React hooks for state management
│   │   └── styles/              # Popup styles
│   ├── options/
│   │   ├── index.html           # Options page HTML
│   │   ├── main.tsx             # Options entry point
│   │   ├── OptionsApp.tsx       # Main options component
│   │   ├── components/          # Options UI components
│   │   ├── pages/               # Options page components
│   │   └── styles/              # Options styles
│   ├── content/
│   │   └── scripts/
│   │       └── content.ts       # Content script
│   ├── lib/                     # Core library modules
│   │   ├── script-manager.ts    # Script management logic
│   │   ├── storage-manager.ts   # Storage operations
│   │   ├── tab-manager.ts       # Tab state management
│   │   └── message-handler.ts   # Inter-component communication
│   └── types/
│       └── index.ts             # TypeScript type definitions
├── public/
│   └── icons/                   # Extension icons
└── dist/                        # Built extension (generated)
```

## 🛠️ Development Setup

### Prerequisites

- Node.js 18+ 
- npm or yarn
- Chrome browser for testing

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd scriptflow
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Build the extension**
   ```bash
   npm run build
   ```

4. **Load in Chrome**
   - Open Chrome and navigate to `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked"
   - Select the `dist` folder

### Development Commands

```bash
# Start development server with hot reload
npm run dev

# Build for production
npm run build

# Type checking
npm run type-check

# Linting
npm run lint

# Fix linting issues
npm run lint:fix
```

## 🏗️ Architecture

### Manifest V3 Compliance

ScriptFlow is built with Manifest V3 from the ground up, ensuring:

- **Service Worker**: Background script runs as a service worker
- **Host Permissions**: Properly scoped permissions for security
- **Content Security Policy**: Strict CSP compliance
- **Modern APIs**: Uses only MV3-compatible Chrome APIs

### Core Components

#### Background Service Worker (`src/background/service_worker.ts`)
- Extension lifecycle management
- Tab monitoring and script injection
- Message handling between components
- Context menu management
- Alarm scheduling for timed scripts

#### Script Manager (`src/lib/script-manager.ts`)
- Script CRUD operations
- Execution management with proper error handling
- URL pattern matching
- Script validation and security checks

#### Storage Manager (`src/lib/storage-manager.ts`)
- Chrome storage API abstraction
- Data migration between versions
- Type-safe storage operations
- Quota management

#### Tab Manager (`src/lib/tab-manager.ts`)
- Tab state tracking
- ScriptFlow enable/disable per tab
- Tab lifecycle management

#### Message Handler (`src/lib/message-handler.ts`)
- Inter-component communication
- API request/response handling
- Error handling and logging

### UI Components

#### Popup Interface
- **React-based**: Modern component architecture
- **Monaco Editor**: Professional code editing
- **Zustand**: Lightweight state management
- **Responsive Design**: Works on different screen sizes

#### Options Dashboard
- **Full-featured**: Comprehensive management interface
- **Statistics**: Script execution metrics
- **Settings**: Detailed configuration options
- **Import/Export**: Script management utilities

## 🔧 Configuration

### Extension Settings

ScriptFlow provides extensive configuration options:

- **General**: Auto-inject, notifications, logging
- **Execution**: Concurrency limits, timeouts, CSP
- **UI**: Theme, popup size, execution time display
- **Security**: Eval permissions, sandbox mode
- **AI**: Provider settings, API keys (future)

### Script Configuration

Each script supports:

- **Metadata**: Name, description, version, author
- **Execution**: Run timing, world context, URL matching
- **Security**: CSP compliance, sandboxing
- **AI Features**: Generation prompts, confidence scores

## 🚀 Usage

### Creating Scripts

1. **Via Popup**: Click the extension icon and "New Script"
2. **Via Dashboard**: Use the full-featured options page
3. **Import**: Load existing userscripts from other managers

### Script Execution

- **Automatic**: Scripts run on matching pages
- **Manual**: Execute via popup or context menu
- **Scheduled**: Time-based execution (future)
- **Conditional**: AI-powered conditional execution (future)

### Management

- **Enable/Disable**: Toggle scripts on/off
- **Edit**: Full Monaco editor integration
- **Delete**: Safe removal with confirmation
- **Export**: Backup and sharing capabilities

## 🔒 Security

ScriptFlow prioritizes security:

- **Sandboxed Execution**: Scripts run in isolated contexts
- **CSP Compliance**: Content Security Policy enforcement
- **Permission Scoping**: Minimal required permissions
- **Input Validation**: All user inputs are validated
- **Error Handling**: Comprehensive error catching and logging

## 🧪 Testing

### Manual Testing

1. Load the extension in Chrome
2. Create a test script
3. Navigate to a matching URL
4. Verify script execution
5. Check popup and options functionality

### Automated Testing

```bash
# Run type checking
npm run type-check

# Run linting
npm run lint

# Build verification
npm run build
```

## 📦 Building

### Development Build

```bash
npm run dev
```

### Production Build

```bash
npm run build
```

The built extension will be in the `dist` folder, ready for loading in Chrome.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

### Code Style

- TypeScript for all logic
- React functional components with hooks
- Modern ES6+ features
- Comprehensive error handling
- Detailed comments and documentation

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Support

- **Issues**: Report bugs and request features on GitHub
- **Documentation**: Check the code comments and this README
- **Community**: Join discussions in the GitHub discussions

## 🔮 Roadmap

### Phase 1 (Current)
- ✅ Core MV3 architecture
- ✅ Basic script management
- ✅ Monaco editor integration
- ✅ React-based UI

### Phase 2 (Next)
- 🔄 AI script generation
- 🔄 Advanced script scheduling
- 🔄 Import/export functionality
- 🔄 Enhanced security features

### Phase 3 (Future)
- 📋 Script marketplace
- 📋 Collaborative features
- 📋 Advanced analytics
- 📋 Plugin system

---

**Built with ❤️ for the developer community**