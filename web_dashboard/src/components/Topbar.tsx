'use client';

import { LogOut, Menu } from 'lucide-react';
import ThemeSwitch from './ThemeSwitch';

type TopbarProps = {
  userEmail: string;
  onLogout: () => Promise<void> | void;
  onOpenSidebar: () => void;
};

export default function Topbar({ userEmail, onLogout, onOpenSidebar }: TopbarProps) {
  const initialsSource = userEmail.split('@')[0] || 'U';
  const initials = initialsSource
    .split(/[._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('') || initialsSource.slice(0, 2).toUpperCase();

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/90 backdrop-blur dark:border-white/5 dark:bg-[#090909]/95">
      <div className="flex h-16 w-full items-center justify-between px-4 sm:px-6 lg:px-8 xl:px-10">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onOpenSidebar}
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-slate-600 transition hover:bg-slate-100 lg:hidden dark:border-white/10 dark:text-zinc-200 dark:hover:bg-white/5"
            aria-label="Öppna meny"
          >
            <Menu className="h-5 w-5" />
          </button>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <div className="hidden items-center gap-2 rounded-xl border border-slate-200 bg-white px-2 py-1.5 sm:flex dark:border-white/10 dark:bg-[#111111]">
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-orange-100 text-xs font-semibold text-orange-700 dark:bg-orange-500/20 dark:text-orange-300">
              {initials}
            </span>
            <span className="max-w-[28vw] truncate text-sm text-slate-700 dark:text-zinc-200">{userEmail}</span>
          </div>

          <ThemeSwitch />
          <button
            type="button"
            onClick={onLogout}
            className="inline-flex items-center gap-2 rounded-xl bg-orange-600 px-3 py-2 text-sm font-semibold text-white shadow-[0_0_20px_rgba(249,115,22,0.25)] transition hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-orange-300"
          >
            <LogOut className="h-4 w-4" />
            <span className="hidden sm:inline">Logga ut</span>
          </button>
        </div>
      </div>
    </header>
  );
}
