import { LucideIcon } from 'lucide-react';
import { ReactNode } from 'react';

type StatCardProps = {
  icon: LucideIcon;
  label: string;
  value: ReactNode;
  hint?: string;
  className?: string;
};

export default function StatCard({ icon: Icon, label, value, hint, className = '' }: StatCardProps) {
  return (
    <article className={`rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:border-white/10 dark:bg-[#141414] dark:shadow-[0_10px_30px_rgba(0,0,0,0.35)] dark:hover:bg-[#181818] ${className}`.trim()}>
      <div className="mb-3 flex items-center gap-3">
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-orange-50 text-orange-600 ring-1 ring-orange-100 dark:bg-orange-500/10 dark:text-orange-300 dark:ring-orange-500/20">
          <Icon className="h-5 w-5" />
        </span>
        <span className="text-sm font-semibold text-slate-700 dark:text-zinc-200">{label}</span>
      </div>
      <p className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">{value}</p>
      {hint && <p className="mt-2 text-xs text-slate-500 dark:text-zinc-500">{hint}</p>}
    </article>
  );
}
