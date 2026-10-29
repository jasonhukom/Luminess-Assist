import React, { useState } from 'react';
import { X, Lock, Mail, User, Sparkles, AlertCircle, CheckCircle2 } from 'lucide-react';

const GithubIcon: React.FC<{ size?: number; className?: string }> = ({ size = 16, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
  </svg>
);
import {
  type PlatformUser,
  registerUserAccount,
  loginUserAccount,
} from '../lib/botPlatformStore.ts';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (user: PlatformUser) => void;
  initialMode?: 'login' | 'register';
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  initialMode = 'login',
}) => {
  const [mode, setMode] = useState<'login' | 'register'>(initialMode);
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [githubUsername, setGithubUsername] = useState('');
  const [bio, setBio] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (mode === 'login') {
        const res = await loginUserAccount({ username, password });
        if ('error' in res) {
          setError(res.error);
        } else {
          onSuccess(res.user);
          onClose();
        }
      } else {
        const res = await registerUserAccount({
          username,
          email,
          password,
          displayName,
          bio,
          githubUsername,
        });
        if ('error' in res) {
          setError(res.error);
        } else {
          onSuccess(res.user);
          onClose();
        }
      }
    } catch (err: any) {
      setError(err?.message || 'Authentication error.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
      <div className="relative w-full max-w-md bg-[#fafaf9] dark:bg-[#120f0d] border border-[#dad7d0] dark:border-white/10 rounded-2xl shadow-2xl p-6 sm:p-8">
        
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-5 right-5 p-1 rounded-full text-[#5e534a] dark:text-[#a89c92] hover:text-[#080503] dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5 transition-all"
        >
          <X size={18} />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-[#080503] dark:bg-[#fafaf9] text-[#fafaf9] dark:text-[#080503] flex items-center justify-center font-bold">
            <Sparkles size={20} />
          </div>
          <div>
            <h3 className="font-display text-lg font-bold text-[#080503] dark:text-[#fafaf9]">
              {mode === 'login' ? 'Welcome Back' : 'Create Luminess Account'}
            </h3>
            <p className="text-xs text-[#5e534a] dark:text-[#a89c92]">
              {mode === 'login'
                ? 'Sign in to publish bots & sync your GitHub fork'
                : 'Join the community & share custom companions'}
            </p>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center gap-2 text-xs text-red-600 dark:text-red-400">
            <AlertCircle size={15} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-[11px] font-mono uppercase tracking-wider text-[#5e534a] dark:text-[#a89c92] mb-1">
              {mode === 'login' ? 'Username or Email' : 'Username'}
            </label>
            <div className="relative">
              <User size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#5e534a] opacity-50" />
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder={mode === 'login' ? 'jasonhukom or email' : 'e.g. cyber_pilot'}
                className="w-full pl-10 pr-4 py-2 text-sm bg-white dark:bg-black/40 border border-[#dad7d0] dark:border-white/10 rounded-xl focus:outline-none focus:border-[#38bdf8] text-[#080503] dark:text-white"
              />
            </div>
          </div>

          {mode === 'register' && (
            <>
              <div>
                <label className="block text-[11px] font-mono uppercase tracking-wider text-[#5e534a] dark:text-[#a89c92] mb-1">
                  Your Full Name
                </label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="e.g. Jason Hukom"
                  className="w-full px-4 py-2 text-sm bg-white dark:bg-black/40 border border-[#dad7d0] dark:border-white/10 rounded-xl focus:outline-none focus:border-[#38bdf8] text-[#080503] dark:text-white"
                />
              </div>

              <div>
                <label className="block text-[11px] font-mono uppercase tracking-wider text-[#5e534a] dark:text-[#a89c92] mb-1">
                  Email Address
                </label>
                <div className="relative">
                  <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#5e534a] opacity-50" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@domain.com"
                    className="w-full pl-10 pr-4 py-2 text-sm bg-white dark:bg-black/40 border border-[#dad7d0] dark:border-white/10 rounded-xl focus:outline-none focus:border-[#38bdf8] text-[#080503] dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-mono uppercase tracking-wider text-[#5e534a] dark:text-[#a89c92] mb-1">
                  GitHub Username (For repo fork connection)
                </label>
                <div className="relative">
                  <GithubIcon size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#5e534a] opacity-50" />
                  <input
                    type="text"
                    value={githubUsername}
                    onChange={(e) => setGithubUsername(e.target.value)}
                    placeholder="e.g. jasonhukom"
                    className="w-full pl-10 pr-4 py-2 text-sm bg-white dark:bg-black/40 border border-[#dad7d0] dark:border-white/10 rounded-xl focus:outline-none focus:border-[#38bdf8] text-[#080503] dark:text-white"
                  />
                </div>
                <p className="text-[10px] text-[#5e534a] dark:text-[#a89c92] mt-1">
                  Connects to fork <span className="font-mono text-[#38bdf8]">jasonhukom/Luminess-Assist</span> like Vercel.
                </p>
              </div>
            </>
          )}

          <div>
            <label className="block text-[11px] font-mono uppercase tracking-wider text-[#5e534a] dark:text-[#a89c92] mb-1">
              Password
            </label>
            <div className="relative">
              <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#5e534a] opacity-50" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-10 pr-4 py-2 text-sm bg-white dark:bg-black/40 border border-[#dad7d0] dark:border-white/10 rounded-xl focus:outline-none focus:border-[#38bdf8] text-[#080503] dark:text-white"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 py-2.5 rounded-xl bg-[#080503] dark:bg-[#fafaf9] text-[#fafaf9] dark:text-[#080503] text-sm font-semibold tracking-wide hover:opacity-90 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {loading ? (
              <span className="animate-spin">⏳</span>
            ) : mode === 'login' ? (
              'Sign In'
            ) : (
              'Create Account'
            )}
          </button>
        </form>

        {/* Toggle Mode */}
        <div className="mt-5 text-center text-xs text-[#5e534a] dark:text-[#a89c92]">
          {mode === 'login' ? (
            <>
              Don't have an account?{' '}
              <button
                type="button"
                onClick={() => {
                  setMode('register');
                  setError(null);
                }}
                className="font-semibold text-[#080503] dark:text-white hover:underline cursor-pointer"
              >
                Sign Up
              </button>
            </>
          ) : (
            <>
              Already have an account?{' '}
              <button
                type="button"
                onClick={() => {
                  setMode('login');
                  setError(null);
                }}
                className="font-semibold text-[#080503] dark:text-white hover:underline cursor-pointer"
              >
                Sign In
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
