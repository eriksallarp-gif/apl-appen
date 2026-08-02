import { ReactNode } from 'react';

type SectionCardProps = {
  children: ReactNode;
  className?: string;
};

export default function SectionCard({ children, className = '' }: SectionCardProps) {
  return (
    <section
      className={`rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-[#141414] dark:shadow-[0_10px_30px_rgba(0,0,0,0.35)] ${className}`.trim()}
    >
      {children}
    </section>
  );
}
