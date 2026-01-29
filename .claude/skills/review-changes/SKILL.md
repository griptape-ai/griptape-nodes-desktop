---
name: review-changes
description: Review all changes since main for code quality, style, dead code, and artifacts
allowed-tools:
  - Bash
  - Grep
  - Glob
  - Read
  - Edit
---

# Review Changes Since Main

Review all code changes since the main branch for quality issues.

## Step 1: Run Automated Checks

```bash
npm run validate
```

If this fails, report all errors clearly.

## Step 2: Get Changed Files

```bash
git diff --name-only main...HEAD
```

## Step 3: Review Each Changed File

For each changed file, get the diff and review:

```bash
git diff main...HEAD -- <file>
```

### Check for These Issues:

**Dead Code & Artifacts:**

- Commented-out code blocks
- Unused imports
- Unused variables or functions
- `console.log` statements (except in logger utilities)
- `debugger` statements
- TODO/FIXME comments that should be addressed
- Leftover test code or mock data

**Code Quality:**

- Functions that are too long (>50 lines)
- Deeply nested conditionals (>3 levels)
- Duplicated code blocks
- Missing error handling for async operations
- Hardcoded values that should be constants

**React Performance (for .tsx files):**

- Components in loops missing `memo()`
- Inline object/array creation in JSX props
- Missing `useCallback` for handlers passed to children
- Missing `useMemo` for expensive computations
- State that could be local but is lifted unnecessarily

**Style & Consistency:**

- Inconsistent naming conventions
- Mixed async patterns (callbacks vs promises vs async/await)
- Inconsistent error handling patterns

## Step 4: Summary Report

Provide a summary with:

1. **Automated Check Results** - Pass/fail for typecheck, lint, format
2. **Issues Found** - Grouped by severity (critical, warning, suggestion)
3. **Files Reviewed** - List with status (clean, has issues)
4. **Recommended Fixes** - Specific actions to take

If issues are found, offer to fix them automatically where possible.
