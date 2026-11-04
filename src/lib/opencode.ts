import { invoke } from '@tauri-apps/api/core';

export interface OpenCodeStatus {
  installed: boolean;
  version?: string;
  command?: string;
  notes?: string;
}

export interface OpenCodeExecutionResult {
  output: string;
  success: boolean;
  toolActions?: string[];
  error?: string;
}

export interface LocalAiHardwareReport {
  total_ram_gb: number;
  available_ram_gb: number;
  cpu_cores: number;
  gpu_name: string;
  free_disk_gb: number;
  hardware_tier: string;
  recommended_runtime: string;
  recommended_model: string;
  compatibility_notes: string;
}

export interface LocalAiServerInfo {
  name: string;
  kind: 'ollama' | 'openai_compatible' | 'opencode' | 'builtin';
  endpoint: string;
  online: boolean;
  models: string[];
  notes: string;
}

/**
 * Checks if the OpenCode CLI is available on the local PC.
 */
export async function checkOpenCodeStatus(): Promise<OpenCodeStatus> {
  try {
    const res: any = await invoke('execute_pc_command', {
      command: 'opencode --version',
      cwd: null,
    });

    if (res && res.exit_code === 0 && res.stdout) {
      return {
        installed: true,
        version: res.stdout.trim(),
        command: 'opencode',
        notes: 'OpenCode CLI is installed and ready for local offline agent tasks.',
      };
    }
  } catch {
    // Non-fatal, check alternative
  }

  return {
    installed: false,
    notes: 'OpenCode is not installed globally on PATH. Built-in Local AI and Ollama / OpenAI-compatible servers are active.',
  };
}

/**
 * Inspects local hardware (RAM, CPU cores, free disk) and recommends a local AI model/runtime.
 */
export async function inspectLocalAiHardware(): Promise<LocalAiHardwareReport> {
  try {
    const report = await invoke<LocalAiHardwareReport>('check_local_ai_hardware');
    if (report) return report;
  } catch {
    // Fallback outside Tauri
  }
  return {
    total_ram_gb: 16,
    available_ram_gb: 8,
    cpu_cores: 8,
    gpu_name: 'System GPU',
    free_disk_gb: 10,
    hardware_tier: 'Standard Desktop (16 GB RAM, 8 cores)',
    recommended_runtime: 'ollama',
    recommended_model: 'qwen2.5-coder:3b',
    compatibility_notes: 'Supports Ollama, llama.cpp, OpenCode, and Built-in Local AI.',
  };
}

/**
 * Probes local AI model servers (Ollama :11434, llama.cpp :8080, LM Studio :1234, and Built-in runtime).
 */
export async function discoverLocalAiServers(): Promise<LocalAiServerInfo[]> {
  try {
    const servers = await invoke<LocalAiServerInfo[]>('probe_local_ai_servers');
    if (Array.isArray(servers) && servers.length > 0) return servers;
  } catch {
    // Fallback outside Tauri
  }
  return [
    {
      name: 'Ollama Local Server',
      kind: 'ollama',
      endpoint: 'http://127.0.0.1:11434',
      online: false,
      models: ['qwen2.5-coder:latest', 'llama3.2:latest'],
      notes: 'Start Ollama (`ollama serve`) to use local GGUF models.',
    },
    {
      name: 'Luminess Native Local AI + OpenCode',
      kind: 'builtin',
      endpoint: 'local://luminess-native',
      online: true,
      models: ['luminess-local-v2', 'opencode-local-agent'],
      notes: 'Always-on local conversational engine with PC tool execution, persistent memory, and web search.',
    },
  ];
}

/**
 * Calls an online local model server (Ollama, llama.cpp, LM Studio, or OpenAI-compatible local API).
 */
export async function callLocalModelServer(
  endpoint: string,
  model: string,
  messages: Array<{ role: string; content: string }>
): Promise<string | null> {
  try {
    const reply = await invoke<string>('local_ai_chat_completion', {
      endpoint,
      model,
      messages,
    });
    if (reply && reply.trim().length > 0) {
      return reply.trim();
    }
  } catch {
    // Try direct browser fetch to OpenAI-compatible local server as fallback
    try {
      const base = endpoint.trim().replace(/\/+$/, '');
      const url = base.endsWith('/v1') ? `${base}/chat/completions` : `${base}/v1/chat/completions`;
      const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          messages,
          temperature: 0.6,
          stream: false,
        }),
      });
      if (resp.ok) {
        const data: any = await resp.json();
        const text = data?.choices?.[0]?.message?.content || data?.message?.content;
        if (typeof text === 'string' && text.trim()) {
          return text.trim();
        }
      }
    } catch {
      // Server not reachable
    }
  }
  return null;
}

/**
 * Executes a user prompt through OpenCode CLI for offline assistant and agent workflows.
 * Fixed for OpenCode v2: removed deprecated `--pure` flag and runs in safe TEMP working directory
 * with a strict timeout so it never hangs.
 */
export async function executeOpenCodePrompt(
  prompt: string,
  onToolStart?: (status: string | null) => void
): Promise<OpenCodeExecutionResult> {
  onToolStart?.('OpenCode Agent: Running prompt locally...');

  try {
    const utf8Bytes = new TextEncoder().encode(prompt);
    let binary = '';
    for (let i = 0; i < utf8Bytes.length; i++) {
      binary += String.fromCharCode(utf8Bytes[i]);
    }
    const b64 = btoa(binary);

    // Run OpenCode v2 (`opencode run --auto`) inside $env:TEMP with a 12s timeout job so it never blocks
    const psScript = [
      `$bytes = [System.Convert]::FromBase64String('${b64}')`,
      '$promptText = [System.Text.Encoding]::UTF8.GetString($bytes)',
      '$job = Start-Job -ScriptBlock { param($p) Set-Location $env:TEMP; opencode run --auto $p 2>&1 } -ArgumentList $promptText',
      'if (Wait-Job $job -Timeout 12) { Receive-Job $job } else { Stop-Job $job; Remove-Job $job -Force; Write-Output "" }',
    ].join('\n');

    const result: any = await invoke('execute_pc_command', {
      command: psScript,
      cwd: null,
    });

    const raw = (result?.stdout || '').trim();
    if (
      raw &&
      !raw.includes('Unknown flag') &&
      !raw.includes('command not found') &&
      !raw.includes('is not recognized') &&
      !raw.includes('ECONNREFUSED')
    ) {
      return {
        output: raw,
        success: true,
        toolActions: [`OpenCode Agent executed prompt: "${prompt.slice(0, 45)}${prompt.length > 45 ? '...' : ''}"`],
      };
    }

    return {
      output: '',
      success: false,
    };
  } catch (err: any) {
    return {
      output: '',
      success: false,
      error: err?.message || String(err),
    };
  } finally {
    onToolStart?.(null);
  }
}
