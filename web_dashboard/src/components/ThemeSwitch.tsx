'use client';

import { Moon, Sun } from 'lucide-react';
import { useEffect, useState } from 'react';

type ThemeMode = 'light' | 'dark';

function applyTheme(mode: ThemeMode) {
  const root = document.documentElement;
  if (mode === 'dark') {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }
  localStorage.setItem('apl-theme', mode);
}

export default function ThemeSwitch() {
  const [mounted, setMounted] = useState(false);
  const [mode, setMode] = useState<ThemeMode>('light');

  useEffect(() => {
    const stored = localStorage.getItem('apl-theme');
    const initial: ThemeMode = stored === 'dark' ? 'dark' : 'light';
    setMode(initial);
    applyTheme(initial);
    setMounted(true);
  }, []);

  const toggleTheme = () => {
    const next: ThemeMode = mode === 'light' ? 'dark' : 'light';
    setMode(next);
    applyTheme(next);
  };

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-orange-300 dark:border-white/10 dark:bg-[#111111] dark:text-zinc-200 dark:hover:bg-[#181818]"
      aria-label="Byt tema"
      title={mounted && mode === 'dark' ? 'Växla till ljust läge' : 'Växla till mörkt läge'}
    >
      {mounted && mode === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  );
}
