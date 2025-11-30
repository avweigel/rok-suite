'use client';

import { useState } from 'react';
import { LogIn, LogOut, User, ChevronDown } from 'lucide-react';
import { useAuth } from '@/lib/supabase/auth-context';

export function UserMenu() {
  const { user, loading, signInWithDiscord, signInWithGoogle, signOut } = useAuth();
  const [showDropdown, setShowDropdown] = useState(false);
  const [showLoginOptions, setShowLoginOptions] = useState(false);

  if (loading) {
    return (
      <div className="w-8 h-8 rounded-full bg-stone-700 animate-pulse" />
    );
  }

  if (!user) {
    return (
      <div className="relative">
        <button
          onClick={() => setShowLoginOptions(!showLoginOptions)}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gradient-to-r from-amber-600 to-amber-700 text-stone-900 font-semibold hover:from-amber-500 hover:to-amber-600 transition-all"
        >
          <LogIn className="w-4 h-4" />
          <span className="text-sm">Sign In</span>
        </button>

        {showLoginOptions && (
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={() => setShowLoginOptions(false)}
            />
            <div className="absolute right-0 mt-2 w-56 rounded-xl bg-stone-800 border border-stone-700 shadow-xl z-50 overflow-hidden">
              <div className="p-3 border-b border-stone-700">
                <p className="text-sm text-stone-400">Sign in to save your commanders</p>
              </div>
              <div className="p-2">
                <button
                  onClick={() => {
                    signInWithDiscord();
                    setShowLoginOptions(false);
                  }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-stone-700 transition-colors"
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" className="fill-[#5865F2]" />
                  </svg>
                  <span className="text-stone-200">Continue with Discord</span>
                </button>
                <button
                  onClick={() => {
                    signInWithGoogle();
                    setShowLoginOptions(false);
                  }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-stone-700 transition-colors"
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                  </svg>
                  <span className="text-stone-200">Continue with Google</span>
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    );
  }

  const displayName = user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split('@')[0] || 'Governor';
  const avatarUrl = user.user_metadata?.avatar_url;

  return (
    <div className="relative">
      <button
        onClick={() => setShowDropdown(!showDropdown)}
        className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-stone-800 transition-colors"
      >
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt={displayName}
            className="w-8 h-8 rounded-full"
          />
        ) : (
          <div className="w-8 h-8 rounded-full bg-amber-600 flex items-center justify-center">
            <User className="w-4 h-4 text-stone-900" />
          </div>
        )}
        <span className="text-sm text-stone-300 hidden sm:block">{displayName}</span>
        <ChevronDown className="w-4 h-4 text-stone-500" />
      </button>

      {showDropdown && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setShowDropdown(false)}
          />
          <div className="absolute right-0 mt-2 w-48 rounded-xl bg-stone-800 border border-stone-700 shadow-xl z-50 overflow-hidden">
            <div className="p-3 border-b border-stone-700">
              <p className="text-sm font-medium text-stone-200">{displayName}</p>
              <p className="text-xs text-stone-500 truncate">{user.email}</p>
            </div>
            <div className="p-2">
              <button
                onClick={() => {
                  signOut();
                  setShowDropdown(false);
                }}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-red-400 hover:bg-red-900/20 transition-colors"
              >
                <LogOut className="w-4 h-4" />
                <span className="text-sm">Sign Out</span>
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
