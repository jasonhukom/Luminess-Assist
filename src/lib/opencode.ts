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
  kind: 'ollama' | 'openai_compatible' | 'opencode' | 'kilocode' | 'builtin';
  endpoint: string;
  online: boolean;
  models: string[];
  notes: string;
}

export type LocalAiServerStatus = LocalAiServerInfo;

export type LocalCliAgentKind = 'opencode' | 'kilocode' | 'custom';

async function checkCliAgentStatus(
  candidates: string[],
  label: string,
  installPackage: string
): Promise<OpenCodeStatus> {
  for (const bin of candidates) {
    try {
      const res: any = await invoke('execute_pc_command', {
        command: `${bin} --version`,
        cwd: null,
      });

      if (res && res.exit_code === 0 && res.stdout) {
        return {
          installed: true,
          version: String(res.stdout).trim(),
          command: bin,
          notes: `${label} CLI (${bin}) is installed and ready for local autonomous agent tasks.`,
        };
      }
    } catch {
      // Try next binary alias
    }
  }

  return {
    installed: false,
    notes: `${label} is not detected on PATH. Install with: npm install -g ${installPackage}`,
  };
}

/**
 * Checks if the OpenCode CLI is available on the local PC.
 */
export async function checkOpenCodeStatus(): Promise<OpenCodeStatus> {
  return checkCliAgentStatus(['opencode'], 'OpenCode', 'opencode-ai');
}

/**
 * Checks if the KiloCode CLI (@kilocode/cli -> kilocode / kilo) is available on the local PC.
 */
export async function checkKiloCodeStatus(): Promise<OpenCodeStatus> {
  return checkCliAgentStatus(['kilocode', 'kilo'], 'KiloCode', '@kilocode/cli');
}

export async function checkLocalAgentsStatus(): Promise<{
  opencode: OpenCodeStatus;
  kilocode: OpenCodeStatus;
}> {
  const [opencode, kilocode] = await Promise.all([
    checkOpenCodeStatus(),
    checkKiloCodeStatus(),
  ]);
  return { opencode, kilocode };
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
    compatibility_notes: 'Supports Ollama, llama.cpp, OpenCode, KiloCode, and Built-in Local AI.',
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
      name: 'OpenCode CLI Local Agent',
      kind: 'opencode',
      endpoint: 'cli://opencode',
      online: true,
      models: ['opencode-local-agent'],
      notes: 'Autonomous OpenCode CLI coding & desktop agent (`opencode run --auto`).',
    },
    {
      name: 'KiloCode CLI Local Agent',
      kind: 'kilocode',
      endpoint: 'cli://kilocode',
      online: true,
      models: ['kilocode-local-agent'],
      notes: 'Autonomous KiloCode CLI local agent (`kilo run --auto` / `kilocode run --auto`).',
    },
    {
      name: 'Luminess Native Local AI + Agents',
      kind: 'builtin',
      endpoint: 'local://luminess-native',
      online: true,
      models: ['luminess-local-v2', 'opencode-local-agent', 'kilocode-local-agent'],
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
 * Shared local CLI autonomous agent runner for OpenCode, KiloCode, and custom CLI tools.
 */
export async function executeCliAgentPrompt(
  agent: LocalCliAgentKind | string,
  prompt: string,
  onToolStart?: (status: string | null) => void,
  options?: { model?: string; cwd?: string }
): Promise<OpenCodeExecutionResult> {
  const cleanAgent = (agent || 'opencode').trim();
  const isKilo = cleanAgent === 'kilocode' || cleanAgent === 'kilo';
  const label = isKilo ? 'KiloCode' : cleanAgent === 'opencode' ? 'OpenCode' : cleanAgent;
  const candidateBins = isKilo ? ['kilocode', 'kilo'] : [cleanAgent];

  onToolStart?.(`${label} Agent: Running prompt locally...`);

  try {
    const utf8Bytes = new TextEncoder().encode(prompt);
    let binary = '';
    for (let i = 0; i < utf8Bytes.length; i++) {
      binary += String.fromCharCode(utf8Bytes[i]);
    }
    const b64 = btoa(binary);
    const modelArg =
      options?.model &&
      !['opencode-default', 'kilocode-default', 'luminess-local-v2', ''].includes(
        options.model.trim()
      )
        ? options.model.trim()
        : '';

    const binsLiteral = candidateBins.map((b) => `'${b.replace(/'/g, "''")}'`).join(', ');
    const modelLiteral = modelArg.replace(/'/g, "''");

    const psScript = [
      `$bytes = [System.Convert]::FromBase64String('${b64}')`,
      '$promptText = [System.Text.Encoding]::UTF8.GetString($bytes)',
      `$bins = @(${binsLiteral})`,
      '$selectedBin = $null',
      'foreach ($b in $bins) { if (Get-Command $b -ErrorAction SilentlyContinue) { $selectedBin = $b; break } }',
      'if (-not $selectedBin) { Write-Output "__LUMINESS_CLI_MISSING__"; exit 0 }',
      `$modelArg = '${modelLiteral}'`,
      '$job = Start-Job -ScriptBlock { param($bin, $p, $m) Set-Location $env:TEMP; if ($m) { & $bin run --auto --model $m $p 2>&1 } else { & $bin run --auto $p 2>&1 } } -ArgumentList $selectedBin, $promptText, $modelArg',
      'if (Wait-Job $job -Timeout 20) { Receive-Job $job } else { Stop-Job $job; Remove-Job $job -Force; Write-Output "" }',
    ].join('\n');

    const result: any = await invoke('execute_pc_command', {
      command: psScript,
      cwd: options?.cwd || null,
    });

    const raw =
      typeof result === 'string'
        ? result.trim()
        : (result?.stdout || '').trim();
    if (
      raw &&
      raw !== '__LUMINESS_CLI_MISSING__' &&
      !raw.includes('Unknown flag') &&
      !raw.includes('command not found') &&
      !raw.includes('is not recognized') &&
      !raw.includes('ECONNREFUSED')
    ) {
      const formattedOutput =
        raw === 'ok'
          ? `**${label} Local AI Agent** executed your prompt:\n\n> ${prompt}`
          : raw;
      return {
        output: formattedOutput,
        success: true,
        toolActions: [
          `${label} Agent executed prompt: "${prompt.slice(0, 45)}${prompt.length > 45 ? '...' : ''}"`,
        ],
      };
    }

    return {
      output: '',
      success: false,
      error: raw === '__LUMINESS_CLI_MISSING__' ? `${label} CLI not found on PATH.` : undefined,
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

/**
 * Executes a user prompt through OpenCode CLI for offline assistant and agent workflows.
 */
export async function executeOpenCodePrompt(
  prompt: string,
  onToolStart?: (status: string | null) => void,
  options?: { model?: string; cwd?: string }
): Promise<OpenCodeExecutionResult> {
  return executeCliAgentPrompt('opencode', prompt, onToolStart, options);
}

/**
 * Executes a user prompt through KiloCode CLI (@kilocode/cli -> kilocode / kilo).
 */
export async function executeKiloCodePrompt(
  prompt: string,
  onToolStart?: (status: string | null) => void,
  options?: { model?: string; cwd?: string }
): Promise<OpenCodeExecutionResult> {
  return executeCliAgentPrompt('kilocode', prompt, onToolStart, options);
}
