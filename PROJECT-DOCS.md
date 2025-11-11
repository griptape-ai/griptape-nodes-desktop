# Griptape Nodes Desktop

Note that this document is intended for developers that want understand the Griptape Nodes Desktop project with a view to contributing to it.

If you are a user, or potential user of Griptape Nodes Desktop, please take a look at the [README](./README.md) instead.

A cross-platform desktop application for managing and developing AI workflows with the [Griptape](https://www.griptape.ai/) framework. This application provides a local development environment for building, testing, and managing Griptape Nodes workflows with an integrated visual editor.

[![License: Apache 2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![Electron](https://img.shields.io/badge/Electron-37.3.1-47848F?logo=electron)](https://www.electronjs.org/)
[![React](https://img.shields.io/badge/React-19.1.1-61DAFB?logo=react)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9.2-3178C6?logo=typescript)](https://www.typescriptlang.org/)

## Table of Contents

- [Features](#features)
- [Architecture](#architecture)
- [Installation](#installation)
- [Development](#development)
- [Building](#building)
- [Core Services](#core-services)
- [User Interface](#user-interface)
- [Configuration](#configuration)
- [Security](#security)
- [Troubleshooting](#troubleshooting)
- [Contributing](#contributing)
- [License](#license)

## Features

### Core Functionality

- ✅ **One-Click Setup**: Automated installation of Python, UV, and Griptape Nodes Engine
- ✅ **Onboarding Wizard**: Guided first-time setup with credential storage options
- ✅ **Engine Management**: Start, stop, and restart the Griptape Nodes engine with real-time logs
- ✅ **Visual Editor**: Integrated Griptape Nodes web editor running in an embedded webview
- ✅ **Workspace Management**: Configure and manage workflow workspace directories
- ✅ **Authentication**: Secure OAuth 2.0 flow with Griptape Cloud (optional API key bypass for development)
- ✅ **Theme Support**: Dark and light mode with system preference detection
- ✅ **Cross-Platform**: Native support for macOS, Windows, and Linux

### Advanced Features

- **Library Management**: Automatic synchronization and registration of Griptape Nodes libraries with optional installation during onboarding
- **Engine Channel Switching**: Switch between stable and nightly engine builds directly from settings
- **Automatic Token Refresh**: Prevents expired authentication tokens in the editor with automatic background refresh
- **Update Channels**: Support for stable, beta, and custom release channels
- **Log Visualization**: ANSI color support and clickable URLs in engine logs with Copy Logs button
- **Context Menu Support**: Right-click context menu in editor webview for copy/paste/save operations
- **Environment Diagnostics**: Collect and persist environment information for troubleshooting
- **Engine Reinstallation**: Troubleshooting tools to reconfigure or reinstall engine components
- **Build Metadata Injection**: Git commit information injected at build time
- **System Monitor**: Real-time CPU and memory usage monitoring with graphical display
- **Auto-Update Engine**: Automatic GTN engine updates on application startup
- **Usage Metrics**: Anonymous usage reporting for product improvement
- **Device ID Management**: Unique device identification for tracking and support
- **Persistent WebView State**: Editor localStorage persists across app restarts

## Architecture

### Technology Stack

**Frontend**
- React 19.1.1 with TypeScript
- Tailwind CSS + tailwindcss-animate for styling
- React Context API for state management
- Radix UI components (Tooltip)
- Lucide React for icons

**Desktop Framework**
- Electron 37.3.1 with Electron Forge
- Webpack 5 for building and bundling
- Native module support with auto-unpack

**Backend Services**
- Express.js for local OAuth server
- electron-store for persistent configuration
- electron-log for structured logging
- Velopack for automatic updates

**Python Management**
- UV package manager for dependency management
- Standalone Python distribution (3.12.7)
- Griptape Nodes CLI integration

### Application Structure

```
griptape-nodes-desktop/
├── src/
│   ├── main/                       # Electron main process
│   │   ├── index.ts               # Application entry point, service initialization
│   │   └── utils/                 # Main process utilities (logger, packaged detection)
│   ├── preload/                   # IPC bridge scripts
│   │   ├── index.ts               # Main window preload
│   │   └── webview-preload.ts     # Editor webview preload
│   ├── renderer/                  # React application
│   │   ├── components/            # React components
│   │   │   ├── App.tsx            # Root component with auth flow
│   │   │   ├── MainApp.tsx        # Main app layout with sidebar
│   │   │   ├── LoginPage.tsx      # OAuth login page
│   │   │   ├── EditorWebview.tsx  # Embedded Griptape Nodes editor
│   │   │   ├── Sidebar.tsx        # Navigation sidebar
│   │   │   ├── onboarding/        # First-time setup wizard
│   │   │   └── ...                # Additional UI components
│   │   ├── pages/                 # Main application pages
│   │   │   ├── Dashboard.tsx      # Overview and quick actions
│   │   │   ├── Engine.tsx         # Engine management and logs
│   │   │   ├── Editor.tsx         # Editor page container
│   │   │   └── Settings.tsx       # Configuration settings
│   │   ├── contexts/              # React contexts
│   │   │   ├── AuthContext.tsx    # Authentication state
│   │   │   ├── EngineContext.tsx  # Engine status
│   │   │   └── ThemeContext.tsx   # Theme preferences
│   │   └── utils/                 # Utility functions
│   ├── common/                    # Shared code (main + renderer)
│   │   ├── services/              # Business logic services
│   │   │   ├── auth/              # Authentication services
│   │   │   │   ├── http/          # HTTP-based OAuth (active)
│   │   │   │   ├── custom/        # Custom URL scheme OAuth (planned)
│   │   │   │   └── stores/        # Credential storage implementations
│   │   │   ├── gtn/               # Griptape Nodes services
│   │   │   │   ├── engine-service.ts    # Engine process management
│   │   │   │   ├── gtn-service.ts       # GTN CLI integration
│   │   │   │   └── install-gtn.ts       # GTN installation
│   │   │   ├── python/            # Python management
│   │   │   ├── uv/                # UV package manager
│   │   │   ├── update/            # Velopack update service
│   │   │   └── ...
│   │   ├── config/                # Configuration utilities
│   │   │   ├── env.ts             # Environment variables
│   │   │   ├── paths.ts           # Path resolution
│   │   │   └── versions.ts        # Version information
│   │   └── child-process/         # Process management utilities
│   └── types/                     # TypeScript type definitions
├── scripts/                       # Build and deployment scripts
│   ├── build-osx.sh              # macOS build script
│   ├── build-linux.sh            # Linux build script
│   ├── build-windows.ps1         # Windows build script
│   └── generate-icons.js         # Icon generation
├── generated/icons/               # Platform-specific icons
├── public/                        # Static assets
└── webpack configs                # Webpack build configuration
```

### Service Architecture

The application uses a service-oriented architecture with EventEmitter-based communication:

```
┌─────────────────────────────────────────┐
│          Electron Main Process          │
├─────────────────────────────────────────┤
│  ┌──────────────────────────────────┐  │
│  │      Service Initialization      │  │
│  │                                  │  │
│  │  1. OnboardingService           │  │
│  │  2. DeviceIdService             │  │
│  │  3. UsageMetricsService         │  │
│  │  4. SettingsService             │  │
│  │  5. SystemMonitorService        │  │
│  │  6. UvService                   │  │
│  │  7. PythonService               │  │
│  │  8. HttpAuthService             │  │
│  │  9. GtnService                  │  │
│  │  10. EngineService              │  │
│  │  11. UpdateService              │  │
│  └──────────────────────────────────┘  │
│                  │                       │
│                  │ Events & IPC          │
│                  ▼                       │
│  ┌──────────────────────────────────┐  │
│  │        Renderer Process          │  │
│  │    (React Application)           │  │
│  └──────────────────────────────────┘  │
└─────────────────────────────────────────┘
```

## Installation

### For End Users

Download the latest version for your platform from [griptapenodes.com](https://griptapenodes.com).

Available for macOS, Windows, and Linux.

### For Developers

The following instructions are for developers who want to build and run the application from source.

#### Prerequisites

- **Node.js 18+** and npm
- **Platform-specific build tools**:
  - macOS: Xcode Command Line Tools
  - Windows: Visual Studio Build Tools
  - Linux: build-essential package

#### Quick Start

```bash
# Clone the repository
git clone https://github.com/griptape-ai/griptape-nodes-desktop.git
cd griptape-nodes-desktop

# Install dependencies
npm install

# Generate icons (macOS only, pre-generated icons available for other platforms)
npm run generate-icons

# Start development server
npm start
```

#### Environment Variables

For development, you can configure these environment variables:

```bash
# Skip OAuth in development (requires valid API key)
export GT_CLOUD_API_KEY=your_api_key_here

# Authentication scheme (http for development, custom for production)
export AUTH_SCHEME=http

# Development mode
export NODE_ENV=development
```

## Development

### Available Scripts

```bash
# Development
npm start                    # Start development server with hot reload
npm run typecheck           # Run TypeScript type checking
npm run lint                # Run ESLint

# Building
npm run package             # Package the application
npm run pack:osx            # Build macOS package
npm run pack:linux          # Build Linux packages (DEB/RPM)
npm run pack:windows        # Build Windows installer
npm run pack:windows:arm64  # Build Windows ARM64 installer

# Publishing
npm run publish:osx         # Publish macOS build
npm run publish:linux       # Publish Linux build
npm run publish:windows     # Publish Windows build

# Utilities
npm run generate-icons      # Generate platform icons (macOS only)
```

### Development Mode Features

- **Hot Module Replacement**: Fast refresh for renderer process changes
- **DevTools**: Automatically opens Chrome DevTools
- **Isolated Data**: Uses `_userdata`, `_documents`, and `_logs` directories in project root
- **Authentication Bypass**: Can skip OAuth with `GT_CLOUD_API_KEY` environment variable
- **Detailed Logging**: Comprehensive logs written to `_logs/main.log`
- **Code Quality Tools**: ESLint and Prettier integrated for consistent code style
- **Type Checking**: Strict TypeScript checking with helpful error messages

### Project Configuration

**TypeScript** (`tsconfig.json`)
- Target: ES6
- Module: CommonJS
- JSX: react-jsx
- Path aliases: `@/*` → `src/*`

**Webpack**
- Main process: `webpack.main.config.ts`
- Renderer process: `webpack.renderer.config.ts`
- Shared rules: `webpack.rules.ts`
- Plugins: `webpack.plugins.ts`

**Electron Forge** (`forge.config.ts`)
- Makers: ZIP (macOS), DEB/RPM (Linux)
- Auto-unpack natives plugin
- Fuses for security configuration

## Building

### Build Process

The build process involves multiple stages:

1. **Build Info Generation**: Extract Git metadata (commit hash, branch, date)
2. **TypeScript Compilation**: Compile all TypeScript with ts-loader
3. **Asset Bundling**: Webpack bundles main, renderer, and preload scripts
4. **Icon Generation**: Create platform-specific icons from source images
5. **Electron Packaging**: Package with Electron Forge (ASAR format)
6. **Code Signing**: Sign macOS builds (CI/CD only)
7. **Installer Creation**: Generate platform installers
8. **Update Packages**: Create Velopack update packages

### Platform-Specific Notes

**macOS**
- Requires macOS for icon generation (.icns format)
- Code signing requires Apple Developer certificate
- DMG created with custom template
- Supports both Intel and Apple Silicon

**Windows**
- PowerShell build script
- Supports x64 and ARM64 architectures
- Custom installer via Velopack
- Code signing with AzureSignTool for EV certificates
- Supports both local signtool and Azure Key Vault signing

**Linux**
- Generates both DEB and RPM packages
- Tested on Ubuntu 18.04+
- AppImage support planned

### CI/CD

The project is configured for GitHub Actions with:
- Automated builds on push
- Multi-platform builds (matrix strategy)
- Code signing with stored secrets
  - macOS: Apple Developer certificate
  - Windows: AzureSignTool with Azure Key Vault for EV certificates
- Automated releases to S3 (Velopack)
- Windows Setup.exe upload to S3 for distribution
- Code quality checks (format, lint, typecheck)
- Merge queue support for safer merges

**Windows Code Signing:**
- Uses AzureSignTool for EV certificate signing
- Supports Azure Key Vault integration
- Fallback to local signtool if Azure credentials not available
- Signs both installer executables and Velopack packages

## Core Services

### 1. OnboardingService

Manages first-time user setup and configuration.

**Responsibilities:**
- Track onboarding completion state
- Manage credential storage preferences
- Guide users through initial setup

**Storage**: `onboarding.json` in userData

### 2. UvService

Manages the UV package manager for Python dependencies.

**Responsibilities:**
- Download and install UV from GitHub releases
- Provide UV executable path
- Manage UV environment configuration

**Installation**: `userdata/uv/`

### 3. PythonService

Manages standalone Python runtime installation.

**Responsibilities:**
- Download Python distribution (currently 3.12.7)
- Extract and configure Python
- Provide Python executable path

**Installation**: `userdata/python/`

### 4. HttpAuthService

Handles OAuth 2.0 authentication with Griptape Cloud.

**Responsibilities:**
- Start local Express server on port 5172
- Handle OAuth flow (authorization code grant)
- Store and refresh access tokens automatically
- Generate and store API keys
- Emit `apiKey` event when authentication completes
- Automatic token refresh to prevent expired sessions in editor

**Storage Modes:**
- In-memory (default): No persistence, lost on restart
- Persistent: Encrypted storage with electron-store

**Endpoints**:
- Authorization: `https://auth.cloud.griptape.ai/authorize`
- Token: `https://auth.cloud.griptape.ai/oauth/token`
- API Key: `https://cloud.griptape.ai/api/api-keys`

**Token Refresh:**
- Monitors token expiration and automatically refreshes before expiry
- Prevents session interruptions in the embedded editor
- Configurable refresh interval for optimal performance

### 5. GtnService

Manages Griptape Nodes CLI installation and configuration.

**Responsibilities:**
- Install GTN via `uv tool install griptape-nodes`
- Initialize GTN configuration (`gtn init`)
- Sync and register libraries with optional installation during onboarding
- Manage workspace directory
- Auto-update GTN engine on startup (if already installed)
- Manage GTN version and upgrades
- Switch between stable and nightly engine channels
- Reconfigure and reinstall engine components for troubleshooting

**Configuration**: `xdg_config_home/griptape_nodes/griptape_nodes_config.json`

**Key Methods:**
- `start()`: Initialize service and check for updates
- `selfUpdate()`: Update GTN to latest version
- `upgradeGtn()`: Force upgrade GTN via UV
- `updateWorkspaceDirectory(dir)`: Change workspace location
- `syncLibraries()`: Sync libraries with engine
- `registerLibraries()`: Register synced libraries
- `getGtnVersion()`: Get current GTN version
- `switchChannel(channel)`: Switch between stable and nightly channels
- `reconfigureEngine()`: Reconfigure engine settings
- `reinstallEngine()`: Reinstall engine components for troubleshooting

**Auto-Update Behavior:**
- Checks if GTN is already installed on startup
- Automatically runs `gtn self update` if GTN exists
- Logs update process to engine service for UI display
- Non-fatal: continues with existing version if update fails

**Channel Management:**
- Supports stable and nightly engine channels
- Channel switching triggers engine reinstallation
- Preserves workspace and configuration during channel switches

### 6. EngineService

Manages the Griptape Nodes engine process.

**Responsibilities:**
- Spawn and monitor engine child process
- Capture stdout/stderr with ANSI color support
- Parse and emit logs in real-time
- Handle process crashes with auto-restart (max 3 attempts)
- Manage engine lifecycle (start, stop, restart)

**Engine Status**:
- `not-ready`: Service not initialized
- `ready`: Service ready, engine stopped
- `initializing`: Environment setup in progress
- `running`: Engine process active
- `error`: Engine failed to start

**Features:**
- Line buffering for stdout/stderr
- Carriage return handling for progress indicators
- Hyperlink detection (OSC 8 sequences)
- Virtualized log display (up to 1000 entries)

### 7. UpdateService

Manages application updates using Velopack.

**Responsibilities:**
- Check for updates from S3-hosted channels
- Download updates with progress tracking
- Apply updates with automatic restart
- Manage release channels (stable, beta, etc.)

**Update URL**: `https://griptape-nodes-desktop-releases.s3.amazonaws.com`

**Channels**:
- Channel is embedded at build time via `VELOPACK_CHANNEL` env var
- Users can switch channels via settings
- Logical channel names extracted from full channel strings

### 8. DeviceIdService

Manages unique device identification for analytics and support.

**Responsibilities:**
- Generate and persist unique device identifier
- Provide device ID for usage metrics
- Support device ID reset for privacy
- Store device creation timestamp

**Storage**: `device-id.json` in userData

### 9. UsageMetricsService

Reports anonymous usage metrics to Griptape Cloud.

**Responsibilities:**
- Report application launch events
- Track feature usage anonymously
- Include device ID and platform information
- Respect user privacy preferences

**Endpoint**: `https://cloud.griptape.ai/api/usage-metrics`

### 10. SettingsService

Manages application-wide settings and preferences.

**Responsibilities:**
- Store and retrieve user preferences
- Manage system monitor visibility
- Persist settings across restarts
- Provide settings change notifications
- Manage engine channel preferences (stable/nightly)
- Track library installation preferences
- Store operation progress state for UI persistence

**Storage**: `settings.json` in userData

**Engine Settings:**
- Current engine channel selection
- Library installation preferences
- Update check preferences

### 11. SystemMonitorService

Monitors system resource usage in real-time.

**Responsibilities:**
- Track CPU usage percentage
- Monitor memory usage (used/total)
- Emit periodic metrics updates (every 2 seconds)
- Provide start/stop monitoring control
- Calculate and report system health metrics

**Features:**
- Non-blocking metrics collection
- EventEmitter-based updates
- Configurable monitoring interval
- Cross-platform compatibility

## User Interface

### Application Flow

```
Start → Login → Onboarding → Dashboard
                    ↓
            ┌───────┴───────┐
            │               │
        Set Workspace   Enable Credentials
            │               │
            └───────┬───────┘
                    ↓
            Complete Setup → Main App
```

### Main Pages

#### Dashboard (`Dashboard.tsx`)

Overview page showing:
- Welcome message and getting started guide
- Engine status indicator
- Quick action buttons (Open Editor, View Engine)
- Workspace directory information
- Current workspace path with folder icon

#### Engine (`Engine.tsx`)

Engine management page with:
- Engine status badge with color coding
- Control buttons (Start, Stop, Restart, Clear Logs, Copy Logs)
- Real-time log viewer with virtualization (bounded to 1000 entries)
- ANSI color rendering via ansi-to-html
- Clickable URLs in log output
- Auto-scroll to bottom option
- Compact button styling for better space efficiency
- Error banner for initialization failures
- Copy Logs button with visual feedback
- Horizontal scroll for long log lines

#### Editor (`Editor.tsx`)

Embedded Griptape Nodes web editor:
- Runs in webview with custom preload script
- Authentication token injection with automatic refresh
- Full-screen overlay when active
- Direct integration with local engine
- Context menu support for right-click operations
- Embedded mode query parameter (`embedded=true`)
- Persistent localStorage across app restarts
- Link clicks open in default browser

#### Settings (`Settings.tsx`)

Configuration management:
- Workspace directory selector with clickable link to App Settings
- Update channel selection
- GTN engine version display and manual upgrade
- Engine channel switching (stable/nightly)
- Engine reconfiguration button
- Engine reinstallation for troubleshooting
- System monitor visibility toggle
- Version information (app and GTN)
- Release notes and changelog
- Manual update check
- Environment information display
- Library preferences management
- Operation progress tracking with persistence

### Components

**Sidebar** (`Sidebar.tsx`)
- Navigation menu with icons
- Active page highlighting
- Engine status indicator
- Theme toggle
- Collapsible on mobile

**LoginPage** (`LoginPage.tsx`)
- OAuth 2.0 login flow in modal dialog
- Griptape Cloud branding
- Loading states
- Error handling
- Non-blocking UI (user can dismiss during login)

**OnboardingWizard** (`onboarding/`)
- Multi-step setup wizard
- Keychain explanation (macOS)
- Workspace directory setup with validation
- Credential storage preferences
- Optional library installation step
- "Remember my credentials" defaults to true

**EditorWebview** (`EditorWebview.tsx`)
- Embedded Griptape Nodes editor
- Authentication state checking
- Error boundary
- Portal-based rendering

**SystemMonitor** (`SystemMonitor.tsx`)
- Real-time CPU and memory usage display
- Collapsible panel with smooth animations
- Graphical progress bars for resource usage
- Auto-refresh every 2 seconds
- Persistent visibility preference
- Toggleable from settings

### Keyboard Shortcuts

**Global Shortcuts:**
- `Cmd+R` / `Ctrl+R`: Reload editor webview (when on Editor page) or reload app (other pages)
- `Cmd+Option+I` / `Ctrl+Shift+I`: Toggle Developer Tools
- `Cmd+H`: Hide application (macOS only)
- `Cmd+Q` / `Alt+F4`: Quit application (platform-specific)

**Menu Shortcuts:**
- `Cmd+Z` / `Ctrl+Z`: Undo
- `Cmd+Shift+Z` / `Ctrl+Y`: Redo
- `Cmd+X` / `Ctrl+X`: Cut
- `Cmd+C` / `Ctrl+C`: Copy
- `Cmd+V` / `Ctrl+V`: Paste
- `Cmd+A` / `Ctrl+A`: Select All

## Configuration

### User Data Directories

**Development Mode:**
```
project-root/
├── _userdata/        # Application data
├── _documents/       # User documents
└── _logs/            # Application logs
```

**Production:**
- macOS: `~/Library/Application Support/Griptape Nodes/`
- Windows: `%APPDATA%\Griptape Nodes\`
- Linux: `~/.config/griptape-nodes/`

### Configuration Files

**GTN Configuration** (`xdg_config_home/griptape_nodes/griptape_nodes_config.json`)
```json
{
  "api_key": "encrypted_api_key",
  "workspace_directory": "/path/to/workspace",
  "storage_backend": "local",
  "engine_channel": "stable"
}
```

**Workspace Configuration** (`gtn-workspace.json`)
```json
{
  "workspaceDirectory": "/path/to/workspace"
}
```

**Onboarding State** (`onboarding.json`)
```json
{
  "completed": true,
  "credentialStorageEnabled": false,
  "librariesInstalled": true
}
```

**Settings** (`settings.json`)
```json
{
  "systemMonitorVisible": true,
  "engineChannel": "stable",
  "libraryPreferences": {
    "installDuringOnboarding": true,
    "autoUpdate": false
  },
  "updateChannel": "stable"
}
```

### Environment Variables

The application respects these environment variables:

- `GT_CLOUD_API_KEY`: Bypass OAuth with direct API key (development)
- `AUTH_SCHEME`: Authentication method (`http` or `custom`)
- `NODE_ENV`: Environment mode (`development` or `production`)
- `GITHUB_ACTIONS`: Enable CI/CD features (code signing)
- `VELOPACK_CHANNEL`: Update channel for builds

## Security

### Electron Security Features

**Fuses** (Compile-Time Security)
- ✅ `RunAsNode`: Disabled
- ❌ `EnableCookieEncryption`: Disabled (prevents keychain prompts)
- ❌ `EnableNodeOptionsEnvironmentVariable`: Disabled
- ❌ `EnableNodeCliInspectArguments`: Disabled
- ✅ `EnableEmbeddedAsarIntegrityValidation`: Enabled
- ✅ `OnlyLoadAppFromAsar`: Enabled

**Runtime Security**
- Non-persistent partition for main window (no cookies to disk)
- Separate webview partition for editor with localStorage persistence
- Node integration controlled through preload scripts
- IPC communication via contextBridge
- Content Security Policy for web content

**System Permissions** (macOS entitlements)
- Camera access for webcam-enabled nodes
- Microphone access for audio processing nodes
- Network access for API communication
- File system access for workspace management

### Authentication Security

**Credential Storage**
- Optional encrypted storage with electron-store
- Uses Electron safeStorage API (keychain/credential manager)
- User must opt-in during onboarding
- In-memory mode available (no persistence)

**API Key Protection**
- Never logged or exposed in renderer
- Redacted in debug output
- Stored encrypted when persistence enabled
- Separate storage implementations (in-memory vs persistent)

**OAuth Flow**
- Standard OAuth 2.0 authorization code flow
- PKCE (Proof Key for Code Exchange) supported
- State parameter for CSRF protection
- Short-lived access tokens with refresh tokens
- Local server only binds to localhost

### Process Isolation

- **Main Process**: Manages services, no direct user input
- **Renderer Process**: UI only, limited system access
- **Preload Scripts**: Secure IPC bridge
- **Child Processes**: Python/UV/Engine run isolated

## Troubleshooting

### Common Issues

#### Engine Won't Start

**Symptoms**: Engine status stuck in "ready" or "initializing"

**Solutions**:
1. Check if Python and UV are installed: Look for errors in Engine logs
2. Verify GTN installation: Check `_userdata/uv-tools/griptape-nodes/`
3. Ensure workspace directory is accessible
4. Check for port conflicts (default engine port)
5. Review logs in `_logs/main.log`

#### Authentication Failures

**Symptoms**: OAuth flow redirects but login fails

**Solutions**:
1. Verify internet connection
2. Check that port 5172 is not blocked by firewall
3. Ensure Griptape Cloud endpoints are reachable:
   - `auth.cloud.griptape.ai`
   - `cloud.griptape.ai`
4. Clear stored credentials: Delete `auth-credentials.json`
5. Try development mode with `GT_CLOUD_API_KEY`

#### Engine Hangs on Startup

**Symptoms**: Engine process starts but never becomes ready

**Recent Fix**: As of version 0.0.3, the engine now starts conditionally:
- If authenticated: Starts immediately
- If not authenticated: Waits for login, then starts automatically

**Solutions**:
1. Complete the onboarding wizard
2. Ensure you're logged in
3. Check engine logs for specific errors
4. Restart the application

#### Build Issues

**macOS**:
- Icon generation requires macOS (uses `sips` command)
- Code signing requires Apple Developer certificate
- Ensure Xcode Command Line Tools installed

**Windows**:
- PowerShell execution policy may block scripts
- Run: `Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser`

**Linux**:
- Ensure build-essential installed
- May need additional dependencies for electron-builder

### Logging

**Main Process Logs**
- Location: `_logs/main.log` (dev) or platform logs directory (prod)
- Levels: info, warn, error
- Includes service startup, IPC calls, errors

**Engine Logs**
- Displayed in Engine tab
- Includes stdout and stderr from engine process
- ANSI color codes preserved
- Clickable URLs detected and formatted

**Renderer Logs**
- Available in Chrome DevTools console (development)
- Press `Cmd+Option+I` (macOS) or `Ctrl+Shift+I` (Windows/Linux)

### Getting Help

- **Documentation**: [Griptape Nodes Docs](https://docs.griptapenodes.com/)
- **AI Assistant Guide**: See `CLAUDE.md` for AI-assisted development guidelines
- **Community**: [Discord Server](https://discord.gg/griptape)
- **Issues**: [GitHub Issues](https://github.com/griptape-ai/griptape-nodes-desktop/issues)
- **Email**: support@griptape.ai

## Contributing

### Code Style

- **TypeScript**: Moderate strictness (`noImplicitAny: false`)
- **React**: Functional components with hooks
- **Formatting**: Prettier (single quotes, no semicolons, 100 char line width)
- **Linting**: ESLint with modern flat config (`eslint.config.mjs`)
- **Async/Await**: Preferred over Promise chains
- **Error Handling**: Comprehensive with user-friendly messages
- **Comments**: Document complex logic, avoid temporal references

**Code Quality Commands:**
```bash
npm run typecheck    # Check TypeScript types
npm run lint         # Run ESLint
npm run format       # Format code with Prettier
```

### Development Guidelines

1. **Test thoroughly** on your target platform
2. **Update documentation** for new features
3. **Follow existing patterns** in the codebase
4. **Add logging** for debugging purposes
5. **Handle errors gracefully** with clear messages
6. **Consider cross-platform** compatibility

### Pull Request Process

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes with clear commit messages
4. Ensure `npm run typecheck` and `npm run lint` pass
5. Test on your target platform(s)
6. Submit pull request with detailed description

### Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add workspace directory selector
fix: resolve engine startup hang for unauthenticated users
docs: update README with troubleshooting section
chore: update dependencies to latest versions
```

## License

This project is licensed under the Apache License 2.0 - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- **Griptape Framework**: AI application development framework
- **Electron**: Cross-platform desktop app framework
- **React**: UI library
- **Velopack**: Modern app update framework
- **UV**: Fast Python package installer

## Version History

### [0.1.5] - 2025-01-XX

**Added**
- Hostname-based engine naming for better identification

**Fixed**
- Engine log overflow protection with compact button styling

### [0.1.4] - 2025-01-XX

**Added**
- Automatic GTN engine updates on application boot
- Update status logging to engine service

**Fixed**
- Engine auto-update flow and error handling

### [0.1.3] - 2025-01-XX

**Added**
- System monitor with real-time CPU/memory tracking
- Settings toggle for system monitor visibility

**Changed**
- Menu bar improvements for OS-specific behaviors (macOS/Windows/Linux)
- Reduced minimum window size to 1280x800 for smaller screens

**Fixed**
- Editor reload awareness (Cmd/Ctrl+R)
- Engine shutdown process improvements

### [0.1.2] - 2025-01-XX

**Added**
- GTN engine update management in Settings page
- View and Window menus with platform-specific items
- Keyboard shortcuts for reload (Cmd/Ctrl+R)

**Changed**
- Increased default window size to 1920x1200 for better editor experience

**Fixed**
- Log display now properly bounded to prevent performance issues
- Window draggable regions

### [0.1.0] - 2025-01-XX

**Added**
- Environment information collection and display
- Device ID service for anonymous usage tracking
- Usage metrics reporting to Griptape Cloud
- Settings service for persistent user preferences
- ESLint and Prettier for code quality
- CLAUDE.md documentation for AI assistance
- CI checks for format, lint, and typecheck

**Changed**
- Login flow now happens in modal for better UX
- Logs now grow dynamically to fill available space
- Release channel wording improvements
- Colored ANSI logs in engine output

**Fixed**
- Authentication flow when credential storage is disabled
- DMG S3 upload path alignment with Velopack conventions
- Double sidebar display issues

**Development**
- Added comprehensive ESLint configuration
- Integrated Prettier for consistent formatting
- Added automated CI checks

### [0.0.3] - 2025-10-06

**Added**
- Onboarding wizard for first-time setup
- Embedded Griptape Nodes editor
- Velopack auto-update system
- Multi-channel update support
- Credential storage opt-in

**Changed**
- Engine startup now conditional on authentication
- Authentication persistence is opt-in (no keychain prompts by default)
- Improved cross-platform compatibility

**Fixed**
- Engine startup hang for unauthenticated users
- macOS keychain prompts on first launch
- Windows PowerShell script execution
- UV installer compatibility issues

**Security**
- Disabled cookie encryption to prevent keychain prompts
- Added in-memory credential storage option
- Non-persistent partitions for webviews

---

**Made with ❤️ by the Griptape team**

For more information, visit [griptape.ai](https://www.griptape.ai/)
