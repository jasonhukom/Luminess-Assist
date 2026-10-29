import React from 'react';
import {
  X,
  GitFork,
  ExternalLink,
  Plus,
  LogOut,
  Sparkles,
  Heart,
  Bot,
  Video,
  Layers,
  Calendar,
} from 'lucide-react';

const GithubIcon: React.FC<{ size?: number; className?: string }> = ({ size = 16, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
  </svg>
);
import {
  type PlatformUser,
  type BotProfile,
} from '../lib/botPlatformStore.ts';

interface UserProfileModalProps {
  user: PlatformUser | null;
  userBots: BotProfile[];
  isOpen: boolean;
  onClose: () => void;
  onLogout: () => void;
  onCreateNewBot: () => void;
  onSelectBot: (bot: BotProfile) => void;
}

export const UserProfileModal: React.FC<UserProfileModalProps> = ({
  user,
  userBots,
  isOpen,
  onClose,
  onLogout,
  onCreateNewBot,
  onSelectBot,
}) => {
  if (!isOpen || !user) return null;

  const githubUser = user.githubUsername || user.username;
  const githubRepoUrl = user.githubRepoUrl || `https://github.com/${githubUser}/Luminess-Assist`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
      <div className="relative w-full max-w-2xl bg-[#fafaf9] dark:bg-[#120f0d] border border-[#dad7d0] dark:border-white/10 rounded-2xl shadow-2xl p-6 sm:p-8 max-h-[90vh] overflow-y-auto">
        
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-5 right-5 p-1 rounded-full text-[#5e534a] dark:text-[#a89c92] hover:text-[#080503] dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5 transition-all"
        >
          <X size={18} />
        </button>

        {/* User Profile Header (GitHub / Vercel style) */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-[#dad7d0]/60 dark:border-white/10">
          <div className="flex items-center gap-4">
            <img
              src={user.avatarUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${user.username}`}
              alt={user.displayName || user.username}
              className="w-16 h-16 rounded-2xl border-2 border-[#38bdf8]/40 object-cover bg-white/5 shadow-md"
            />
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-display text-xl font-bold text-[#080503] dark:text-[#fafaf9]">
                  {user.displayName || user.username}
                </h3>
                <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded-full bg-[#080503]/5 dark:bg-white/10 text-[#080503] dark:text-white uppercase">
                  {user.role}
                </span>
              </div>
              <p className="text-xs font-mono text-[#5e534a] dark:text-[#a89c92]">
                @{user.username} &bull; Member since {user.createdAt}
              </p>
              {user.bio && (
                <p className="text-xs text-[#5e534a] dark:text-[#a89c92] mt-1 max-w-md">
                  {user.bio}
                </p>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={onLogout}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-red-500/20 text-red-600 dark:text-red-400 text-xs font-medium hover:bg-red-500/5 transition-all cursor-pointer"
          >
            <LogOut size={13} />
            <span>Sign Out</span>
          </button>
        </div>

        {/* GitHub Fork Integration Box (like Vercel) */}
        <div className="my-6 p-4 rounded-xl bg-white dark:bg-black/30 border border-[#dad7d0] dark:border-white/10">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <GithubIcon size={16} className="text-[#080503] dark:text-white" />
              <span className="text-xs font-semibold text-[#080503] dark:text-white">
                Connected GitHub Repository
              </span>
            </div>
            <span className="flex items-center gap-1 text-[10px] font-mono font-medium text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Fork Synchronized
            </span>
          </div>

          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 font-mono text-xs text-[#38bdf8]">
              <GitFork size={13} />
              <a
                href={githubRepoUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:underline flex items-center gap-1"
              >
                {githubUser}/Luminess-Assist
                <ExternalLink size={11} className="opacity-70" />
              </a>
            </div>
            <span className="text-[11px] text-[#5e534a] dark:text-[#a89c92]">
              Base Template: <span className="font-mono text-[#080503] dark:text-white">jasonhukom/Luminess-Assist</span>
            </span>
          </div>
        </div>

        {/* User's Created Bots */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bot size={16} className="text-[#38bdf8]" />
              <h4 className="text-sm font-bold text-[#080503] dark:text-white">
                My Bot Creations ({userBots.length})
              </h4>
            </div>
            <button
              type="button"
              onClick={() => {
                onClose();
                onCreateNewBot();
              }}
              className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-[#080503] dark:bg-[#fafaf9] text-[#fafaf9] dark:text-[#080503] text-xs font-semibold hover:opacity-90 transition-all cursor-pointer"
            >
              <Plus size={13} />
              <span>Create New Bot</span>
            </button>
          </div>

          {userBots.length === 0 ? (
            <div className="py-8 text-center border border-dashed border-[#dad7d0] dark:border-white/10 rounded-xl">
              <Sparkles size={24} className="mx-auto text-[#5e534a] dark:text-[#a89c92] mb-2 opacity-50" />
              <p className="text-xs text-[#5e534a] dark:text-[#a89c92]">
                You haven't created any custom bots yet.
              </p>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onCreateNewBot();
                }}
                className="mt-3 text-xs font-semibold text-[#38bdf8] hover:underline cursor-pointer"
              >
                Launch Bot Studio & Customize Look →
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {userBots.map((b) => (
                <div
                  key={b.id}
                  onClick={() => {
                    onSelectBot(b);
                    onClose();
                  }}
                  className="p-3.5 rounded-xl bg-white dark:bg-black/30 border border-[#dad7d0] dark:border-white/10 hover:border-[#38bdf8] transition-all cursor-pointer group"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-semibold text-xs text-[#080503] dark:text-white group-hover:text-[#38bdf8] transition-colors">
                      {b.botName}
                    </span>
                    <span className="flex items-center gap-1 text-[10px] text-pink-500 font-mono">
                      <Heart size={10} fill="currentColor" /> {b.likesCount}
                    </span>
                  </div>

                  <p className="text-[11px] text-[#5e534a] dark:text-[#a89c92] line-clamp-1 mb-2">
                    {b.tagline}
                  </p>

                  <div className="flex items-center justify-between text-[10px] font-mono text-[#5e534a] dark:text-[#a89c92]">
                    <span className="capitalize px-1.5 py-0.5 rounded bg-black/5 dark:bg-white/5 flex items-center gap-1">
                      {b.visualMode === 'video' && <Video size={10} />}
                      {b.visualMode === 'sprite_frames' && <Layers size={10} />}
                      {b.visualMode}
                    </span>
                    <span className="text-[#38bdf8]">{b.pairingCode}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
