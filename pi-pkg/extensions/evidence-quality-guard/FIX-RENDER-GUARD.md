# Evidence Render Guard Bug Fix

## Problem

When writing Evidence markdown pages, the guard that should prevent Svelte/HTML rendering errors did NOT fire. This allowed `<20` and `<$22` to be written to a page, causing:

```
(invalid-tag-name) Expected valid tag name: Line 284, column 63.
<p class="markdown"><strong class="markdown">Avoid zones with <20 trips AND <$22 avg fare:</strong></p>
```

## Root Cause Analysis

### Issue 1: `evidence-render-guard.ts` is NOT registered

- File exists in `pi-pkg/extensions/evidence-render-guard.ts`
- **NOT** listed in `pi-pkg/package.json` under `pi.extensions`
- Extension never loads

### Issue 2: `evidence-render-guard.ts` has wrong event property

```typescript
// WRONG: e.tool and e.name don't exist on tool_result events
const toolName = e.tool || e.name || "";

// CORRECT: use event.toolName
const toolName = event.toolName;
```

### Issue 3: `evidence-quality-guard` uses wrong hook

```typescript
// BEFORE (wrong): tool_result fires AFTER tool runs
pi.on('tool_result', async (event, ctx) => {
  // File is already written to disk at this point!
  const content = readFileSync(filePath, 'utf8');
  // ...
});

// AFTER (correct): tool_call fires BEFORE tool runs
pi.on('tool_call', async (event) => {
  // Can block the write before it happens
  return { block: true, reason: '...' };
});
```

## Fix Applied

Modified `pi-pkg/extensions/evidence-quality-guard/index.ts`:

1. **Changed `tool_result` to `tool_call`** for write/edit validation
2. **Added `validateContentBeforeWrite()`** function that validates content from `event.input` (not from disk)
3. **Added edit simulation** - reads existing file, applies edits, validates result
4. **Kept `tool_result` for bash** - bash output can't be predicted, so validate after

## Key Changes

```typescript
// Block write/edit tools BEFORE they execute
pi.on('tool_call', async (event) => {
  if (event.toolName === TOOL_NAMES.write) {
    const filePath = event.input?.path;
    const content = event.input?.content;  // Content from tool input, not disk
    
    if (filePath && content) {
      const result = await validateContentBeforeWrite(filePath, content);
      if (result?.block) {
        return { block: true, reason: result.reason };  // BLOCK the write
      }
    }
  }
  
  if (event.toolName === TOOL_NAMES.edit) {
    // Read existing file, apply edits, validate result
    // ...
  }
});
```

## Why This Works

| Hook | Timing | Can Block? | Use Case |
|------|--------|------------|----------|
| `tool_call` | BEFORE execution | ✅ Yes | Permission gates, input validation |
| `tool_result` | AFTER execution | ❌ No (file already written) | Result redaction, logging |

The `tool_call` hook fires before the tool runs and can return `{ block: true, reason }` to prevent execution. This is the correct hook for permission gates.

## Testing

Run existing tests:
```bash
cd pi-pkg/extensions/evidence-quality-guard
node --experimental-strip-types --test tests/static-analysis.test.ts
```

All 23/24 tests pass (1 expected failure for HTML tag detection).

## Additional Recommendations

1. **Register `evidence-render-guard.ts`** in `pi-pkg/package.json` OR
2. **Consolidate both guards** into `evidence-quality-guard` (already done)
3. **Add integration test** that verifies `<20` in markdown is blocked
4. **Consider adding `tool_call` hook** to `evidence-render-guard.ts` if keeping it separate
