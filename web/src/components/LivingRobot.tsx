import React, { useState, useEffect, useRef } from 'react';
import { Sparkles, Heart, Zap, Smile, HelpCircle, Eye } from 'lucide-react';

export type MascotEmotion = 'idle' | 'joy' | 'curiosity' | 'love' | 'surprise' | 'thinking';

interface LivingRobotProps {
  currentEmotion?: MascotEmotion;
  onEmotionChange?: (emotion: MascotEmotion) => void;
  size?: number;
  interactive?: boolean;
}

const FACES: Record<MascotEmotion, {
  leftEye: string;
  rightEye: string;
  leftBrow?: string;
  rightBrow?: string;
  mouth: string;
  blush?: boolean;
  glowColor: string;
  statusText: string;
}> = {
  idle: {
    leftEye: 'M 65 94 C 65 86, 85 86, 85 94 C 85 102, 65 102, 65 94',
    rightEye: 'M 115 94 C 115 86, 135 86, 135 94 C 135 102, 115 102, 115 94',
    mouth: 'M 88 116 Q 100 120 112 116',
    glowColor: '#38bdf8',
    statusText: 'ONLINE & READY',
  },
  joy: {
    leftEye: 'M 60 98 Q 75 74 90 98 Q 75 84 60 98',
    rightEye: 'M 110 98 Q 125 74 140 98 Q 125 84 110 98',
    leftBrow: 'M 62 76 Q 75 70 88 75',
    rightBrow: 'M 112 75 Q 125 70 138 76',
    mouth: 'M 86 111 Q 100 125 114 111',
    blush: true,
    glowColor: '#22d3ee',
    statusText: 'DELIGHTED',
  },
  love: {
    leftEye: 'M 65 92 Q 75 76 85 92 Q 75 102 65 92',
    rightEye: 'M 115 92 Q 125 76 135 92 Q 125 102 115 92',
    leftBrow: 'M 62 75 Q 75 68 88 75',
    rightBrow: 'M 112 75 Q 125 68 138 75',
    mouth: 'M 87 114 Q 100 126 113 114',
    blush: true,
    glowColor: '#f472b6',
    statusText: 'LOVES YOU',
  },
  curiosity: {
    leftEye: 'M 65 94 C 65 84, 85 84, 85 94 C 85 104, 65 104, 65 94',
    rightEye: 'M 115 94 C 115 88, 135 88, 135 94 C 135 100, 115 100, 115 94',
    leftBrow: 'M 62 72 Q 75 72 88 76',
    rightBrow: 'M 112 76 Q 125 78 138 82',
    mouth: 'M 93 115 Q 100 122 107 115',
    glowColor: '#a855f7',
    statusText: 'INSPECTING DESKTOP',
  },
  surprise: {
    leftEye: 'M 65 94 C 65 80, 85 80, 85 94 C 85 108, 65 108, 65 94',
    rightEye: 'M 115 94 C 115 80, 135 80, 135 94 C 135 108, 115 108, 115 94',
    leftBrow: 'M 62 68 Q 75 64 88 70',
    rightBrow: 'M 112 70 Q 125 64 138 68',
    mouth: 'M 94 112 C 94 107, 106 107, 106 112 C 106 119, 94 119, 94 112',
    glowColor: '#fb923c',
    statusText: 'WHOA!',
  },
  thinking: {
    leftEye: 'M 65 94 C 65 88, 85 88, 85 94 C 85 100, 65 100, 65 94',
    rightEye: 'M 115 94 C 115 86, 135 86, 135 94 C 135 102, 115 102, 115 94',
    leftBrow: 'M 62 76 Q 75 78 88 80',
    rightBrow: 'M 112 72 Q 125 68 138 72',
    mouth: 'M 90 117 L 110 115',
    glowColor: '#818cf8',
    statusText: 'SYNTHESIZING...',
  },
};

// Web Audio API chime generator (zero external assets needed)
function playRobotChime(freq = 660, type: OscillatorType = 'sine') {
  try {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(freq * 1.5, ctx.currentTime + 0.15);

    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.36);
  } catch {
    // Audio might be muted by browser autoplay policy
  }
}

export const LivingRobot: React.FC<LivingRobotProps> = ({
  currentEmotion: externalEmotion,
  onEmotionChange,
  size = 280,
  interactive = true,
}) => {
  const [internalEmotion, setInternalEmotion] = useState<MascotEmotion>('idle');
  const [blink, setBlink] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [mouseOffset, setMouseOffset] = useState({ x: 0, y: 0 });
  const [clickSparks, setClickSparks] = useState<number[]>([]);
  const robotRef = useRef<HTMLDivElement>(null);

  const activeEmotion = externalEmotion || internalEmotion;
  const face = FACES[activeEmotion] || FACES.idle;

  // Natural blinking
  useEffect(() => {
    const blinkInterval = setInterval(() => {
      setBlink(true);
      setTimeout(() => setBlink(false), 140);
    }, 3800 + Math.random() * 2000);
    return () => clearInterval(blinkInterval);
  }, []);

  // Eye tracking based on mouse movement
  useEffect(() => {
    if (!interactive) return;
    const handleMouseMove = (e: MouseEvent) => {
      if (!robotRef.current) return;
      const rect = robotRef.current.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const dx = (e.clientX - centerX) / (window.innerWidth / 2);
      const dy = (e.clientY - centerY) / (window.innerHeight / 2);
      setMouseOffset({
        x: Math.max(-6, Math.min(6, dx * 7)),
        y: Math.max(-5, Math.min(5, dy * 6)),
      });
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, [interactive]);

  const handleRobotClick = () => {
    playRobotChime(activeEmotion === 'joy' ? 880 : 540, 'triangle');
    setClickSparks((prev) => [...prev, Date.now()]);
    setTimeout(() => {
      setClickSparks((prev) => prev.slice(1));
    }, 700);

    const emotionList: MascotEmotion[] = ['joy', 'love', 'curiosity', 'surprise', 'thinking', 'idle'];
    const nextIdx = (emotionList.indexOf(activeEmotion) + 1) % emotionList.length;
    const nextEmotion = emotionList[nextIdx];
    setInternalEmotion(nextEmotion);
    onEmotionChange?.(nextEmotion);
  };

  return (
    <div className="flex flex-col items-center select-none" ref={robotRef}>
      {/* Telemetry Status Pill */}
      <div 
        className="flex items-center gap-2 px-3 py-1 rounded-full text-xs font-mono font-medium tracking-wide border mb-3 transition-all duration-300 backdrop-blur-md"
        style={{
          backgroundColor: `${face.glowColor}15`,
          borderColor: `${face.glowColor}40`,
          color: face.glowColor,
          boxShadow: `0 0 20px -5px ${face.glowColor}30`,
        }}
      >
        <span className="w-2 h-2 rounded-full animate-ping" style={{ backgroundColor: face.glowColor }} />
        <span>LUMINESS // {face.statusText}</span>
      </div>

      {/* Robot Wrapper */}
      <div
        className="relative group cursor-pointer transition-transform duration-300 active:scale-95"
        style={{ width: size, height: size }}
        onClick={handleRobotClick}
        onMouseEnter={() => {
          setIsHovered(true);
          playRobotChime(620, 'sine');
        }}
        onMouseLeave={() => setIsHovered(false)}
        title="Click to interact with Luminess!"
      >
        {/* Floating Heart / Sparks on Click */}
        {clickSparks.map((sparkId) => (
          <div
            key={sparkId}
            className="absolute top-4 left-1/2 -translate-x-1/2 -translate-y-full pointer-events-none animate-bounce text-pink-400 flex items-center gap-1 z-30"
          >
            <Heart size={20} className="fill-current animate-pulse" />
            <Sparkles size={16} className="text-cyan-300" />
          </div>
        ))}

        {/* Ambient Radial Backglow */}
        <div
          className="absolute inset-4 rounded-full blur-3xl opacity-40 transition-all duration-500 pointer-events-none"
          style={{
            backgroundColor: face.glowColor,
            transform: isHovered ? 'scale(1.2)' : 'scale(1)',
            opacity: isHovered ? 0.65 : 0.4,
          }}
        />

        {/* SVG Robot Mascot */}
        <svg
          viewBox="0 0 200 200"
          width="100%"
          height="100%"
          className="relative z-10 transition-transform duration-300"
          style={{
            transform: `translate(${mouseOffset.x}px, ${mouseOffset.y}px)`,
          }}
        >
          {/* Shadow */}
          <ellipse cx="100" cy="184" rx="46" ry="7" fill="rgba(0,0,0,0.5)" filter="blur(4px)" />

          {/* Ears */}
          <g className="transition-transform duration-300" style={{ transformOrigin: '28px 100px' }}>
            <rect
              x="22"
              y="82"
              width="14"
              height="36"
              rx="7"
              fill="#181c2b"
              stroke={face.glowColor}
              strokeWidth="2.5"
            />
            <rect
              x="26"
              y="90"
              width="6"
              height="20"
              rx="3"
              fill={face.glowColor}
              opacity="0.8"
            />
          </g>
          <g className="transition-transform duration-300" style={{ transformOrigin: '172px 100px' }}>
            <rect
              x="164"
              y="82"
              width="14"
              height="36"
              rx="7"
              fill="#181c2b"
              stroke={face.glowColor}
              strokeWidth="2.5"
            />
            <rect
              x="168"
              y="90"
              width="6"
              height="20"
              rx="3"
              fill={face.glowColor}
              opacity="0.8"
            />
          </g>

          {/* Antenna */}
          <line
            x1="100"
            y1="48"
            x2="100"
            y2="28"
            stroke={face.glowColor}
            strokeWidth="3.5"
            strokeLinecap="round"
          />
          <circle
            cx="100"
            cy="24"
            r="8"
            fill="#a855f7"
            stroke="#ffffff"
            strokeWidth="1.5"
            className="animate-pulse"
          />

          {/* Head Body Glass Shield */}
          <rect
            x="40"
            y="48"
            width="120"
            height="112"
            rx="36"
            fill="#0f1322"
            stroke={face.glowColor}
            strokeWidth="3"
            style={{
              filter: `drop-shadow(0 0 16px ${face.glowColor}60)`,
            }}
          />

          {/* Inner Visor Display Screen */}
          <rect
            x="48"
            y="56"
            width="104"
            height="96"
            rx="28"
            fill="#080a12"
          />

          {/* Subtle Visor Scanline Grid */}
          <line x1="52" y1="78" x2="148" y2="78" stroke="rgba(255,255,255,0.04)" strokeWidth="1" />
          <line x1="52" y1="104" x2="148" y2="104" stroke="rgba(255,255,255,0.04)" strokeWidth="1" />
          <line x1="52" y1="130" x2="148" y2="130" stroke="rgba(255,255,255,0.04)" strokeWidth="1" />

          {/* Blush Checkmarks */}
          {face.blush && (
            <>
              <circle cx="62" cy="116" r="6" fill="#f472b6" opacity="0.45" filter="blur(2px)" />
              <circle cx="138" cy="116" r="6" fill="#f472b6" opacity="0.45" filter="blur(2px)" />
            </>
          )}

          {/* Eyebrows */}
          {face.leftBrow && (
            <path
              d={face.leftBrow}
              stroke={face.glowColor}
              strokeWidth="2.5"
              strokeLinecap="round"
              fill="none"
            />
          )}
          {face.rightBrow && (
            <path
              d={face.rightBrow}
              stroke={face.glowColor}
              strokeWidth="2.5"
              strokeLinecap="round"
              fill="none"
            />
          )}

          {/* Animated Eyes (with Blink transition) */}
          <g
            style={{
              transform: blink ? 'scaleY(0.08)' : 'scaleY(1)',
              transformOrigin: '100px 94px',
              transition: 'transform 0.08s ease',
            }}
          >
            <path
              d={face.leftEye}
              fill={face.glowColor}
              style={{ filter: `drop-shadow(0 0 6px ${face.glowColor})` }}
            />
            <path
              d={face.rightEye}
              fill={face.glowColor}
              style={{ filter: `drop-shadow(0 0 6px ${face.glowColor})` }}
            />
          </g>

          {/* Mouth */}
          <path
            d={face.mouth}
            stroke={face.glowColor}
            strokeWidth="3"
            strokeLinecap="round"
            fill="none"
            style={{ filter: `drop-shadow(0 0 4px ${face.glowColor})` }}
          />

          {/* Glass Specular Glare Reflection */}
          <path
            d="M 56 64 Q 100 58 144 64"
            stroke="rgba(255, 255, 255, 0.28)"
            strokeWidth="2"
            strokeLinecap="round"
            fill="none"
          />
        </svg>
      </div>

      {/* Emotion Switcher Toolbar */}
      {interactive && (
        <div className="flex items-center gap-1.5 mt-4 p-1.5 rounded-xl bg-white/[0.04] border border-white/[0.08] backdrop-blur-md">
          {(['idle', 'joy', 'curiosity', 'love', 'surprise', 'thinking'] as MascotEmotion[]).map((emo) => {
            const isSelected = activeEmotion === emo;
            return (
              <button
                key={emo}
                type="button"
                onClick={() => {
                  setInternalEmotion(emo);
                  onEmotionChange?.(emo);
                  playRobotChime(emo === 'love' ? 740 : 580);
                }}
                className={`px-2.5 py-1 text-xs font-mono rounded-lg capitalize transition-all duration-200 ${
                  isSelected
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-400/40 shadow-[0_0_12px_rgba(56,189,248,0.3)] font-semibold'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.05]'
                }`}
              >
                {emo}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
