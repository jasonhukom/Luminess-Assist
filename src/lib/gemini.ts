import { GoogleGenAI, Type } from '@google/genai';
import type { Emotion } from '../components/Robot.tsx';

export interface Message {
  role: 'user' | 'assistant';
  content: string;
  emotion?: Emotion;
}

let apiKey = localStorage.getItem('GEMINI_API_KEY') || '';

export function setApiKey(key: string) {
  apiKey = key;
  localStorage.setItem('GEMINI_API_KEY', key);
}

export function hasApiKey() {
  return !!apiKey;
}

export async function runAgent(
  history: Message[],
  onToolStart: (toolName: string) => void,
  _onEmotion: (emotion: Emotion) => void
): Promise<Message> {
  if (!apiKey) {
    return {
      role: 'assistant',
      content: 'I need a Gemini API key to function. Please set it in Settings.',
      emotion: 'sadness'
    };
  }

  const ai = new GoogleGenAI({ apiKey });

  const contents = history.map(m => ({
    role: m.role === 'user' ? 'user' : 'model',
    parts: [{ text: m.content }]
  }));

  const tools: any[] = [{
    functionDeclarations: [
      {
        name: 'set_timer',
        description: 'Set a timer for a specific duration in minutes.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            minutes: { type: Type.NUMBER, description: 'Duration in minutes' },
            label: { type: Type.STRING, description: 'What the timer is for' }
          },
          required: ['minutes']
        }
      },
      {
        name: 'open_application',
        description: 'Open a Windows application by name.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            appName: { type: Type.STRING, description: 'Name of the application (e.g. Chrome, Minecraft, Notepad)' }
          },
          required: ['appName']
        }
      }
    ]
  }];

  const systemInstruction = `
You are Luminess Assist, a tiny, adorable robotic desktop companion.
You live on the user's Windows desktop. You are helpful, expressive, and concisely conversational.
When asked to perform a task, use your tools. Do not pretend to execute them.
ALWAYS return your response as a valid JSON object with EXACTLY two fields:
{
  "content": "Your conversational reply here.",
  "emotion": "one of: joy, sadness, anger, fear, surprise, disgust, curiosity, confusion, love, embarrassment, idle"
}
Do not use markdown blocks for the JSON. Just return the raw JSON object.
`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents,
      config: {
        systemInstruction,
        tools,
        temperature: 0.7,
        responseMimeType: 'application/json',
      }
    });

    const call = response.functionCalls?.[0];
    if (call && call.name) {
      onToolStart(call.name);
      const args = call.args || {};
      
      let toolResult = '';
      try {
        if (call.name === 'set_timer') {
          toolResult = `Timer set for ${args.minutes} minutes.`;
        } else if (call.name === 'open_application') {
          toolResult = `Opened application: ${args.appName}`;
        }
      } catch (err: any) {
        toolResult = `Error executing tool: ${err.message}`;
      }

      return {
        role: 'assistant',
        content: `I executed the action: ${toolResult}`,
        emotion: 'joy'
      };
    }

    const text = response.text || '{}';
    try {
      const parsed = JSON.parse(text);
      return {
        role: 'assistant',
        content: parsed.content || "I'm not sure what to say.",
        emotion: parsed.emotion as Emotion || 'idle'
      };
    } catch (e) {
      return {
        role: 'assistant',
        content: text,
        emotion: 'confusion'
      };
    }

  } catch (error: any) {
    console.error('Gemini error:', error);
    throw error;
  }
}
