import { ReactNode } from 'react';

type PageHeaderProps = {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  eyebrow?: string;
};

export default function PageHeader({ title, subtitle, actions, eyebrow }: PageHeaderProps) {
  return (
    <div className="mb-6 flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-[#141414] dark:shadow-[0_10px_30px_rgba(0,0,0,0.35)] md:flex-row md:items-start md:justify-between">
      <div>
        {eyebrow && <p className="text-xs font-semibold uppercase tracking-[0.2em] text-orange-600">{eyebrow}</p>}
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 dark:text-white">{title}</h1>
        {subtitle && <p className="mt-2 max-w-3xl text-sm text-slate-600 dark:text-zinc-400">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-3">{actions}</div>}
    </div>
  );
}
