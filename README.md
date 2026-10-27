# Luminess Assist

**A small, expressive AI robot that lives on your Windows desktop.**

Luminess Assist is a floating desktop companion powered by Google Gemini. It combines an animated SVG robot, a conversational chat panel, and Tauri-powered desktop integration in a lightweight, transparent window that stays above your other apps.

[**View the repository**](https://github.com/jasonhukom/Luminess-Assist) · [Releases](https://github.com/jasonhukom/Luminess-Assist/releases)

## What it can do

- **Expressive robot:** 11 conversational expressions—joy, sadness, anger, fear, surprise, disgust, curiosity, confusion, love, embarrassment, and idle—with emotion-specific eye shapes, neon glow, and animations.
- **Floating desktop companion:** A frameless, transparent, always-on-top window that stays out of the taskbar.
- **Natural conversations:** Gemini-powered responses with structured function calling.
- **Desktop tools:** The agent can request supported actions such as inspecting files, opening items, and running PC commands. Permission prompts let you review tool actions before they run.
- **Drag and flick physics:** Pick up the robot, move it around the screen, and flick it to give it momentum. The robot reacts to fast movement and returns to a safe on-screen area.
- **Resizable mascot:** Use the mouse wheel over the robot to change its size.
- **Expandable chat panel:** Click the robot to open or close its chat interface.
- **Google sign-in:** Connect through the app's Google sign-in flow.
- **System tray controls:** Hide, show, or quit the app from the Windows system tray.

## Interacting with the robot

| Action | Result |
| --- | --- |
| Click the robot | Open or close the chat panel |
| Click and drag | Move the companion around the desktop |
| Flick the robot | Give it momentum and watch it return toward the safe screen area |
| Scroll the mouse wheel over the robot | Increase or decrease its size |
| Chat with Luminess | Receive a response with a corresponding conversational expression |

The robot already has a set of expressive faces and physical movement. More interaction-specific reactions—such as spiral-eyed dizziness, escalating frustration from repeated impacts, and floating hearts for head pats—can be added as a further animation layer without replacing the existing emotion system.

## Technology

- **Frontend:** React, TypeScript, Vite
- **Desktop runtime:** Tauri 2 and Rust
- **AI integration:** Google GenAI SDK and Gemini
- **UI icons:** Lucide React
- **Styling and animation:** CSS and SVG

## Getting started

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

## Signing in and using Gemini

1. Launch Luminess Assist.
2. Choose **Sign in with Google** and complete the browser sign-in flow.
3. Return to the app and start a conversation from the robot's chat panel.

Gemini access depends on the Google authentication setup being correctly configured for the environment. If sign-in or AI requests fail, check the displayed error and the Google/Gemini configuration before trying again.

## Desktop-action permissions

Luminess Assist can connect a conversational request to desktop tools, including filesystem operations and command execution. Review permission prompts carefully and approve only actions you understand. Automatic approval is available as an option, but leaving it disabled is the safer default—especially when a request can modify files or run commands.

## Project layout

```text
Luminess-Assist/
├── src/
│   ├── components/
│   │   ├── Robot.tsx          # Robot SVG, expressions, and pointer interactions
│   │   ├── Robot.css          # Robot appearance and animations
│   │   ├── ChatPanel.tsx      # Conversation and permission UI
│   │   └── ChatPanel.css      # Chat panel styling
│   ├── lib/
│   │   └── gemini.ts          # Gemini integration, agent tools, and session handling
│   ├── App.tsx                # Application state and desktop UI coordination
│   ├── App.css
│   └── main.tsx
├── src-tauri/
│   ├── src/                   # Rust desktop commands and system tray
│   ├── capabilities/
│   └── tauri.conf.json        # Tauri window and bundling configuration
├── .github/workflows/
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
