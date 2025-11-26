# pcdev Branch Review – 2025-11-09

- **Base**: origin/master (6e9806f)
- **Head**: origin/pcdev (cbab89f)
- **Reviewer**: Codex (ChatGPT)
- **Scope examined**: 6 commits ahead of master (install scripts, widget container refactor, README/install updates, PTY/terminal tweaks)

## Findings

1. **High – `AGENTS.md` deleted breaks agent workflows**  
   _File_: `AGENTS.md:1` (entire file removed)  
   This branch deletes `AGENTS.md` altogether. That file is referenced in onboarding docs and by our automation to feed repository-specific rules to AI assistants. With it gone, any agent (Claude/GPT inside IDE) no longer receives project constraints (Obsidian-first data policy, hook stack requirements, etc.), which risks future contributions ignoring security and data rules. Please restore the file (or move it with an update to all consumers) instead of deleting it.

2. **High – `CLAUDE.md` removed without replacement**  
   _File_: `CLAUDE.md:1`  
   Similar to `AGENTS.md`, the branch deletes the 500+ line Claude guidance document, but nothing in README/INSTALL references the new `.claude/` files. Tooling (and contributors) still look for `CLAUDE.md`, so this removal regresses onboarding and automated agent context. Either keep `CLAUDE.md` or add a stub pointing to the new location and update every consumer.

3. **High – WidgetContainer now keeps every visited widget mounted**  
   _File_: `src/components/WidgetContainer.tsx:40-95`  
   The new “loaded widgets” cache switches from rendering only the active widget to keeping every previously‑opened widget mounted with `display: none`. Widgets like `TodoWidget` and `PomodoroWidget` start intervals/IPC sync loops in `useWidget`/`useWidgetObsidian` and rely on unmount to stop timers. After this change, those effects never clean up—auto‑sync keeps writing to Vault while the widget is hidden, and each visit spins up another interval. Repro: open Todo ➜ switch to Projects ➜ watch the background Obsidian sync still running (network + file churn) even though Todo UI is hidden. We should revert to rendering a single widget at a time or add explicit pause/resume hooks before keeping instances alive.

4. **Medium – Terminal theme option renamed to a non-existent key**  
   _File_: `src/components/Terminal.tsx:37-41`  
   The branch changes the xterm theme property from `selectionBackground` to `selection`, but `@xterm/xterm`’s `ITerminalOptions.theme` only defines `selectionBackground`. The new key is ignored, so selection highlight falls back to the default (barely visible on our dark theme). This is immediately visible when trying to copy output: the highlight no longer appears. Please restore `selectionBackground` (and optionally add `selectionForeground` if needed).

## Suggested Follow-ups
- Restore the deleted documentation (or move it with proper references) before merging pcdev.
- Revert or redesign the WidgetContainer caching so expensive widgets actually unmount/clean up.
- Fix the Terminal theme regression so users can see selected text.
- Re-run regression tests around auto-sync/terminal once the above changes land.
