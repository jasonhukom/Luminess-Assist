# AI Agent Workflow: Continuous Commit & Push Protocol

> **CRITICAL & NON-NEGOTIABLE RULE FOR ALL AI ASSISTANTS**
> Every AI agent (Google Antigravity, Gemini CLI, Cursor, GitHub Copilot, Claude Code, or any automated assistant) operating in this repository MUST strictly adhere to the **Continuous Commit & Push Protocol**.
> 
> You MUST `git add`, `git commit`, and `git push` for **every single change** you make.
> - Do NOT wait until the end of the conversation or session.
> - Do NOT batch multiple unrelated changes together.
> - For every file edit, bug fix, feature increment, styling tweak, or configuration adjustment, immediately commit and push before proceeding or concluding your turn.

---

## 1. The Mandatory Cycle for Every Change

For **every** individual modification or logical change:
1. **Verify Change**: Ensure the edit compiles, has no syntax errors, and meets code quality standards (`npm run build`, `npm run lint`, or `npm test` as appropriate).
2. **Stage**:
   ```bash
   git add <path/to/modified_files>
   # or for project-wide increments:
   git add -A
   ```
3. **Commit**:
   Write a concise, imperative Conventional Commit message:
   ```bash
   git commit -m "<type>(<scope>): <clear description of change>"
   ```
   - `feat`: new features or capabilities
   - `fix`: bug fixes or corrections
   - `style`: layout, visual, or CSS adjustments
   - `refactor`: code restructuring without behavior changes
   - `chore`: dependencies, configs, build scripts
   - `docs`: documentation or comment updates
   - `test`: test additions or updates

4. **Push**:
   Immediately push to the current remote branch (usually `main`):
   ```bash
   git push origin main
   ```
5. **Confirm Clean State**:
   Verify with `git status` that working tree is clean and branch is up to date with remote.

---

## 2. Multi-Step Tasks

If a user request requires multiple steps (e.g., step 1: refactor state, step 2: update UI, step 3: add tests):
- Complete Step 1 -> `git add` -> `git commit` -> `git push`
- Complete Step 2 -> `git add` -> `git commit` -> `git push`
- Complete Step 3 -> `git add` -> `git commit` -> `git push`

Never leave uncommitted work sitting across multiple agent turns or prompts.

---

## 3. Remote Conflict Resolution

If a push is rejected due to remote changes:
```bash
git pull --rebase origin main
git push origin main
```

---

## 4. No Exceptions

- Small fixes (typos, single CSS rules, 1-line config changes) **MUST** be committed and pushed immediately.
- There are no exceptions for "saving time" or "waiting for user confirmation on the next step" unless explicitly commanded by the user to hold off on Git operations.
