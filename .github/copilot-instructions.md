# GitHub Copilot & AI Agent Instructions

## Mandatory Git Protocol
For every change made in this repository (features, bug fixes, refactoring, docs, styling, configs):
- Immediately stage: `git add <files>`
- Commit with clear conventional message: `git commit -m "<type>: <description>"`
- Push to GitHub immediately: `git push origin main`
- Never leave unstaged or uncommitted changes across turns or steps.

---

## 5. Local Binary & Packaging Protocol (.exe / .msi)

When implementing, updating, or working on features in the desktop application:
1. **Packaging as the Final Step**: The building of .exe and .msi artifacts must ALWAYS be executed as the final task, only **after** all implementation tasks, linters (
pm run lint), and tests (
pm test) have passed completely.
2. **Local Directory Placement**:
   - The compiled .exe and .msi installers should be output/copied into the repository's dist-binaries/ directory.
   - A direct launcher shortcut (Luminess Assist.lnk) pointing to the executable should be created in the repository root for immediate access.
   - Command to run: 
pm run build:binaries (or powershell -ExecutionPolicy Bypass -File ./scripts/build-binaries.ps1).
3. **No Automatic Releases**:
   - Built binaries, .msi, .exe, and shortcut files are strictly local developer artifacts (ignored in .gitignore).
   - Do NOT create git tags or trigger release workflows (*) unless explicitly requested by the user ("won't get release unless asked").
