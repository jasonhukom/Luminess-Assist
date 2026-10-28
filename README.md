<p align="center">
  <img src="https://raw.githubusercontent.com/jasonhukom/Luminess-Assist/main/public/robot-icon.svg" width="112" alt="Luminess Assist robot" />
</p>

<h1 align="center">Luminess Assist</h1>

<p align="center">
  <strong>A living AI companion for your Windows desktop.</strong><br />
  An expressive floating robot that can chat, react, and help you work on your PC.
</p>

<p align="center">
  <a href="https://github.com/jasonhukom/Luminess-Assist/releases/latest"><img src="https://img.shields.io/github/v/release/jasonhukom/Luminess-Assist?display_name=tag&style=flat" alt="Latest release" /></a>
  <a href="https://github.com/jasonhukom/Luminess-Assist/releases"><img src="https://img.shields.io/github/downloads/jasonhukom/Luminess-Assist/total?style=flat" alt="GitHub downloads" /></a>
  <a href="https://github.com/jasonhukom/Luminess-Assist"><img src="https://img.shields.io/github/stars/jasonhukom/Luminess-Assist?style=flat" alt="GitHub stars" /></a>
  <img src="https://img.shields.io/badge/platform-Windows%2010%2F11-0078D4?style=flat" alt="Windows 10 and 11" />
</p>

<p align="center">
  <a href="https://github.com/jasonhukom/Luminess-Assist/releases/latest"><strong>Download the latest release</strong></a>
  ·
  <a href="#installation">Installation</a>
  ·
  <a href="#development">Development</a>
  ·
  <a href="https://github.com/jasonhukom/Luminess-Assist/issues">Report a bug</a>
</p>

---

## Meet Luminess

Luminess Assist is a lightweight desktop companion built with **React, TypeScript, Tauri 2, and Rust**. Its animated robot lives in a transparent, always-on-top window, so you can keep it nearby while working in other apps.

Talk to it using an AI provider you configure, watch its expressions change with the conversation, and optionally let it perform desktop tasks. Luminess asks for permission before running supported desktop actions, so you can review requests before approving them.

## Features

- **An expressive robot** — 11 facial expressions, animated reactions, and a personality that can evolve with your interactions.
- **A floating desktop companion** — Transparent, frameless, always-on-top window with drag, flick, and resize interactions.
- **AI conversations** — Choose a supported provider: Google Gemini, Anthropic Claude, or the OpenAI API.
- **Desktop assistance** — Ask Luminess to find, read, write, copy, move, or delete files; open apps and URLs; run PowerShell commands; or set a timer.
- **Permission prompts** — Review desktop-tool requests before allowing or denying them. Keep approval prompts enabled unless you have a good reason not to.
- **AURA startup experience** — A stylized boot sequence with animated interface panels and system-style visualizations.
- **Windows system tray** — Hide, show, or quit the companion from the tray.
- **Web showcase** — A separate web app with the robot aesthetic and a dependency/storage calculator.

## Installation

### Option 1: Install with PowerShell

On Windows, open **PowerShell** or **Windows Terminal** and run:

```powershell
irm https://raw.githubusercontent.com/jasonhukom/Luminess-Assist/main/install.ps1 | iex
```

The installer checks for the latest GitHub release, downloads the Windows setup package, and helps create a desktop shortcut. It does not require you to build the source code.

> [!IMPORTANT]
> This command downloads and executes the installer script from this repository. For maximum control, review the [installer script](install.ps1) on GitHub before running it.

### Option 2: Download a release manually

Visit **[GitHub Releases](https://github.com/jasonhukom/Luminess-Assist/releases/latest)** and choose a Windows installer from the latest release. The release may include an `.exe` setup installer and an `.msi` package.

## First launch and AI setup

1. Launch Luminess Assist and complete the setup flow.
2. Choose your preferred AI provider.
3. Add the API key required by that provider and confirm that the connection works.
4. Click the robot to open the chat panel and start a conversation.

| Provider | Where to get an API key |
| --- | --- |
| **Google Gemini** | [Google AI Studio](https://aistudio.google.com/app/apikey) |
| **Anthropic Claude** | [Claude Console](https://platform.claude.com/settings/keys) |
| **OpenAI API** | [OpenAI API keys](https://platform.openai.com/api-keys) |

**Important:** Connecting a Google account is not the same as having a Gemini API key. Depending on the selected provider and setup state, you may still need to configure an API key. API access and usage limits are managed by the provider.

## Interacting with Luminess

| Action | What it does |
| --- | --- |
| Click the robot | Open or close the chat panel |
| Click and drag | Move the robot around the screen |
| Flick the robot | Give it momentum; the companion returns toward a safe on-screen area |
| Mouse wheel over the robot | Change the robot's size |
| `Alt` + left-click | Summon the robot at the cursor |
| `Win` + `Shift` + `C` | Toggle the chat panel |
| `Win` + `Esc` | Immediately terminate Luminess Assist |
| `Page Up` / `Page Down` | Change the robot's docking position |
| `Ctrl` + arrow keys | Move the robot |
| Arrow keys | Adjust the chat bubble's position around the mascot |

## Desktop actions and safety

Luminess can use desktop tools to interact with your Windows environment. Depending on the request, this may include reading or modifying files, opening applications, or executing PowerShell commands.

- Review each permission prompt and approve only actions you understand.
- File-writing, moving, and deletion actions can change your local data. Keep important files backed up.
- Avoid enabling automatic approval for commands or file operations unless you understand the risks.
- Treat AI-generated commands and suggestions as untrusted until you have reviewed them.

## Privacy and local settings

Provider requests are sent to the AI service you select. Provider API keys, provider selection, and some authentication state are stored in the app's local WebView storage; **this is not an encrypted credential vault**. Use a trusted Windows account and do not share your device while API keys are configured.

The personality system keeps lightweight interaction state locally to help maintain a consistent tone. Its trait presets are authored rules inspired by Big Five personality concepts; the app does not bundle the large raw questionnaire dataset or use it as a trained personality classifier.

## Technology

| Layer | Technologies |
| --- | --- |
| Desktop UI | React, TypeScript, Vite |
| Native desktop runtime | Tauri 2, Rust |
| AI providers | Google Gemini, Anthropic Claude, OpenAI API |
| Icons and visuals | Lucide React, CSS, SVG |
| Web showcase | React, Vite, Tailwind CSS, Nginx/Docker support |

## Development

### Requirements

To build the **Windows desktop app** from source, install:

- [Node.js](https://nodejs.org/) — Node.js 24 is used by the release workflow.
- [Rust](https://www.rust-lang.org/tools/install) — use a current stable toolchain.
- [Microsoft C++ Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/) — include the MSVC build tools.
- [WebView2 Runtime](https://developer.microsoft.com/microsoft-edge/webview2/) — usually present on modern Windows installations.
- [Git](https://git-scm.com/) — to clone the repository.

### Run the desktop app

```bash
git clone https://github.com/jasonhukom/Luminess-Assist.git
cd Luminess-Assist
npm ci
npx tauri dev
```

Tauri starts the frontend development server and opens the desktop app. The first native build may take a while while Rust dependencies compile.

### Useful commands

Run these from the repository root:

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the frontend development server |
| `npx tauri dev` | Run the native desktop app in development mode |
| `npm run build` | Type-check and build the frontend |
| `npm run lint` | Run Oxlint |
| `npm test` | Run the Vitest test suite |
| `npx tauri build` | Build the desktop app and installer bundles |

## Web showcase

The `web/` directory contains a separate React 19 and Tailwind CSS web application.

### Run locally

From the repository root:

```bash
npm run web:dev
```

Or run it from inside the web directory:

```bash
cd web
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Build or run with Docker

```bash
npm run web:build

cd web
docker compose up --build
```

The Docker setup serves the web build through Nginx on port `3000`.

### Deploy to Vercel

The repository includes Vercel configuration. You can deploy through the [Vercel CLI](https://vercel.com/docs/cli) from the `web/` directory or connect the repository to a Vercel project. Check the project's configured root directory and build settings before deploying.

## Project structure

```text
Luminess-Assist/
├── public/                 # Shared public assets and robot icon
├── src/                    # Desktop React/TypeScript frontend
│   ├── components/         # Robot, chat panel, settings, and UI
│   └── lib/                # AI providers, personality, and app logic
├── src-tauri/              # Rust commands and Tauri configuration
├── web/                    # Separate web showcase
├── install.ps1             # Windows installer helper
├── package.json            # Desktop scripts and dependencies
└── README.md
```

## Releases

Published Windows builds are available on the **[GitHub Releases page](https://github.com/jasonhukom/Luminess-Assist/releases)**. The release workflow builds the Windows app when a version tag matching `v*` is pushed, and can also be started manually from GitHub Actions.

## Troubleshooting

<details>
  <summary><strong>The robot is not visible</strong></summary>

  Check that Luminess Assist is running and look for its system tray icon. If it still does not appear, try quitting the app from the tray and starting it again.
</details>

<details>
  <summary><strong>The AI provider cannot connect</strong></summary>

  Confirm that the API key belongs to the selected provider, that it is configured correctly, and that the provider account has access to the requested API. Check the app's displayed error for more detail.
</details>

<details>
  <summary><strong>The desktop build fails</strong></summary>

  Run `npm ci` from the repository root. Then confirm that Node.js, Rust, and the Microsoft C++ Build Tools are installed. Run `npm run build` to check frontend build errors before retrying `npx tauri dev`.
</details>

<details>
  <summary><strong>The installer download fails</strong></summary>

  Open [GitHub Releases](https://github.com/jasonhukom/Luminess-Assist/releases) and download the latest Windows package manually. The PowerShell installer uses the latest published release version.
</details>

## Contributing and feedback

Bug reports, ideas, and improvements are welcome. Before opening an issue, check [existing issues](https://github.com/jasonhukom/Luminess-Assist/issues) to see whether it has already been reported.

---

<p align="center">
  Built with care by <a href="https://github.com/jasonhukom">Jason Hukom</a> · <a href="https://github.com/jasonhukom/Luminess-Assist">Source code</a>
</p>
