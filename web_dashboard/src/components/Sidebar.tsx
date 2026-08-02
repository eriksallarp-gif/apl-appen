'use client';

import Link from 'next/link';
import { LucideIcon, X } from 'lucide-react';

type MenuItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  bold?: boolean;
  match: (path: string) => boolean;
};

type SidebarProps = {
  pathname: string;
  menuItems: MenuItem[];
  roleLabel: string;
  open: boolean;
  onClose: () => void;
};

function MenuList({ pathname, menuItems, onClose }: { pathname: string; menuItems: MenuItem[]; onClose?: () => void }) {
  return (
    <nav className="space-y-1.5 p-1">
      {menuItems.map((item) => {
        const Icon = item.icon;
        const active = item.match(pathname);

        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onClose}
            className={`group flex min-h-[42px] items-center gap-3 rounded-xl px-3.5 py-2 text-[14px] leading-5 transition ${
              item.bold ? 'font-semibold' : 'font-medium'
            } ${
              active
                ? 'border border-orange-300 bg-orange-50 text-orange-700 ring-1 ring-orange-200/70 dark:border-orange-500/40 dark:bg-orange-500/12 dark:text-orange-300 dark:ring-orange-500/20'
                : 'border border-transparent text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-zinc-300 dark:hover:bg-white/5 dark:hover:text-zinc-100'
            }`}
          >
            <Icon className="h-4.5 w-4.5 flex-shrink-0" />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

export default function Sidebar({ pathname, menuItems, roleLabel, open, onClose }: SidebarProps) {
  return (
    <>
      {open && (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-slate-900/45 backdrop-blur-sm lg:hidden"
          onClick={onClose}
          aria-label="Stäng meny"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 w-[280px] transform border-r border-slate-200 bg-white p-5 shadow-2xl transition-transform duration-200 dark:border-white/5 dark:bg-[#0D0D0D] lg:top-0 lg:z-30 lg:w-[280px] lg:translate-x-0 lg:shadow-none ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="mb-6 flex items-center justify-between lg:mt-2">
          <div>
            <p className="text-3xl font-bold tracking-tight text-orange-600">APL-appen</p>
            <p className="mt-1 text-xs font-medium uppercase tracking-[0.2em] text-slate-500 dark:text-zinc-500">{roleLabel}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition hover:bg-slate-100 lg:hidden dark:border-white/10 dark:text-zinc-300 dark:hover:bg-white/5"
            aria-label="Stäng sidomeny"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="max-h-[calc(100vh-7rem)] overflow-y-auto pr-1">
          <MenuList pathname={pathname} menuItems={menuItems} onClose={onClose} />
        </div>
      </aside>
    </>
  );
}
