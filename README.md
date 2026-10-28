# Luminess Assist

**A small, expressive AI robot that lives on your Windows desktop.**

Luminess Assist is a floating desktop companion powered by Google Gemini. It combines an animated SVG robot, a conversational chat panel, and Tauri-powered desktop integration in a lightweight, transparent window that stays above your other apps.

[**View the repository**](https://github.com/jasonhukom/Luminess-Assist) · [Releases](https://github.com/jasonhukom/Luminess-Assist/releases)

## What it can do

- **Expressive robot:** 11 conversational expressions—joy, sadness, anger, fear, surprise, disgust, curiosity, confusion, love, embarrassment, and idle—with emotion-specific eye shapes, neon glow, and animations.
- **Floating desktop companion:** A frameless, transparent, always-on-top window that stays out of the taskbar.
- **Natural conversations:** Gemini-powered responses with structured function calling.
- **Persistent companion personality:** A stable Big Five-inspired temperament and relationship memory that responds to pats, rough wall impacts, repairs, and conversation. The existing robot UI is reused; no new visual design is added.
- **Desktop tools:** The agent can request supported actions such as inspecting files, opening items, and running PC commands. Permission prompts let you review tool actions before they run.
- **Drag and flick physics:** Pick up the robot, move it around the screen, and flick it to give it momentum. The robot reacts to fast movement and returns to a safe on-screen area.
- **Resizable mascot:** Use the mouse wheel over the robot to change its size.
- **Expandable chat panel:** Click the robot to open or close its chat interface.
- **Google sign-in:** Connect through the app's Google sign-in flow.
- **AURA boot sequence:** A full-window cyberpunk startup screen with a timed boot trace, animated visual telemetry, code panels, module status, and signal displays.
- **Multi-provider setup:** Choose Gemini, Claude, or Codex/OpenAI from the first-run setup, open the provider's API-key page, and enter the key for the selected engine.
- **System tray controls:** Hide, show, or quit the app from the Windows system tray.

## Interacting with the robot

| Action | Result |
| --- | --- |
| Click the robot | Open or close the chat panel |
| Click and drag | Move the companion around the desktop |
| Flick the robot | Give it momentum and watch it return toward the safe screen area |
| Scroll the mouse wheel over the robot | Increase or decrease its size |
| Chat with Luminess | Receive a response with a corresponding conversational expression |

The robot already has its expressive face, movement and status pill. Personality now uses those existing surfaces: repeated pats gradually build affection, hard wall impacts raise anger and lower trust, and repairs calm anger without instantly erasing relationship history. While the robot is peacefully idle, it can occasionally make a short state-aware remark; the app does not open the chat window by itself.

## Companion personality and datasets

The personality layer is informed by the supplied datasets:
- The IPIP-FFM file is a Big Five questionnaire dataset, with 50 items covering extraversion, emotional reactivity/neuroticism, agreeableness, conscientiousness, and openness.
- The smaller CSV dataset contains five class labels: `serious`, `dependable`, `extraverted`, `lively`, and `responsible`. These labels guide the app's lightweight temperament presets.

The app does **not** bundle the large raw survey file or run a trained personality classifier. The label-to-temperament profiles are deliberately lightweight, authored presets inspired by those traits, combined with live interaction rules—not a claim that the dataset scientifically predicts a person's personality.

Affection, trust, anger, patience, curiosity, and a small set of interaction counters persist in local WebView storage. Raw chat messages are not saved by the personality module. The evolving state is added to the system prompt so Gemini, Claude, or OpenAI responses can use a consistent relationship tone. A few short idle remarks are generated locally from the same state rather than making background AI API calls.

Relationship stages are derived from the saved state: `getting_to_know_you`, `comfortable`, `bonded`, `cautious`, and `guarded`. This influences tone and initiative, but it never removes desktop-tool permission checks or makes the assistant punish the user for a low-trust state.

## Technology

- **Frontend:** React, TypeScript, Vite
- **Desktop runtime:** Tauri 2 and Rust
- **AI integration:** Google GenAI SDK and Gemini
- **UI icons:** Lucide React
- **Styling and animation:** CSS and SVG

## Instant Installation (One-Click PowerShell)

Install Luminess Assist and generate a desktop shortcut with a single command in **Windows PowerShell** or **Terminal**:

```powershell
powershell -ExecutionPolicy Bypass -Command "irm https://raw.githubusercontent.com/jasonhukom/Luminess-Assist/main/install.ps1 | iex"
```

### What this script does:
1. **Downloads release:** Fetches the official **v1.1.0** installer (`Luminess.Assist_1.1.0_x64-setup.exe` - only **2.11 MB**).
2. **Installs cleanly:** Installs to `%LOCALAPPDATA%\Programs\Luminess Assist` without requiring Administrator privileges.
3. **Creates desktop shortcut:** Places `Luminess Assist.lnk` on your Windows Desktop with the high-resolution robot icon.
4. **Starts automatically:** Launches the floating robot companion right away. Double-clicking the desktop shortcut anytime starts the app!

---

## Storage & Dependency Footprint

Luminess Assist is engineered with **Tauri v2 and Rust**, avoiding bloated bundled Chromium runtimes.

| Component | Role | Download Size | Disk Footprint | Status on Typical Windows 10/11 |
| :--- | :--- | :--- | :--- | :--- |
| **Luminess Assist Installer** | Core Application | **2.11 MB** | **9.5 MB** | Downloaded via installer script |
| **Edge WebView2 Runtime** | Native Webview Engine | ~150 MB | ~150 MB | **Pre-installed** (>99.2% of PCs) |
| **Git for Windows** *(Dev only)* | Version Control | ~55 MB | ~320 MB | Optional (Source builds only) |
| **Node.js (v20+)** *(Dev only)* | Frontend Build Tool | ~32 MB | ~75 MB | Optional (Source builds only) |
| **Rust & Cargo** *(Dev only)* | Native Compiler | ~180 MB | ~1.2 GB | Optional (Source builds only) |
| **C++ Build Tools** *(Dev only)* | Windows MSVC Linker | ~1.5 GB | ~4.5 GB | Optional (Source builds only) |

> [!TIP]
> **Total download size for regular Windows users:** **2.11 MB**! Installation takes under 5 seconds.

---

## Web Showcase & Dependency Calculator (`/web`)

The repository includes a web companion application located in [`/web`](file:///C:/Users/rynes/Documents/VSCODE/LuminessAssist/Luminess-Assist/web) built with **React 19**, **Vite**, and **Tailwind CSS**. It replicates the futuristic robot aesthetic with an interactive mascot, live emotion switching, audio synthesis, and a real-time disk storage calculator.

### Run Web Locally
```bash
# From repository root:
npm run web:dev

# Or directly inside the web folder:
cd web
npm install
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

### Run Web with Docker
```bash
cd web
docker compose up --build
```
Or build and run the Docker container directly:
```bash
docker build -t luminess-assist-web ./web
docker run -p 3000:80 luminess-assist-web
```
The application will be served via high-performance Nginx at `http://localhost:3000`.

### Deploy Web to Vercel
Deploying to Vercel is seamless with the included `vercel.json`:
- **Via Vercel CLI:**
  ```bash
  cd web && vercel
  ```
- **Via Git Integration:** Connect the repository to Vercel. Root directory can be set to either repository root or `web` (both have optimized `vercel.json` configurations).

---

## Getting started (Desktop App from Source)

### Requirements

For local development on Windows, install:

- [Node.js](https://nodejs.org/) — Node.js 24 is used by the release workflow.
- [Rust](https://www.rust-lang.org/tools/install) — the Tauri backend specifies Rust 1.90 or newer.
- [Microsoft C++ Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/) — required for native Windows builds.
- [WebView2 Runtime](https://developer.microsoft.com/microsoft-edge/webview2/) — normally available on current Windows installations.

### Run locally

Clone the repository and install the dependencies:

```bash
git clone https://github.com/jasonhukom/Luminess-Assist.git
cd Luminess-Assist
npm ci
```

Run the desktop app in development mode:

```bash
npx tauri dev
```

Tauri starts the Vite development server and opens the desktop application.

### Useful commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Run the frontend development server |
| `npx tauri dev` | Run the desktop app in development mode |
| `npm run build` | Type-check and build the frontend |
| `npm run lint` | Run Oxlint |
| `npx tauri build` | Build the desktop application and available bundles |

## AURA setup and AI providers

The AURA startup screen plays before the first-run setup. It then presents Google account connection first, followed by the provider selector and a key field.

- **Gemini:** Sign in with Google or supply a Gemini API key from [Google AI Studio](https://aistudio.google.com/app/apikey).
- **Claude:** Supply an Anthropic API key from [Claude Console](https://platform.claude.com/settings/keys).
- **Codex / OpenAI API:** Supply an OpenAI API key from the [OpenAI API keys page](https://platform.openai.com/api-keys). This provider uses the OpenAI Responses API; it is not a ChatGPT/Codex subscription sign-in.

Provider selection and API keys are saved in the local WebView storage. This is not an encrypted credential vault, so use a trusted Windows account and avoid sharing the device while keys are configured. Conversation requests are sent to the provider you select.

The startup graphs and progress displays are visual UI telemetry for the boot sequence; they are not measurements of hardware power consumption or a live process-monitoring dashboard.


## Desktop-action permissions

Luminess Assist can connect a conversational request to desktop tools, including filesystem operations and command execution. Review permission prompts carefully and approve only actions you understand. Automatic approval is available as an option, but leaving it disabled is the safer default—especially when a request can modify files or run commands.

## Project layout

```text
Luminess-Assist/
├── install.ps1                # Automated PowerShell installer & desktop shortcut maker
├── web/                       # Cyberpunk showcase & dependency calculator website
│   ├── src/                   # React 19 + Tailwind CSS + living robot mascot
│   ├── Dockerfile             # Multi-stage Nginx container build
│   ├── docker-compose.yml     # Containerized web deployment
│   └── vercel.json            # Vercel deployment configuration
├── src/                       # Desktop app React frontend
│   ├── components/
│   │   ├── Robot.tsx          # Robot SVG, expressions, and pointer interactions
│   │   ├── Robot.css          # Robot appearance and animations
│   │   ├── ChatPanel.tsx      # Conversation and permission UI
│   │   └── ChatPanel.css      # Chat panel styling
│   ├── lib/
│   │   └── gemini.ts          # Gemini, Claude, Codex integration and tools
│   ├── App.tsx                # Application state and desktop UI coordination
│   ├── App.css
│   └── main.tsx
├── src-tauri/
│   ├── src/                   # Rust desktop commands and system tray
│   ├── capabilities/
│   └── tauri.conf.json        # Tauri window and bundling configuration
├── .github/workflows/
│   ├── aura-ci.yml            # TypeScript/Vite build check
│   └── release.yml            # Windows release workflow
├── package.json
└── README.md
```

## Building releases

The GitHub Actions workflow at `.github/workflows/release.yml` builds the Windows application when a version tag matching `v*` is pushed. It also supports manual workflow dispatch.

For a published installer, visit the [GitHub Releases page](https://github.com/jasonhukom/Luminess-Assist/releases). Available downloads depend on the releases that have been published.

## Troubleshooting

**The robot is not visible**
- Check that Luminess Assist is running and look for its system tray icon.
- If the window is invisible or incorrectly rendered, check Windows graphics drivers and restart the app.

**Google sign-in or Gemini requests fail**
- Confirm that the Google sign-in flow completes successfully and the configured Gemini access is valid.
- Check the app's displayed error and retry after resolving any authentication or quota issue.

**The desktop build fails**
- Run `npm ci` again if dependencies are incomplete.
- Confirm that Node.js, Rust, and the Windows C++ build tools are installed.
- Run `npm run build` to check frontend TypeScript/build errors before retrying `npx tauri dev` or `npx tauri build`.

---

Built as an expressive desktop companion by [Jason Hukom](https://github.com/jasonhukom).
