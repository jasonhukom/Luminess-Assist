import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  Search,
  Filter,
  Heart,
  MessageSquare,
  GitFork,
  ExternalLink,
  Play,
  Pause,
  Bot,
  Video,
  Layers,
  Image as ImageIcon,
  Send,
  X,
  Copy,
  Check,
  Plus,
} from 'lucide-react';
import {
  type BotProfile,
  type PlatformUser,
  likeBotCreation,
  testBotChat,
} from '../lib/botPlatformStore.ts';
import { LivingRobot } from './LivingRobot.tsx';

interface ShowcaseTabProps {
  communityBots: BotProfile[];
  currentUser: PlatformUser | null;
  onSelectBotForStudio: (bot: BotProfile) => void;
  onCreateNewBot: () => void;
  onOpenAuth: () => void;
  onUpdateBotLikes: (botId: string, newCount: number) => void;
}

export const ShowcaseTab: React.FC<ShowcaseTabProps> = ({
  communityBots,
  currentUser,
  onSelectBotForStudio,
  onCreateNewBot,
  onOpenAuth,
  onUpdateBotLikes,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'sprite_frames' | 'video' | 'robot' | 'image'>('all');
  const [activeChatBot, setActiveChatBot] = useState<BotProfile | null>(null);
  const [chatMessages, setChatMessages] = useState<Array<{ sender: 'user' | 'bot'; text: string; time: string }>>([]);
  const [chatInput, setChatInput] = useState('');
  const [isChatting, setIsChatting] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // Filter bots
  const filteredBots = communityBots.filter((bot) => {
    const matchesQuery =
      bot.botName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      bot.tagline.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (bot.creator?.displayName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (bot.creator?.username || '').toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesQuery) return false;
    if (selectedFilter === 'all') return true;
    return bot.visualMode === selectedFilter;
  });

  const handleLike = async (e: React.MouseEvent, botId: string) => {
    e.stopPropagation();
    const newCount = await likeBotCreation(botId);
    onUpdateBotLikes(botId, newCount);
  };

  const handleCopyCode = (e: React.MouseEvent, code: string) => {
    e.stopPropagation();
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const openChatWithBot = (bot: BotProfile) => {
    setActiveChatBot(bot);
    setChatMessages([
      {
        sender: 'bot',
        text: bot.greetingMessage || `Hello! I am ${bot.botName}. How can I assist your workflow today?`,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ]);
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || !activeChatBot || isChatting) return;

    const userText = chatInput.trim();
    setChatInput('');
    const timeNow = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    setChatMessages((prev) => [...prev, { sender: 'user', text: userText, time: timeNow }]);
    setIsChatting(true);

    try {
      const res = await testBotChat(activeChatBot.id, userText, activeChatBot);
      setChatMessages((prev) => [
        ...prev,
        { sender: 'bot', text: res.reply, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) },
      ]);
    } catch {
      setChatMessages((prev) => [
        ...prev,
        { sender: 'bot', text: `[${activeChatBot.botName}]: Acknowledged, Pilot! Synced with MariaDB.`, time: timeNow },
      ]);
    } finally {
      setIsChatting(false);
    }
  };

  return (
    <div className="relative pt-28 pb-20 px-6 max-w-[1400px] mx-auto min-h-screen">
      
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row items-start md:items-end justify-between gap-6 mb-10 pb-8 border-b border-[#dad7d0]/60 dark:border-white/10">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-600 dark:text-cyan-400 text-xs font-mono font-medium mb-3">
            <Sparkles size={13} />
            <span>MariaDB Community Hub &bull; GitHub Fork Network</span>
          </div>
          <h1 className="font-display text-3xl sm:text-4xl font-extrabold tracking-tight text-[#080503] dark:text-[#fafaf9]">
            Community Bot Universe
          </h1>
          <p className="text-sm text-[#5e534a] dark:text-[#a89c92] mt-2 max-w-2xl">
            Explore AI desktop companions created by users worldwide. Each bot features custom
            visual looks (per-frame sprite cycles, video loops, interactive avatars), customizable chat prompts,
            and full GitHub repository fork synchronization.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onCreateNewBot}
            className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-[#080503] dark:bg-[#fafaf9] text-[#fafaf9] dark:text-[#080503] text-xs font-semibold tracking-wide hover:opacity-90 transition-all cursor-pointer shadow-md"
          >
            <Plus size={14} />
            <span>Create Your Bot</span>
          </button>
        </div>
      </div>

      {/* Search & Filter Toolbar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 mb-8">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#5e534a] opacity-50" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by bot name, creator, or prompt archetype..."
            className="w-full pl-10 pr-4 py-2.5 text-xs bg-white dark:bg-[#120f0d] border border-[#dad7d0] dark:border-white/10 rounded-full focus:outline-none focus:border-[#38bdf8] text-[#080503] dark:text-white"
          />
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
          {(
            [
              { key: 'all', label: 'All Bots', icon: null },
              { key: 'sprite_frames', label: 'Frame Sprites', icon: Layers },
              { key: 'video', label: 'Video Loops', icon: Video },
              { key: 'robot', label: 'Living Robots', icon: Bot },
              { key: 'image', label: 'Custom Images', icon: ImageIcon },
            ] as const
          ).map((filter) => {
            const Icon = filter.icon;
            const isActive = selectedFilter === filter.key;
            return (
              <button
                key={filter.key}
                type="button"
                onClick={() => setSelectedFilter(filter.key)}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-medium transition-all whitespace-nowrap cursor-pointer ${
                  isActive
                    ? 'bg-[#080503] dark:bg-white text-white dark:text-black shadow-sm'
                    : 'bg-black/5 dark:bg-white/5 text-[#5e534a] dark:text-[#a89c92] hover:bg-black/10 dark:hover:bg-white/10'
                }`}
              >
                {Icon && <Icon size={12} />}
                <span>{filter.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Bot Cards Grid */}
      {filteredBots.length === 0 ? (
        <div className="py-20 text-center border border-dashed border-[#dad7d0] dark:border-white/10 rounded-3xl">
          <Bot size={36} className="mx-auto text-[#5e534a] dark:text-[#a89c92] mb-3 opacity-40" />
          <h3 className="font-display text-base font-bold text-[#080503] dark:text-white">
            No bots found matching your filter
          </h3>
          <p className="text-xs text-[#5e534a] dark:text-[#a89c92] mt-1">
            Try adjusting your search terms or be the first to create one!
          </p>
          <button
            type="button"
            onClick={onCreateNewBot}
            className="mt-4 px-4 py-2 rounded-full bg-[#38bdf8] text-black text-xs font-semibold hover:opacity-90 transition-all cursor-pointer"
          >
            Create New Bot in Studio
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredBots.map((bot) => (
            <BotCard
              key={bot.id}
              bot={bot}
              onChat={() => openChatWithBot(bot)}
              onCustomize={() => onSelectBotForStudio(bot)}
              onLike={(e) => handleLike(e, bot.id)}
              onCopyCode={(e) => handleCopyCode(e, bot.pairingCode)}
              isCopied={copiedCode === bot.pairingCode}
            />
          ))}
        </div>
      )}

      {/* Interactive Live Chat Modal */}
      {activeChatBot && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="relative w-full max-w-lg bg-[#fafaf9] dark:bg-[#120f0d] border border-[#dad7d0] dark:border-white/10 rounded-2xl shadow-2xl flex flex-col h-[580px] overflow-hidden">
            
            {/* Header */}
            <div className="p-4 border-b border-[#dad7d0]/60 dark:border-white/10 flex items-center justify-between bg-white/40 dark:bg-black/40">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-black/5 dark:bg-white/10 flex items-center justify-center overflow-hidden">
                  {botVisualThumbnail(activeChatBot)}
                </div>
                <div>
                  <h4 className="font-display text-sm font-bold text-[#080503] dark:text-white">
                    {activeChatBot.botName}
                  </h4>
                  <p className="text-[10px] font-mono text-emerald-500 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Online &bull; Archetype: {activeChatBot.personality?.archetype || 'companion'}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setActiveChatBot(null)}
                className="p-1 rounded-full text-[#5e534a] dark:text-[#a89c92] hover:text-[#080503] dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5 transition-all"
              >
                <X size={18} />
              </button>
            </div>

            {/* Chat Body */}
            <div className="flex-1 p-4 overflow-y-auto space-y-3">
              {chatMessages.map((msg, i) => (
                <div
                  key={i}
                  className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-xs shadow-sm ${
                      msg.sender === 'user'
                        ? 'bg-[#080503] dark:bg-[#fafaf9] text-[#fafaf9] dark:text-[#080503] rounded-br-xs'
                        : 'bg-white dark:bg-[#1a1614] border border-[#dad7d0] dark:border-white/10 text-[#080503] dark:text-white rounded-bl-xs'
                    }`}
                  >
                    <p className="leading-relaxed">{msg.text}</p>
                  </div>
                  <span className="text-[9px] font-mono text-[#5e534a] dark:text-[#a89c92] mt-1 px-1">
                    {msg.time}
                  </span>
                </div>
              ))}
              {isChatting && (
                <div className="flex items-center gap-2 text-xs text-[#5e534a] dark:text-[#a89c92]">
                  <span className="animate-spin text-sm">⚡</span>
                  <span className="font-mono text-[11px]">{activeChatBot.botName} is thinking...</span>
                </div>
              )}
            </div>

            {/* Input Bar */}
            <form onSubmit={handleSendMessage} className="p-3 border-t border-[#dad7d0]/60 dark:border-white/10 bg-white/40 dark:bg-black/40 flex items-center gap-2">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder={`Message ${activeChatBot.botName}...`}
                className="flex-1 px-3.5 py-2 text-xs bg-white dark:bg-black/40 border border-[#dad7d0] dark:border-white/10 rounded-xl focus:outline-none focus:border-[#38bdf8] text-[#080503] dark:text-white"
              />
              <button
                type="submit"
                disabled={!chatInput.trim() || isChatting}
                className="p-2 rounded-xl bg-[#080503] dark:bg-[#fafaf9] text-[#fafaf9] dark:text-[#080503] hover:opacity-90 transition-all cursor-pointer disabled:opacity-40"
              >
                <Send size={15} />
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

// ========================================================
// Bot Card Component with Animated Preview
// ========================================================

interface BotCardProps {
  bot: BotProfile;
  onChat: () => void;
  onCustomize: () => void;
  onLike: (e: React.MouseEvent) => void;
  onCopyCode: (e: React.MouseEvent) => void;
  isCopied: boolean;
}

const BotCard: React.FC<BotCardProps> = ({
  bot,
  onChat,
  onCustomize,
  onLike,
  onCopyCode,
  isCopied,
}) => {
  const [currentFrameIndex, setCurrentFrameIndex] = useState(0);
  const [isPlayingFrames, setIsPlayingFrames] = useState(true);

  const frames = bot.framesConfig || [];
  const hasFrames = bot.visualMode === 'sprite_frames' && frames.length > 0;

  // Frame cycle loop
  useEffect(() => {
    if (!hasFrames || !isPlayingFrames || frames.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentFrameIndex((prev) => (prev + 1) % frames.length);
    }, 400);
    return () => clearInterval(interval);
  }, [hasFrames, isPlayingFrames, frames.length]);

  const creatorName = bot.creator?.displayName || bot.creator?.username || 'Community Pilot';
  const githubRepo = bot.githubRepo || `${bot.creator?.username || 'user'}/Luminess-Assist`;
  const githubUrl = bot.githubRepoUrl || `https://github.com/${githubRepo}`;

  return (
    <div className="group relative rounded-2xl bg-[#fafaf9] dark:bg-[#120f0d] border border-[#dad7d0] dark:border-white/10 overflow-hidden shadow-sm hover:shadow-xl hover:border-[#38bdf8]/60 transition-all duration-300 flex flex-col justify-between">
      
      {/* Visual Media Canvas */}
      <div className="relative h-48 w-full bg-[#080503] overflow-hidden flex items-center justify-center border-b border-[#dad7d0]/40 dark:border-white/10">
        {bot.visualMode === 'video' && bot.videoUrl ? (
          <video
            src={bot.videoUrl}
            autoPlay
            loop
            muted
            playsInline
            className="w-full h-full object-cover"
          />
        ) : hasFrames ? (
          <div className="relative w-full h-full flex items-center justify-center bg-black/60">
            <img
              src={frames[currentFrameIndex]?.url || bot.avatarImageUrl}
              alt={bot.botName}
              className="max-h-40 max-w-full object-contain pixelated transition-transform group-hover:scale-105"
            />
            {/* Frame indicator badge */}
            <div className="absolute bottom-2 left-2 px-2 py-0.5 rounded-full bg-black/70 backdrop-blur-sm text-[9px] font-mono text-white/80 flex items-center gap-1">
              <Layers size={10} />
              <span>Frame {currentFrameIndex + 1}/{frames.length}</span>
            </div>
          </div>
        ) : bot.visualMode === 'image' && bot.avatarImageUrl ? (
          <img
            src={bot.avatarImageUrl}
            alt={bot.botName}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center p-4">
            <LivingRobot
              size={120}
              currentEmotion="idle"
              interactive={false}
            />
          </div>
        )}

        {/* Visual Mode Pill Overlay */}
        <div className="absolute top-3 left-3">
          <span className="px-2.5 py-1 rounded-full bg-black/60 backdrop-blur-md text-[10px] font-mono font-medium text-white/90 flex items-center gap-1 border border-white/10">
            {bot.visualMode === 'video' && <Video size={11} className="text-purple-400" />}
            {bot.visualMode === 'sprite_frames' && <Layers size={11} className="text-pink-400" />}
            {bot.visualMode === 'robot' && <Bot size={11} className="text-cyan-400" />}
            {bot.visualMode === 'image' && <ImageIcon size={11} className="text-amber-400" />}
            <span className="capitalize">{bot.visualMode.replace('_', ' ')}</span>
          </span>
        </div>

        {/* Likes Button */}
        <button
          type="button"
          onClick={onLike}
          className="absolute top-3 right-3 px-2.5 py-1 rounded-full bg-black/60 backdrop-blur-md hover:bg-black/80 text-white text-xs font-mono flex items-center gap-1.5 transition-all cursor-pointer border border-white/10"
        >
          <Heart size={13} className="text-pink-500 fill-pink-500" />
          <span>{bot.likesCount}</span>
        </button>
      </div>

      {/* Content */}
      <div className="p-5 flex-1 flex flex-col justify-between">
        <div>
          {/* Creator Attribution */}
          <div className="flex items-center gap-2 mb-2">
            <img
              src={bot.creator?.avatarUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${bot.creator?.username || bot.botName}`}
              alt={creatorName}
              className="w-5 h-5 rounded-full object-cover bg-black/10"
            />
            <span className="text-xs text-[#5e534a] dark:text-[#a89c92]">
              by <span className="font-semibold text-[#080503] dark:text-white">@{bot.creator?.username || 'creator'}</span>
            </span>
          </div>

          <h3 className="font-display text-base font-bold text-[#080503] dark:text-white mb-1">
            {bot.botName}
          </h3>
          <p className="text-xs text-[#5e534a] dark:text-[#a89c92] line-clamp-2 leading-relaxed mb-3">
            {bot.tagline}
          </p>

          {/* GitHub Fork Link (like Vercel) */}
          <div className="flex items-center justify-between p-2 rounded-xl bg-black/5 dark:bg-white/5 text-[11px] font-mono mb-4">
            <a
              href={githubUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-[#38bdf8] hover:underline"
              onClick={(e) => e.stopPropagation()}
            >
              <GitFork size={12} />
              <span className="truncate max-w-[180px]">{githubRepo}</span>
              <ExternalLink size={10} className="opacity-70" />
            </a>
            <span className="text-[9px] text-[#5e534a] dark:text-[#a89c92]">
              Forked
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="space-y-2 pt-2 border-t border-[#dad7d0]/40 dark:border-white/10">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onChat}
              className="flex-1 py-2 px-3 rounded-xl bg-[#080503] dark:bg-[#fafaf9] text-[#fafaf9] dark:text-[#080503] text-xs font-semibold hover:opacity-90 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <MessageSquare size={13} />
              <span>Test Chat</span>
            </button>

            <button
              type="button"
              onClick={onCustomize}
              className="py-2 px-3 rounded-xl border border-[#dad7d0] dark:border-white/15 text-[#080503] dark:text-white text-xs font-medium hover:bg-black/5 dark:hover:bg-white/5 transition-all cursor-pointer"
              title="Open in Bot Studio"
            >
              Customize
            </button>
          </div>

          <div className="flex items-center justify-between text-[10px] font-mono text-[#5e534a] dark:text-[#a89c92] px-1">
            <span>Pair Code: <span className="text-[#38bdf8] font-bold">{bot.pairingCode}</span></span>
            <button
              type="button"
              onClick={onCopyCode}
              className="flex items-center gap-1 hover:text-[#080503] dark:hover:text-white cursor-pointer"
            >
              {isCopied ? <Check size={11} className="text-emerald-500" /> : <Copy size={11} />}
              <span>{isCopied ? 'Copied' : 'Copy'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

function botVisualThumbnail(bot: BotProfile) {
  if (bot.visualMode === 'video' && bot.videoUrl) {
    return <Video size={18} className="text-purple-400" />;
  }
  if (bot.visualMode === 'sprite_frames' && bot.framesConfig && bot.framesConfig.length > 0) {
    return <img src={bot.framesConfig[0].url} alt="" className="w-full h-full object-cover" />;
  }
  if (bot.avatarImageUrl) {
    return <img src={bot.avatarImageUrl} alt="" className="w-full h-full object-cover" />;
  }
  return <Bot size={18} className="text-cyan-400" />;
}
