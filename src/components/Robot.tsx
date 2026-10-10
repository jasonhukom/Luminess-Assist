import { useState } from 'react';
import type { MouseEvent } from 'react';
import './Robot.css';
import { invoke } from '@tauri-apps/api/core';

export type Emotion = 
  | 'joy' | 'sadness' | 'anger' | 'fear' | 'surprise' 
  | 'disgust' | 'curiosity' | 'confusion' | 'love' 
  | 'embarrassment' | 'idle';

interface RobotProps {
  emotion: Emotion;
  onClick: () => void;
}

export function Robot({ emotion, onClick }: RobotProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [dragTimer, setDragTimer] = useState<number | null>(null);

  const handleMouseDown = (e: MouseEvent) => {
    if (e.button !== 0) return; // Only left click
    
    // Distinguish between click and drag
    const timer = window.setTimeout(() => {
      setIsDragging(true);
      invoke('start_drag');
    }, 150);
    setDragTimer(timer);
  };

  const handleMouseUp = () => {
    if (dragTimer) {
      window.clearTimeout(dragTimer);
      setDragTimer(null);
    }
    if (!isDragging) {
      onClick();
    }
    setIsDragging(false);
  };

  return (
    <div 
      className={`robot-container emotion-${emotion}`}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
    >
      <div className="robot-glow-bg"></div>
      <svg className="robot-svg" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <radialGradient id="screen-glare" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="rgba(255,255,255,0.15)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0)" />
          </radialGradient>
        </defs>

        {/* Antennas */}
        <rect x="95" y="10" width="10" height="40" rx="5" className="robot-antenna-stem" />
        <circle cx="100" cy="10" r="10" className="robot-antenna-bulb" />

        {/* Ear panels */}
        <rect x="25" y="80" width="20" height="40" rx="10" className="robot-ear" />
        <rect x="155" y="80" width="20" height="40" rx="10" className="robot-ear" />

        {/* Head */}
        <rect x="40" y="40" width="120" height="120" rx="35" className="robot-head" />
        
        {/* Screen Base */}
        <rect x="50" y="55" width="100" height="85" rx="20" className="robot-screen" />
        
        {/* Dynamic Eyes */}
        <g className="eyes-container">
            <path className="eye left-eye" />
            <path className="eye right-eye" />
            <path className="mouth" />
        </g>
        
        {/* Screen Glare Overlay */}
        <rect x="50" y="55" width="100" height="85" rx="20" fill="url(#screen-glare)" />
      </svg>
    </div>
  );
}
