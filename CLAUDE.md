# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Griptape Nodes Desktop is an Electron-based desktop application that provides a local development environment for Griptape Nodes, a visual programming tool for AI workflows. The app manages Python environments, installs dependencies, and runs a local engine that serves the Griptape Nodes editor through an embedded webview.

## Build and Development Commands

```bash
# Development
npm start                    # Start app in dev mode (opens DevTools automatically)

# Type checking and linting
npm run typecheck           # Run TypeScript type checking
npm run lint                # Run ESLint

# Building (platform-specific)
npm run pack:osx            # Build for macOS
npm run pack:linux          # Build for Linux
npm run pack:windows        # Build for Windows (x64)
npm run pack:windows:arm64  # Build for Windows (ARM64)

# Publishing (platform-specific)
npm run publish:osx         # Publish macOS build
npm run publish:linux       # Publish Linux build
npm run publish:windows     # Publish Windows build
npm run publish:windows:arm64  # Publish Windows ARM64 build

# Utilities
npm run generate-icons      # Generate app icons from source
```

## Architecture

### Process Model (Electron Three-Process Architecture)

1. **Main Process** (`src/main/index.ts`)
   - Application entry point that manages the entire lifecycle
   - Creates BrowserWindow and sets up IPC handlers
   - Manages services (Python, UV, GTN, Engine, Auth, Updates, Onboarding)
   - Handles OS-level integrations (menus, dialogs, auto-updates)

2. **Renderer Process** (`src/renderer/`)
   - React-based UI application
   - Communicates with main process via IPC through context bridge APIs
   - Uses React Router for navigation between pages (Dashboard, Engine, Editor, Settings)
   - Manages auth state with AuthContext and engine state with EngineContext

3. **Preload Scripts**
   - `src/preload/index.ts`: Main window preload - exposes safe IPC APIs to renderer via contextBridge
   - `src/preload/webview-preload.ts`: Webview preload for embedded editor

### Service Architecture

All services follow a common pattern:

- Extend EventEmitter for event-driven communication
- Implement `start()` method called during app initialization
- Provide `waitForReady()` for async initialization dependencies
- Use `isReady` flag to track initialization state

**Service Initialization Order** (critical for dependencies):

1. `OnboardingService` - Manages first-run experience
2. `AuthService` (HTTP or Custom) - Handles OAuth authentication
3. `UvService` - Installs and manages UV package manager
4. `PythonService` - Installs Python using UV
5. `GtnService` - Installs Griptape Nodes using UV, configures workspace
6. `EngineService` - Spawns and manages the GTN engine process
7. `UpdateService` - Manages Velopack auto-updates

### Key Services

**GtnService** (`src/common/services/gtn/gtn-service.ts`)

- Installs Griptape Nodes using UV tool installer
- Manages workspace directory configuration
- Handles library installation and registration
- Provides `runGtn()` method for executing GTN commands
- Config stored in XDG directories: `{userDataDir}/xdg_config_home/griptape_nodes/`

**EngineService** (`src/common/services/gtn/engine-service.ts`)

- Spawns GTN engine as child process with `spawn(gtnPath, ['--no-update'])`
- Buffers stdout/stderr and emits log events line-by-line
- Auto-restarts on crashes (up to 3 attempts with 5s delay)
- Engine states: 'not-ready' | 'ready' | 'initializing' | 'running' | 'error'

**AuthService** (`src/common/services/auth/http/` and `src/common/services/auth/custom/`)

- HTTP flow: Local server on port 51413 for OAuth callback
- Custom flow: Uses custom URL scheme (gtn://) for OAuth (packaged apps only)
- Supports persistent credential storage using electron-store + safeStorage
- Credentials stored encrypted in OS keychain when user opts in

**UpdateService** (`src/common/services/update/update-service.ts`)

- Uses Velopack for cross-platform auto-updates
- Supports multiple update channels (stable, preview, nightly)
- Only functional in packaged builds (disabled in dev mode)

### Path Management

All paths are centralized in `src/common/config/paths.ts`:

- XDG directories used for GTN config/data to maintain Linux compatibility
- UV installed to: `{userDataDir}/uv/`
- Python installed to: `{userDataDir}/python/`
- GTN installed via UV tool: `{userDataDir}/uv-tools/bin/gtn`
- Working directory for subprocess spawns: `{userDataDir}/tmp/`

In development mode (`!isPackaged()`), userDataPath is overridden to `{appPath}/_userdata` to keep dev environment isolated.

### Environment Variables

Environment setup for child processes in `src/common/config/env.ts`:

- Sets XDG paths for GTN config/data
- Configures UV_TOOL_DIR and UV_TOOL_BIN_DIR
- Sets PATH to include UV tool bin directory
- Python environment variables for subprocess execution

### IPC Communication

All IPC handlers defined in `setupIPC()` in `src/main/index.ts`:

- Naming convention: `{service}:{action}` (e.g., `engine:start`, `auth:login`)
- Use `ipcMain.handle()` for async operations (returns Promise)
- Use `ipcMain.on()` with `event.returnValue` for synchronous operations
- Context bridge APIs defined in `src/preload/index.ts` expose IPC as typed interfaces

### Authentication Flow

1. User clicks login → Renderer calls `window.oauthAPI.login()`
2. Main process spawns local HTTP server (HTTP mode) or uses custom URL scheme handler
3. Opens system browser to Auth0 login page
4. After auth, browser redirects to callback URL (localhost:51413 or gtn://)
5. Main process captures tokens and optionally stores encrypted in keychain
6. Renderer polls `auth:check` and updates AuthContext when tokens available

### Onboarding Wizard

Multi-step wizard shown on first launch (`src/renderer/components/onboarding/OnboardingWizard.tsx`):

1. **Keychain Explanation**: Explains credential storage, prompts for opt-in
2. **Authentication**: Login flow with Auth0
3. **Workspace Setup**: Choose workspace directory for GTN projects

Onboarding state tracked in OnboardingService using electron-store.

## Important Technical Details

### Cookie Encryption is Disabled

- `EnableCookieEncryption` fuse is disabled to prevent keychain prompts on first launch
- **CRITICAL**: All BrowserWindows and webviews MUST use in-memory partitions (e.g., `partition: 'main'` NOT `partition: 'persist:name'`)
- **EXCEPTION**: The editor webview uses `partition: 'persist:editor'` to preserve user settings (UI preferences, editor state) across app restarts. This is acceptable since sensitive auth data is managed separately via electron-store with safeStorage
- Explicit credential storage uses electron-store with safeStorage when user opts in

### Custom URL Schemes

- Custom URL scheme (gtn://) only works in packaged apps
- Dev mode MUST use `AUTH_SCHEME=http` environment variable
- If `AUTH_SCHEME=custom` in dev mode, app throws error on startup

### Engine Process Management

- Engine runs as detached child process, not killed automatically on app quit
- `app.on('before-quit')` hook ensures `engineService.destroy()` is called
- SIGKILL attempted first, then SIGTERM after 3s grace period

### TypeScript Path Aliases

- `@/*` maps to `src/*` (configured in tsconfig.json and webpack)
- Import example: `import { logger } from '@/main/utils/logger'`

### Webpack Configuration

- Main process: `webpack.main.config.ts`
- Renderer process: `webpack.renderer.config.ts`
- Two entry points: main window and webview preload
- Uses TailwindCSS for styling with PostCSS processing

### Logging

- Main process: electron-log (`@/main/utils/logger`)
- Renderer process: console wrapper (`@/renderer/utils/logger`)
- Logs stored in platform-specific locations (see electron-log docs)

## Common Patterns

### Waiting for Service Initialization

```typescript
await serviceInstance.waitForReady()
// Now safe to use service methods
```

### Running GTN Commands

```typescript
const childProcess = await gtnService.runGtn(['config', 'show'], { wait: true, forward_logs: true })
```

### Emitting Events to Renderer

```typescript
BrowserWindow.getAllWindows().forEach((window) => {
  window.webContents.send('event-name', data)
})
```

### Safe API Key Handling

Always redact API keys in logs:

```typescript
const sanitizedArgs = [...args]
const apiKeyIndex = sanitizedArgs.indexOf('--api-key')
if (apiKeyIndex !== -1) {
  sanitizedArgs[apiKeyIndex + 1] = '[REDACTED]'
}
logger.info('Command:', sanitizedArgs.join(' '))
```

## Development Environment Setup

In dev mode, the app uses these isolated directories:

- `_userdata/`: Application data (config, installed tools)
- `_documents/`: User documents (GTN workspaces)
- `_logs/`: Application logs

This prevents dev environment from polluting production paths.

## Testing and Debugging

- DevTools open automatically in dev mode (see `src/main/index.ts:112`)
- Check logs in: `{app.getPath('logs')}/main.log`
- Engine logs available via Engine page in UI
- IPC calls can be debugged in renderer DevTools console

## Build Process

Electron Forge handles packaging:

1. Webpack bundles main, renderer, and preload scripts
2. Native modules auto-unpacked from asar
3. Platform-specific makers: DMG (macOS), ZIP, DEB, RPM
4. Code signing and notarization only in CI (GitHub Actions)
5. Velopack generates update packages

### Windows Dependencies

The application includes native Node modules compiled with MSVC that require the **Visual C++ 2015-2022 Runtime**. The build process automatically handles this dependency:

- **x64 builds**: Velopack includes `vcredist143-x64` framework
- **ARM64 builds**: Velopack includes `vcredist143-arm64` framework
- If the runtime is not installed on the user's system, Velopack will prompt for installation before the app can run
- This check also occurs before applying updates to ensure compatibility

**Native modules requiring VC++ Runtime**:

- `velopack_nodeffi_win_*.node` - Velopack native bindings for auto-updates
- Electron's native modules (e.g., safeStorage for credential encryption)

This is configured in `scripts/build-windows.ps1` via the `--framework` flag passed to `vpk pack`.
