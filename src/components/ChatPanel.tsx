import { useRef, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import './ChatPanel.css';
import { Send, X, Settings, Loader2, Bot, User } from 'lucide-react';
import type { Message } from '../lib/gemini.ts';

interface ChatPanelProps {
  messages: Message[];
  isProcessing: boolean;
  activeTool: string | null;
  onSendMessage: (text: string) => void;
  onClose: () => void;
}

export function ChatPanel({ messages, isProcessing, activeTool, onSendMessage, onClose }: ChatPanelProps) {
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isProcessing, activeTool]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (input.trim()) {
      onSendMessage(input);
      setInput('');
    }
  };

  return (
    <div className="chat-panel">
      <div className="chat-header">
        <div className="chat-title">
          <Bot size={18} className="text-primary" />
          <span>Luminess Assist</span>
        </div>
        <div className="chat-actions">
          <button className="icon-btn"><Settings size={16} /></button>
          <button className="icon-btn" onClick={onClose}><X size={16} /></button>
        </div>
      </div>

      <div className="chat-messages">
        {messages.length === 0 && (
          <div className="empty-state">
            <Bot size={48} />
            <p>Hello! How can I help you today?</p>
          </div>
        )}
        {messages.map((msg, idx) => (
          <div key={idx} className={`message-wrapper ${msg.role}`}>
            <div className="message-bubble">
              {msg.role === 'user' ? <User size={14} className="msg-icon" /> : <Bot size={14} className="msg-icon" />}
              <div className="message-content">
                {msg.content}
                {msg.emotion && <span className="emotion-tag">[{msg.emotion}]</span>}
              </div>
            </div>
          </div>
        ))}
        {isProcessing && !activeTool && (
          <div className="message-wrapper assistant processing">
            <div className="message-bubble">
              <Loader2 size={14} className="msg-icon spin" />
              <div className="message-content">Thinking...</div>
            </div>
          </div>
        )}
        {activeTool && (
          <div className="message-wrapper assistant tool-executing">
            <div className="message-bubble">
              <Loader2 size={14} className="msg-icon spin text-primary" />
              <div className="message-content">Executing: {activeTool}</div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <form className="chat-input-area" onSubmit={handleSubmit}>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask me anything..."
          disabled={isProcessing}
          autoFocus
        />
        <button type="submit" disabled={!input.trim() || isProcessing} className="send-btn">
          <Send size={16} />
        </button>
      </form>
    </div>
  );
}
