import { redirect } from 'next/navigation';

export default function FunktionerPage() {
  redirect('/ny-hemsida-funktioner');
}

function RoleSection({
  title,
  intro,
  imageAlt,
  imageSrc,
  icon,
  iconBg,
  iconColor,
  points,
  reverse,
}: {
  title: string;
  intro: string;
  imageAlt: string;
  imageSrc: string;
  icon: string;
  iconBg: string;
  iconColor: string;
  points: Array<{ icon: string; heading: string; text: string }>;
  reverse?: boolean;
}) {
  return (
    <div className="mx-auto max-w-7xl px-6 py-8">
      <div className={['flex flex-col gap-8 md:flex-row md:items-stretch', reverse ? 'md:flex-row-reverse' : ''].join(' ')}>
        <div className="md:basis-[48%]">
          <div className="h-full rounded-lg bg-white p-10 shadow-sm">
            <div className={['mb-8 flex h-12 w-12 items-center justify-center rounded-lg', iconBg].join(' ')}>
              <span className={['material-symbols-outlined text-2xl', iconColor].join(' ')}>{icon}</span>
            </div>
            <h2 className="mb-4 text-3xl font-bold tracking-tight text-[#191c1e]">{title}</h2>
            <p className="mb-8 text-[#584237]">{intro}</p>
            <div className="space-y-4">
              {points.map((point) => (
                <div key={point.heading} className="flex gap-4">
                  <span className="material-symbols-outlined text-[#f97316]">{point.icon}</span>
                  <div>
                    <p className="font-bold">{point.heading}</p>
                    <p className="text-sm text-[#584237]">{point.text}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="md:basis-[52%]">
          <div className="h-full min-h-[360px] overflow-hidden rounded-lg bg-[#e6e8ea] md:min-h-[420px]">
            <img alt={imageAlt} className="block h-full w-full object-cover" src={imageSrc} />
          </div>
        </div>
      </div>
    </div>
  );
}