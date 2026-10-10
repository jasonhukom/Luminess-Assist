import { useState, useEffect } from 'react';
import './App.css';
import { Robot } from './components/Robot.tsx';
import type { Emotion } from './components/Robot.tsx';
import { ChatPanel } from './components/ChatPanel.tsx';
import { runAgent } from './lib/gemini.ts';
import type { Message } from './lib/gemini.ts';

function App() {
  const [chatOpen, setChatOpen] = useState(false);
  const [emotion, setEmotion] = useState<Emotion>('idle');
  const [messages, setMessages] = useState<Message[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeTool, setActiveTool] = useState<string | null>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setChatOpen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleRobotClick = () => {
    setChatOpen((prev) => !prev);
  };

  const handleSendMessage = async (text: string) => {
    if (!text.trim() || isProcessing) return;

    const userMsg: Message = { role: 'user', content: text };
    const newHistory = [...messages, userMsg];
    setMessages(newHistory);
    setIsProcessing(true);
    setEmotion('curiosity');

    try {
      const responseMsg = await runAgent(
        newHistory, 
        (toolName) => setActiveTool(toolName),
        (emo) => setEmotion(emo)
      );
      setMessages([...newHistory, responseMsg]);
      if (responseMsg.emotion) setEmotion(responseMsg.emotion);
      else setEmotion('joy');
    } catch (e: any) {
      setMessages([...newHistory, { role: 'assistant', content: `Error: ${e.message}`, emotion: 'sadness' }]);
      setEmotion('sadness');
    } finally {
      setIsProcessing(false);
      setActiveTool(null);
    }
  };

  return (
    <div className="app-container">
      <div className="robot-wrapper">
        <Robot emotion={emotion} onClick={handleRobotClick} />
      </div>
      
      {chatOpen && (
        <div className="chat-panel-wrapper">
          <ChatPanel 
            messages={messages} 
            isProcessing={isProcessing} 
            activeTool={activeTool}
            onSendMessage={handleSendMessage}
            onClose={() => setChatOpen(false)}
          />
        </div>
      )}
    </div>
  );
}

export default App;
