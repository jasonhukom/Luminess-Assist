import type { Emotion } from '../components/Robot.tsx';
import type { Message, ToolPermissionRequest } from './gemini.ts';
import { executeToolOnPc } from './gemini.ts';
import {
  callLocalModelServer,
  discoverLocalAiServers,
  executeCliAgentPrompt,
  executeKiloCodePrompt,
  executeOpenCodePrompt,
} from './opencode.ts';
import {
  extractAndSaveUserMemoriesFromText,
  getCachedAppConfig,
  getPersistentMemoryPromptContext,
  getUserMemories,
  performWebSearchAndStore,
} from './memoryAndStorage.ts';
import { getPersonalityPromptContext } from './personality.ts';
import { parseDrinkReminderCommand } from './drinkReminder.ts';
import { parseMusicPlayerCommand } from './musicPlayer.ts';
import { parseWellbeingCommand } from './digitalWellbeing.ts';
import {
  executeDrinkToolAction,
  executeMusicToolAction,
  executeWellbeingToolAction,
} from './assistantRuntime.ts';

/**
 * Safely evaluates simple mathematical expressions like "25 * 4", "100 / 5", "12 + 38".
 */
function evaluateSimpleMath(input: string): number | null {
  const sanitized = input
    .replace(/(?:what\s+is|calculate|calc|how\s+much\s+is|\?|=)/gi, '')
    .trim();

  if (!/^[\d\s+\-*/().%^]+$/.test(sanitized)) {
    return null;
  }

  if (/[a-zA-Z_$]/.test(sanitized)) {
    return null;
  }

  try {
    const normalized = sanitized.replace(/\^/g, '**');
    // eslint-disable-next-line @typescript-eslint/no-implied-eval
    const result = new Function(`'use strict'; return (${normalized})`)();
    if (typeof result === 'number' && !Number.isNaN(result) && Number.isFinite(result)) {
      return result;
    }
  } catch {
    return null;
  }
  return null;
}

/**
 * Detects common Windows applications from user query.
 */
function detectAppToOpen(text: string): { target: string; label: string } | null {
  const lower = text.toLowerCase();
  if (/\b(notepad|notes?)\b/.test(lower)) return { target: 'notepad.exe', label: 'Notepad' };
  if (/\b(calc|calculator)\b/.test(lower)) return { target: 'calc.exe', label: 'Calculator' };
  if (/\b(paint|mspaint)\b/.test(lower)) return { target: 'mspaint.exe', label: 'Paint' };
  if (/\b(taskmgr|task\s*manager)\b/.test(lower)) return { target: 'taskmgr.exe', label: 'Task Manager' };
  if (/\b(cmd|command\s*prompt)\b/.test(lower)) return { target: 'cmd.exe', label: 'Command Prompt' };
  if (/\b(powershell|pwsh)\b/.test(lower)) return { target: 'powershell.exe', label: 'PowerShell' };
  if (/\b(explorer|file\s*explorer|files)\b/.test(lower)) return { target: 'explorer.exe', label: 'File Explorer' };
  if (/\b(chrome|google\s*chrome)\b/.test(lower)) return { target: 'chrome.exe', label: 'Google Chrome' };
  if (/\b(edge|msedge)\b/.test(lower)) return { target: 'msedge.exe', label: 'Microsoft Edge' };
  if (/\b(code|vscode|vs\s*code)\b/.test(lower)) return { target: 'code', label: 'Visual Studio Code' };
  if (/\b(settings|windows\s*settings)\b/.test(lower)) return { target: 'ms-settings:', label: 'Windows Settings' };

  const match = lower.match(/(?:open|launch|run|start)\s+([a-zA-Z0-9_\-.]+)/i);
  if (match && match[1]) {
    const appName = match[1].trim();
    if (!['the', 'a', 'an', 'my', 'pc', 'files', 'app', 'up'].includes(appName)) {
      return { target: appName, label: appName };
    }
  }

  return null;
}

/**
 * Extracts timer duration in minutes from input like "timer 5 minutes", "timer 10m", "timer 1".
 */
function detectTimerDuration(text: string): number | null {
  const lower = text.toLowerCase();
  const matchMin = lower.match(/(?:timer|alarm|countdown)\s+(?:for\s+)?(\d+(?:\.\d+)?)\s*(?:m|min|mins|minutes?)?/i);
  if (matchMin && matchMin[1]) {
    const val = parseFloat(matchMin[1]);
    if (val > 0 && val <= 1440) return val;
  }
  const matchSec = lower.match(/(\d+)\s*(?:s|sec|seconds?)\s*(?:timer|countdown)?/i);
  if (matchSec && matchSec[1]) {
    const val = parseFloat(matchSec[1]) / 60;
    if (val > 0) return Math.max(0.1, Math.round(val * 10) / 10);
  }
  return null;
}

/**
 * Detects if the user is asking a question that benefits from live web search.
 */
function shouldSearchWeb(text: string): string | null {
  const clean = text.trim();
  const lower = clean.toLowerCase();

  const explicitSearch = clean.match(
    /^(?:search\s+(?:for|the\s+web\s+for|about|up)?|look\s+up|google|find\s+info\s+on|search)\s+(.+)$/i
  );
  if (explicitSearch && explicitSearch[1]) {
    return explicitSearch[1].trim();
  }

  // Factual questions ("what is ...", "who is ...", "tell me about ...", "how does ... work", "latest ...")
  if (
    /^(?:what\s+is|what\s+are|who\s+is|who\s+was|where\s+is|when\s+did|how\s+does|how\s+to|tell\s+me\s+about|explain|why\s+is|latest\s+news\s+on)\s+(.+)$/i.test(
      clean
    ) &&
    !/\b(your\s+name|who\s+are\s+you|who\s+am\s+i|my\s+name|what\s+time|what\s+day|today'?s\s+date|system\s+info|pc\s+specs)\b/i.test(
      lower
    )
  ) {
    return clean.replace(/\?+$/, '').trim();
  }

  return null;
}

/**
 * Executes the Local AI assistant pipeline:
 * 1. Extracts & saves user memories ("who the user is") into the persistent database.
 * 2. Handles deterministic PC actions (math, time/date, opening apps, timers, file listing, PC specs).
 * 3. Connects to local AI servers (Ollama :11434, llama.cpp :8080, LM Studio :1234) when online.
 * 4. Integrates live Web Search (`performWebSearchAndStore`) to answer factual queries with source citations.
 * 5. Falls back to OpenCode CLI or the built-in memory-aware conversational engine.
 */
export async function runOfflineAgent(
  history: Message[],
  onToolStart: (toolName: string | null) => void,
  onEmotion: (emotion: Emotion) => void,
  onRequestPermission: (req: ToolPermissionRequest) => Promise<boolean>,
  onTimerComplete?: (label: string) => void
): Promise<Message> {
  const lastUserMsg = [...history].reverse().find((m) => m.role === 'user');
  const userText = lastUserMsg?.content.trim() || '';
  const lower = userText.toLowerCase();

  const executedActions: string[] = [];
  const cfg = getCachedAppConfig();

  // Always extract and persist any user identity/preference facts from what the user said
  const newlySavedMemories = extractAndSaveUserMemoriesFromText(userText, cfg.google_account_email);
  if (newlySavedMemories.length > 0) {
    executedActions.push(
      `Saved to memory: ${newlySavedMemories.map((m) => `${m.key}="${m.value}"`).join(', ')}`
    );
  }

  const allMemories = getUserMemories(cfg.google_account_email);
  const rememberedName =
    (cfg.bot_customization?.userName || '').trim() ||
    allMemories.find((m) => m.key === 'user_name')?.value;
  const botDisplayName = (cfg.bot_customization?.botName || '').trim() || 'Luminess Assist';

  async function runLocalTool(
    name: string,
    description: string,
    args: Record<string, any>
  ): Promise<any> {
    onToolStart(name);
    try {
      const allowed = await onRequestPermission({
        id: `offline_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        toolName: name,
        description,
        args,
      });

      if (!allowed) {
        executedActions.push(`Permission denied: ${name}`);
        return null;
      }

      const res = await executeToolOnPc(name, args, onTimerComplete);
      executedActions.push(`Executed: ${name}`);
      return res;
    } catch (err: any) {
      executedActions.push(`Tool error (${name}): ${err?.message || 'failed'}`);
      return null;
    } finally {
      onToolStart(null);
    }
  }

  // 0. Lock "Who Luminess Is" exclusively to Settings
  if (
    /\b(change your name|rename yourself|forget who you are|pretend your name is|from now on you are)\b/i.test(
      lower
    )
  ) {
    onEmotion('curiosity');
    return {
      role: 'assistant',
      content: `Who I am (**${botDisplayName}** and my core persona instructions) can only be changed inside **Settings -> Mad & Mind (Persona & Memory)**.\n\nIf you'd like, you can update what I call **you** or share facts about yourself here and I'll remember them!`,
      emotion: 'curiosity',
    };
  }

  // 1. User asking "who am I?" / "do you remember me?" / "what is my name?"
  if (/\b(who am i|what is my name|what'?s my name|do you remember me|what do you know about me)\b/i.test(lower)) {
    const bioLine = cfg.bot_customization?.userBio?.trim()
      ? `• **About you (Settings):** ${cfg.bot_customization.userBio.trim()}`
      : '';
    if (allMemories.length > 0 || rememberedName || bioLine) {
      const summaryLines = [
        ...(bioLine ? [bioLine] : []),
        ...allMemories.map((m) => `• **${m.key.replace(/_/g, ' ')}:** ${m.value}`),
      ];
      onEmotion('love');
      return {
        role: 'assistant',
        content: `${rememberedName ? `You're **${rememberedName}**! ` : ''}Here is what I remember about you:\n\n${summaryLines.join('\n') || `I know to call you **${rememberedName}**.`}`,
        emotion: 'love',
        toolActions: executedActions.length > 0 ? executedActions : undefined,
      };
    }
    onEmotion('curiosity');
    return {
      role: 'assistant',
      content:
        "I don't have your name saved in my memory yet! Tell me your name or what you're working on (for example, *\"My name is Alex and I prefer TypeScript\"*) and I'll remember it across all our conversations.",
      emotion: 'curiosity',
      toolActions: executedActions.length > 0 ? executedActions : undefined,
    };
  }

  // 2. If user just introduced themselves ("My name is ...", "Remember that ...")
  if (
    newlySavedMemories.length > 0 &&
    /^(?:my name is|call me|i am called|remember that|please remember|don'?t forget)/i.test(cleanText(userText))
  ) {
    onEmotion('love');
    const summary = newlySavedMemories.map((m) => `**${m.value}** (${m.category})`).join(', ');
    return {
      role: 'assistant',
      content: `Got it${rememberedName ? `, **${rememberedName}**` : ''}! I've saved that to your persistent memory${cfg.google_account_email ? ` (${cfg.google_account_email})` : ''}: ${summary}. I'll remember this whenever we talk!`,
      emotion: 'love',
      toolActions: executedActions,
    };
  }

  // 3. Math / Arithmetic calculation
  if (
    /^(?:calc|calculate|what is|how much is)?\s*[\d\s+\-*/().%^]{2,}\??$/i.test(userText.trim()) ||
    lower.startsWith('calc ') ||
    lower.startsWith('calculate ')
  ) {
    const mathVal = evaluateSimpleMath(userText);
    if (mathVal !== null) {
      onEmotion('curiosity');
      return {
        role: 'assistant',
        content: `**${mathVal}**`,
        emotion: 'curiosity',
      };
    }
  }

  // 4. Local Time & Date queries
  if (/\b(time|clock|current time|what time)\b/.test(lower) && !/\b(timer|first time)\b/.test(lower)) {
    const now = new Date();
    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const dateStr = now.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' });
    onEmotion('joy');
    return {
      role: 'assistant',
      content: `The local time is **${timeStr}** (${dateStr}).`,
      emotion: 'joy',
    };
  }

  if (/\b(date|what day|today'?s date|current date)\b/.test(lower)) {
    const now = new Date();
    const dateStr = now.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
    onEmotion('joy');
    return {
      role: 'assistant',
      content: `Today is **${dateStr}**.`,
      emotion: 'joy',
    };
  }

  // 5. Open Application / File / Tool
  if (/(?:open|launch|start|run)\s+/i.test(lower)) {
    const appInfo = detectAppToOpen(userText);
    if (appInfo) {
      onEmotion('curiosity');
      const res = await runLocalTool(
        'open_item',
        `Launch local application "${appInfo.label}"`,
        { target: appInfo.target }
      );

      if (res !== null) {
        onEmotion('joy');
        return {
          role: 'assistant',
          content: `Launched **${appInfo.label}**!`,
          emotion: 'joy',
          toolActions: executedActions,
        };
      } else {
        onEmotion('confusion');
        return {
          role: 'assistant',
          content: `Could not launch **${appInfo.label}** (permission was denied or application was not found).`,
          emotion: 'confusion',
          toolActions: executedActions,
        };
      }
    }
  }

  // 6. Timer & Countdown
  if (/\b(timer|alarm|countdown)\b/.test(lower)) {
    const minutes = detectTimerDuration(userText);
    if (minutes !== null) {
      onEmotion('joy');
      const label = `${minutes} min timer`;
      await runLocalTool(
        'set_timer',
        `Start local timer for ${minutes} minute(s)`,
        { minutes, label }
      );

      return {
        role: 'assistant',
        content: `Timer set for **${minutes} minute${minutes > 1 ? 's' : ''}**! I'll notify you when it finishes.`,
        emotion: 'joy',
        toolActions: executedActions,
      };
    }
  }

  // 7. System / PC Context inspection
  if (/\b(system|pc|computer|specs|hardware|os|environment|whoami|username|drives)\b/.test(lower)) {
    onEmotion('curiosity');
    const ctx = (await runLocalTool(
      'get_pc_context',
      'Inspect local PC specs, paths, and environment',
      {}
    )) || {
      os: 'Windows 10/11',
      username: 'Local User',
      desktop: 'Desktop',
      drives: ['C:'],
    };

    onEmotion('joy');
    const drives = (ctx.drives || []).join(', ') || 'C:';
    return {
      role: 'assistant',
      content: `**Local PC Status**\n• **OS:** ${ctx.os || 'Windows'}\n• **User:** ${ctx.username || 'User'}${rememberedName ? ` (${rememberedName})` : ''}\n• **Desktop:** \`${ctx.desktop || '~'}\`\n• **Drives:** ${drives}\n• **Mode:** ⚡ Offline Local AI Active`,
      emotion: 'joy',
      toolActions: executedActions,
    };
  }

  // 8. Check if an active local model server (Ollama / llama.cpp / LM Studio) is online!
  try {
    const servers = await discoverLocalAiServers();
    const onlineServer = servers.find(
      (s) => (s.kind === 'ollama' || s.kind === 'openai_compatible') && s.online
    );

    if (onlineServer || (cfg.local_ai_runtime === 'ollama' || cfg.local_ai_runtime === 'openai_compatible')) {
      const targetEndpoint = onlineServer?.endpoint || cfg.local_ai_endpoint || 'http://127.0.0.1:11434';
      const targetModel =
        onlineServer?.models?.[0] || cfg.local_ai_model || 'qwen2.5-coder:latest';

      onToolStart(`Local AI (${targetModel}): Thinking...`);

      // If query benefits from web search, run search first and include results in context
      let searchContext = '';
      const searchQ = cfg.search_engine_enabled ? shouldSearchWeb(userText) : null;
      if (searchQ) {
        onToolStart(`Searching web for "${searchQ}"...`);
        const results = await performWebSearchAndStore(searchQ, cfg.google_account_email, 4);
        if (results.length > 0) {
          executedActions.push(`Web search: "${searchQ}" (${results.length} sources stored in DB)`);
          searchContext =
            '\n\nLIVE WEB SEARCH RESULTS (Cite these URLs in your answer):\n' +
            results.map((r, idx) => `[${idx + 1}] ${r.title} (${r.url}): ${r.snippet}`).join('\n');
        }
      }

      const sysPrompt = [
        `You are ${botDisplayName}, a friendly, concise desktop AI companion running locally on the user PC. Your core identity and persona can ONLY be changed in Settings.`,
        cfg.bot_customization?.personality?.customPrompt
          ? `Persona Instructions: ${cfg.bot_customization.personality.customPrompt}`
          : '',
        getPersonalityPromptContext(),
        getPersistentMemoryPromptContext(cfg.google_account_email),
        searchContext,
      ]
        .filter(Boolean)
        .join('\n\n');

      const chatMsgs = [
        { role: 'system', content: sysPrompt },
        ...history.slice(-10).map((m) => ({
          role: m.role,
          content: m.content,
        })),
      ];

      const serverReply = await callLocalModelServer(targetEndpoint, targetModel, chatMsgs);
      onToolStart(null);
      if (serverReply) {
        executedActions.push(`Local AI model (${targetModel} @ ${targetEndpoint})`);
        onEmotion('joy');
        return {
          role: 'assistant',
          content: serverReply,
          emotion: 'joy',
          toolActions: executedActions,
        };
      }
    }
  } catch {
    onToolStart(null);
  }

  // 9. Greetings & Welcomes (memory-aware!)
  if (/^(?:hi|hello|hey|yo|sup|hiya|howdy|good morning|good afternoon|good evening|halo)\b/i.test(lower)) {
    const nameGreeting = rememberedName ? `, **${rememberedName}**` : '';
    const greetings = [
      `Hey there${nameGreeting}! I'm running in local AI mode. How can I help with your PC or research today?`,
      `Hello${nameGreeting}! Luminess is active locally with your memory and search engine ready. What would you like to do?`,
      `Hi${nameGreeting}! Luminess is standing by in local AI mode on your desktop. How can I help you today?`,
    ];
    const picked = greetings[Math.floor(Math.random() * greetings.length)];
    onEmotion('joy');
    return {
      role: 'assistant',
      content: picked,
      emotion: 'joy',
      toolActions: executedActions.length > 0 ? executedActions : undefined,
    };
  }

  // 10. Identity & Help
  if (/\b(who are you|what are you|what can you do|help|offline mode)\b/.test(lower)) {
    onEmotion('joy');
    return {
      role: 'assistant',
      content: `I'm **Luminess Assist** running in **Offline Mode** (Local AI Runtime) ⚡${rememberedName ? ` for **${rememberedName}**` : ''}!\n\nHere's what I can do right now:\n• **Remember You:** Tell me your name, preferences, or projects and I save them to your account memory\n• **Search Engine:** Ask *"search for <topic>"* or any factual question to retrieve cited web sources and store them in your database\n• **Open Apps:** *"open notepad"*, *"open calc"*, *"open cmd"*\n• **System Telemetry:** *"system info"*, *"pc specs"*, *"whoami"*\n• **Math, Time & Timers:** *"25 * 4"*, *"what time is it"*, *"set timer 5 minutes"*\n• **Ollama / llama.cpp Integration:** Connect any local model server in the floating **Settings** box!`,
      emotion: 'joy',
      toolActions: executedActions.length > 0 ? executedActions : undefined,
    };
  }

  // 11. Jokes & Light Banter
  if (/\b(joke|funny|laugh|meme)\b/.test(lower)) {
    const jokes = [
      'Why do programmers prefer dark mode? Because light attracts bugs!',
      'There are 10 types of people in the world: those who understand binary, and those who don’t.',
      'Why did the robot go on vacation? To recharge its batteries!',
      'An offline AI walks into a bar. It doesn’t need an API key to enjoy the atmosphere.',
    ];
    onEmotion('joy');
    return {
      role: 'assistant',
      content: jokes[Math.floor(Math.random() * jokes.length)],
      emotion: 'joy',
    };
  }

  // 12. Sentiment reactions (Thanks, compliments, sadness)
  if (/\b(thank|thanks|thx|awesome|great|cool|good job|nice)\b/.test(lower)) {
    onEmotion('love');
    return {
      role: 'assistant',
      content: `You're very welcome${rememberedName ? `, **${rememberedName}**` : ''}! Always happy to assist.`,
      emotion: 'love',
    };
  }

  if (/\b(sad|tired|stressed|exhausted|burnout)\b/.test(lower)) {
    onEmotion('love');
    return {
      role: 'assistant',
      content: `Take a deep breath and give your eyes a short break from the screen${rememberedName ? `, ${rememberedName}` : ''}. I'm right here with you on your desktop!`,
      emotion: 'love',
    };
  }

  // 12B. Hydration / Drink Reminder Commands
  const drinkAction = parseDrinkReminderCommand(userText);
  if (drinkAction) {
    const res = await executeDrinkToolAction({
      action: drinkAction.type,
      interval_minutes: drinkAction.type === 'enable' ? drinkAction.intervalMinutes : undefined,
      glasses: drinkAction.type === 'log' ? drinkAction.glasses : undefined,
      goal_glasses: drinkAction.type === 'set_goal' ? drinkAction.goal : undefined,
      snooze_minutes: drinkAction.type === 'snooze' ? drinkAction.minutes : undefined,
    });
    executedActions.push(`Drink Reminder: ${String(res.summary || drinkAction.type)}`);
    onEmotion('joy');
    return {
      role: 'assistant',
      content: `💧 ${String(res.summary || 'Updated drink reminder.')}`,
      emotion: 'joy',
      toolActions: executedActions,
    };
  }

  // 12C. Built-in Music Player Commands
  const musicAction = parseMusicPlayerCommand(userText);
  if (musicAction) {
    const res = await executeMusicToolAction(musicAction);
    executedActions.push(`Music Player: ${String(res.summary || musicAction.type)}`);
    onEmotion('joy');
    return {
      role: 'assistant',
      content: `🎵 ${String(res.summary || 'Updated Music Player.')}`,
      emotion: 'joy',
      toolActions: executedActions,
    };
  }

  // 12D. Digital Wellbeing & Read-Only Task Manager Commands
  const wellbeingAction = parseWellbeingCommand(userText);
  if (wellbeingAction) {
    const res = await executeWellbeingToolAction(wellbeingAction);
    executedActions.push(`Wellbeing & Tasks: ${String(res.summary || wellbeingAction.type)}`);
    onEmotion('joy');
    return {
      role: 'assistant',
      content: `📊 ${String(res.summary || 'Opened Digital Wellbeing & Tasks.')}`,
      emotion: 'joy',
      toolActions: executedActions,
    };
  }

  // 13. Web Search Engine Integration for explicit factual / research queries!
  const searchQuery = cfg.search_engine_enabled ? shouldSearchWeb(userText) : null;
  if (searchQuery && searchQuery.length >= 2) {
    onEmotion('curiosity');
    onToolStart(`Searching web for "${searchQuery}"...`);
    try {
      const searchResults = await performWebSearchAndStore(searchQuery, cfg.google_account_email, 5);
      onToolStart(null);
      if (searchResults.length > 0) {
        executedActions.push(
          `Web Search Engine: "${searchQuery}" (${searchResults.length} results saved to database)`
        );
        const top = searchResults[0];
        const citations = searchResults
          .map((r, i) => `${i + 1}. **[${r.title}](${r.url})** *(${r.source})*\n   ${r.snippet}`)
          .join('\n\n');

        onEmotion('joy');
        return {
          role: 'assistant',
          content: `${top.snippet}\n\n### 🌐 Sources & Citations (Saved to Database)\n${citations}`,
          emotion: 'joy',
          toolActions: executedActions,
        };
      }
    } catch {
      onToolStart(null);
    }
  }

  // 14. Local CLI Agent fallback / primary dispatch (OpenCode, KiloCode, or custom CLI agent)
  if (userText.length > 0) {
    onEmotion('curiosity');
    try {
      const cliOpts = { model: cfg.local_ai_model };
      const customCli = (cfg.agent_cli_command || '').trim();
      const customBinLower = customCli.toLowerCase();

      const primaryRes =
        cfg.local_ai_runtime === 'kilocode'
          ? await executeKiloCodePrompt(userText, onToolStart, cliOpts)
          : customCli &&
              customBinLower !== 'opencode' &&
              customBinLower !== 'kilocode' &&
              customBinLower !== 'kilo'
            ? await executeCliAgentPrompt(customCli, userText, onToolStart, cliOpts)
            : await executeOpenCodePrompt(userText, onToolStart, cliOpts);

      const finalAgentRes =
        primaryRes && primaryRes.success && primaryRes.output.trim().length > 0
          ? primaryRes
          : cfg.local_ai_runtime === 'kilocode'
            ? await executeOpenCodePrompt(userText, onToolStart, cliOpts)
            : await executeKiloCodePrompt(userText, onToolStart, cliOpts);

      if (finalAgentRes && finalAgentRes.success && finalAgentRes.output.trim().length > 0) {
        if (finalAgentRes.toolActions && finalAgentRes.toolActions.length > 0) {
          executedActions.push(...finalAgentRes.toolActions);
        }
        onEmotion('joy');
        return {
          role: 'assistant',
          content: finalAgentRes.output,
          emotion: 'joy',
          toolActions: executedActions.length > 0 ? executedActions : undefined,
        };
      }
    } catch {
      // Fall through to conversational response
    }
  }

  // 15. Conversational Memory-Aware Response
  onEmotion('curiosity');
  return {
    role: 'assistant',
    content: `Got it${rememberedName ? `, **${rememberedName}**` : ''}! I've logged your message in our local database.\n\nIn **Local AI Mode**, you can:\n• Ask me to **search the web** (e.g., *"search for Rust Tauri 2"*)\n• Share facts or preferences for me to **remember**\n• Ask me to **open apps**, check **system specs**, calculate **math**, or start a **timer**\n• Or start **Ollama** (\`ollama serve\`) in the **Settings** panel for full local LLM generation!`,
    emotion: 'curiosity',
    toolActions: executedActions.length > 0 ? executedActions : undefined,
  };
}

function cleanText(s: string): string {
  return s.trim().replace(/\s+/g, ' ');
}
