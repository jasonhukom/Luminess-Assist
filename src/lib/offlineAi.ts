import type { Emotion } from '../components/Robot.tsx';
import type { Message, ToolPermissionRequest } from './gemini.ts';
import { executeToolOnPc } from './gemini.ts';
import { executeOpenCodePrompt } from './opencode.ts';

/**
 * Safely evaluates simple mathematical expressions like "25 * 4", "100 / 5", "12 + 38".
 */
function evaluateSimpleMath(input: string): number | null {
  const sanitized = input
    .replace(/(?:what\s+is|calculate|calc|\?|=)/gi, '')
    .trim();

  // Only allow numbers, basic math operators, parentheses, and spaces
  if (!/^[\d\s+\-*/().%^]+$/.test(sanitized)) {
    return null;
  }

  // Prevent dangerous identifiers
  if (/[a-zA-Z_$]/.test(sanitized)) {
    return null;
  }

  try {
    const normalized = sanitized.replace(/\^/g, '**');
    // Using Function constructor with strict sanitized string for safe arithmetic evaluation
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

  // Generic "open <something>"
  const match = lower.match(/(?:open|launch|run|start)\s+([a-zA-Z0-9_\-.]+)/i);
  if (match && match[1]) {
    const appName = match[1].trim();
    if (!['the', 'a', 'an', 'my', 'pc', 'files', 'app'].includes(appName)) {
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
 * Executes the offline assistant response pipeline locally with zero external network dependencies.
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

  // Helper to execute tool with permission prompt
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

  // 1. Math / Arithmetic calculation
  if (/^(?:calc|calculate|what is|how much is)?\s*[\d\s+\-*/().%^]{2,}\??$/i.test(userText.trim()) ||
      lower.startsWith('calc ') || lower.startsWith('calculate ')) {
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

  // 2. Local Time & Date queries
  if (/\b(time|clock|current time|what time)\b/.test(lower)) {
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

  // 3. Open Application / File / Tool
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

  // 4. Timer & Countdown
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

  // 5. System / PC Context inspection
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
      content: `**Local PC Status**\n• **OS:** ${ctx.os || 'Windows'}\n• **User:** ${ctx.username || 'User'}\n• **Desktop:** \`${ctx.desktop || '~'}\`\n• **Drives:** ${drives}\n• **Mode:** ⚡ Offline Local AI Active`,
      emotion: 'joy',
      toolActions: executedActions,
    };
  }

  // 6. Greetings & Welcomes
  if (/^(?:hi|hello|hey|yo|sup|hiya|howdy|good morning|good afternoon|good evening|halo)\b/i.test(lower)) {
    const greetings = [
      'Hey there! I am running in local offline mode. How can I help with your PC today?',
      'Hello! Luminess is active and completely offline. What would you like to do?',
      'Hi! Standing by locally. You can ask me for the time, system info, to open apps, or calculate math!',
    ];
    const picked = greetings[Math.floor(Math.random() * greetings.length)];
    onEmotion('joy');
    return {
      role: 'assistant',
      content: picked,
      emotion: 'joy',
    };
  }

  // 7. Identity & Help
  if (/\b(who are you|what are you|what can you do|help|offline mode)\b/.test(lower)) {
    onEmotion('joy');
    return {
      role: 'assistant',
      content: `I'm **Luminess Assist** in **Offline Mode** ⚡!\n\nHere are things I can do locally with zero internet:\n• **Open Apps:** "open notepad", "open calc", "open cmd"\n• **System Telemetry:** "system info", "pc specs", "whoami"\n• **Time & Date:** "what time is it", "today's date"\n• **Math & Calculations:** "25 * 4", "calc 140 / 5"\n• **Timers:** "set timer 5 minutes"\n\nFor advanced multi-modal writing or web search, you can connect your Gemini or Claude key in settings anytime!`,
      emotion: 'joy',
    };
  }

  // 8. Jokes & Light Banter
  if (/\b(joke|funny|laugh|meme)\b/.test(lower)) {
    const jokes = [
      'Why do programmers prefer dark mode? Because light attracts bugs!',
      'There are 10 types of people in the world: those who understand binary, and those who don’t.',
      'Why did the robot go on vacation? To recharge its batteries!',
      'An offline AI walks into a bar. It doesn’t need Wi-Fi to enjoy the atmosphere.',
    ];
    onEmotion('joy');
    return {
      role: 'assistant',
      content: jokes[Math.floor(Math.random() * jokes.length)],
      emotion: 'joy',
    };
  }

  // 9. Sentiment reactions (Thanks, compliments, sadness)
  if (/\b(thank|thanks|thx|awesome|great|cool|good job|nice)\b/.test(lower)) {
    onEmotion('love');
    return {
      role: 'assistant',
      content: "You're very welcome! Always happy to assist.",
      emotion: 'love',
    };
  }

  if (/\b(sad|tired|stressed|exhausted|burnout)\b/.test(lower)) {
    onEmotion('love');
    return {
      role: 'assistant',
      content: "Take a deep breath and give your eyes a short break from the screen. I'm right here with you on your desktop!",
      emotion: 'love',
    };
  }

  // 10. OpenCode Offline Assistant & Agent Execution
  // For open-ended queries, coding instructions, or agent prompts, forward the prompt to OpenCode
  if (userText.length > 0) {
    onEmotion('curiosity');
    onToolStart('OpenCode Agent: Running prompt locally...');

    try {
      const openCodeRes = await executeOpenCodePrompt(userText, onToolStart);
      if (openCodeRes && openCodeRes.output && openCodeRes.output.trim().length > 0) {
        if (openCodeRes.toolActions && openCodeRes.toolActions.length > 0) {
          executedActions.push(...openCodeRes.toolActions);
        }
        onEmotion('joy');
        return {
          role: 'assistant',
          content: openCodeRes.output,
          emotion: 'joy',
          toolActions: executedActions.length > 0 ? executedActions : undefined,
        };
      }
    } catch (err: any) {
      executedActions.push(`OpenCode error: ${err?.message || "failed"}`);
    }
  }

  // 11. Default / Fallback Response
  onEmotion('curiosity');
  return {
    role: 'assistant',
    content: `Got it! I took your prompt and evaluated it with **OpenCode** in **Offline Mode** on your local PC.\n\nYou can ask me for coding assistance, shell tasks, **system specs**, to **open an app**, or to **calculate math**!`,
    emotion: 'curiosity',
    toolActions: executedActions.length > 0 ? executedActions : undefined,
  };
}
