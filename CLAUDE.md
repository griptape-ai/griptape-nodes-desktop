# CLAUDE.md

## Project Overview

Griptape Nodes Desktop is an Electron app providing a local development environment for Griptape Nodes, a visual programming tool for AI workflows. It manages Python environments, installs dependencies, and runs a local engine serving the editor through an embedded webview.

## Commands

```bash
# Development
npm start                    # Start dev mode (opens DevTools)
npm run validate             # Run typecheck, lint, and format (run before commits)

# Testing
npm run test                 # Run Jest tests
npm run test:coverage        # Run tests with coverage

# Building
npm run pack:osx             # Build for macOS
npm run pack:linux           # Build for Linux
npm run pack:windows         # Build for Windows (x64)
npm run pack:windows:arm64   # Build for Windows (ARM64)

# Publishing
npm run publish:osx          # Publish macOS build
npm run publish:linux        # Publish Linux build
npm run publish:windows      # Publish Windows build
npm run publish:windows:arm64  # Publish Windows ARM64 build
```

## Architecture

### Process Model (Electron)

1. **Main Process** (`src/main/index.ts`)
   - App lifecycle, BrowserWindow creation, IPC handlers
   - Manages all services (Python, UV, GTN, Engine, Auth, Updates, Onboarding)
   - OS integrations (menus, dialogs, auto-updates)

2. **Renderer Process** (`src/renderer/`)
   - React UI communicating via IPC through context bridge
   - React Router pages: Dashboard, Engine, Editor, Settings
   - State management: AuthContext, EngineContext

3. **Preload Scripts**
   - `src/preload/index.ts` - Exposes IPC APIs via contextBridge
   - `src/preload/webview-preload.ts` - For embedded editor

### Service Architecture

All services follow this pattern:

- Extend EventEmitter for event-driven communication
- Implement `start()` called during app init
- Provide `waitForReady()` for async dependencies
- Use `isReady` flag to track state

**Initialization Order** (critical for dependencies):

1. OnboardingService - First-run experience
2. DeviceIdService - Device identifier
3. UsageMetricsService - Analytics
4. SettingsService - User preferences
5. SystemMonitorService - System resources
6. AuthService - OAuth (HTTP port 5172 or custom gtn:// scheme)
7. UvService - UV package manager
8. PythonService - Python via UV
9. GtnService - GTN installation, workspace config, `runGtn()` method
10. EngineService - Spawns GTN engine, auto-restarts (3 attempts, 5s delay)
11. EngineLogFileService - Log file writing
12. UpdateService - Velopack updates (stable/preview/nightly)
13. MigrationService - Version migrations

**Engine states:** `'not-ready' | 'ready' | 'initializing' | 'running' | 'error'`

### Path Management (`src/common/config/paths.ts`)

- UV: `{userDataDir}/uv/`
- Python: `{userDataDir}/python/`
- GTN: `{userDataDir}/uv-tools/bin/gtn`
- GTN config: `{userDataDir}/xdg_config_home/griptape_nodes/`
- Working dir: `{userDataDir}/tmp/`
- Dev mode: `{appPath}/_userdata`, `_documents`, `_logs` (isolated from production)

### Environment Variables (`src/common/config/env.ts`)

Sets XDG paths, UV_TOOL_DIR, UV_TOOL_BIN_DIR, PATH modifications for child processes.

### IPC Communication

Handlers in `setupIPC()` in `src/main/index.ts`:

- Convention: `{service}:{action}` (e.g., `engine:start`, `auth:login`)
- `ipcMain.handle()` for async (returns Promise)
- `ipcMain.on()` with `event.returnValue` for sync
- Context bridge APIs in `src/preload/index.ts`

### TypeScript

- Path alias: `@/*` maps to `src/*`
- Example: `import { logger } from '@/main/utils/logger'`

## Critical Constraints

### Velopack Pinned to 0.0.1053

**Do not upgrade** without verifying glibc requirements. Versions >= 0.0.1120 require glibc 2.39; RHEL 9 derivatives ship glibc 2.34.

```bash
# Check glibc requirements of a version
npm pack velopack@<version> && tar -xzf velopack-*.tgz
objdump -T package/lib/native/velopack_nodeffi_linux_x64_gnu.node | grep GLIBC_ | sort -V | tail -5
```

### Cookie Encryption Disabled

- `EnableCookieEncryption` fuse disabled to prevent keychain prompts
- **CRITICAL:** All BrowserWindows/webviews MUST use in-memory partitions (`partition: 'main'`)
- **Exception:** Editor webview uses `partition: 'persist:editor'` for UI state only (auth handled separately via electron-store + safeStorage)

### Custom URL Scheme

- `gtn://` only works in packaged apps
- Dev mode **must** use `AUTH_SCHEME=http` environment variable
- `AUTH_SCHEME=custom` in dev throws error on startup

### Engine Process Management

- Engine runs as detached child process
- `app.on('before-quit')` calls `engineService.destroy()`
- SIGKILL first, then SIGTERM after 3s grace period

### Windows Builds

Requires VC++ 2015-2022 Runtime. Velopack includes vcredist143 framework automatically via `--framework` flag in `scripts/build-windows.ps1`.

## Code Quality

**Run `npm run validate` before commits** to catch type errors, lint issues, and formatting problems.

### React Performance

- Use `memo()` for components rendered in loops
- Use `useMemo()` for expensive computations
- Use `useCallback()` for handlers passed to children or in dependency arrays
- Use `useRef()` for values that shouldn't trigger re-renders
- Avoid inline object/array creation in JSX
- Keep state as local as possible

### General

- Functional components with hooks
- Strict TypeScript (avoid `any`)
- Single-purpose components
- Extract reusable logic to custom hooks

### Comments and Documentation

Comments should describe the code as it exists, not changes being made:

- **BAD:** `// Added validation for empty strings`
- **GOOD:** `// Empty strings are invalid workspace paths`

Only add comments when the code's purpose isn't self-evident:

- Skip comments for straightforward operations
- Add comments for non-obvious business logic, workarounds, or edge cases
- Prefer clear variable/function names over explanatory comments

Docstrings for functions:

- Required for exported functions with non-obvious behavior
- Required for functions with complex parameters or return types
- Skip for simple getters/setters or self-documenting function names

```typescript
// Skip docstring - function name is self-explanatory
function getWorkspaceDirectory(): string { ... }

// Add docstring - behavior has important nuances
/**
 * Cleans up log files older than the retention period.
 * Only deletes files where ALL entries are outside the retention window.
 * Session logs are never deleted by this function.
 */
async cleanupOldLogs(): Promise<void> { ... }
```

## Common Patterns

```typescript
// Wait for service
await serviceInstance.waitForReady()

// Run GTN command
await gtnService.runGtn(['config', 'show'], { wait: true, forward_logs: true })

// Emit to renderer
BrowserWindow.getAllWindows().forEach((w) => w.webContents.send('event-name', data))

// Redact API keys in logs
const sanitized = [...args]
const idx = sanitized.indexOf('--api-key')
if (idx !== -1) sanitized[idx + 1] = '[REDACTED]'
```

## Logging

- Main process: electron-log (`@/main/utils/logger`)
- Renderer: console wrapper (`@/renderer/utils/logger`)
- Logs: `{app.getPath('logs')}/main.log`

## Build Process

Electron Forge packaging:

1. Webpack bundles main, renderer, preload scripts
2. Native modules auto-unpacked from asar
3. Platform makers: DMG (macOS), ZIP, DEB, RPM
4. Code signing/notarization in CI only (GitHub Actions)
5. Velopack generates update packages
