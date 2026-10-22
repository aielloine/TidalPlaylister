import { Logo, Wordmark } from "@/components/ui";

// Onde décorative du bas d'écran, du lilas à l'aqua (ou l'inverse).
function wave(reverse: boolean) {
  const n = 120;
  return Array.from({ length: n }, (_, i) => {
    const t = i / (n - 1);
    const h = Math.round(6 + 120 * Math.sin(Math.PI * t) * Math.abs(Math.sin(i * 0.43) * 0.6 + Math.sin(i * 0.11) * 0.4));
    const u = reverse ? 1 - t : t;
    return { h: Math.max(4, h), c: `rgb(${Math.round(46 + 120 * u)},${Math.round(230 - 75 * u)},${Math.round(214 + 41 * u)})` };
  });
}

export default function AuthCard({ title, badge, intro, lilac, children }: { title: string; badge?: string; intro?: string; lilac?: boolean; children: React.ReactNode }) {
  const [a, b] = lilac ? ["166,155,255", "46,230,214"] : ["46,230,214", "166,155,255"];
  return (
    <div
      className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 pb-[200px] pt-12"
      style={{ background: `radial-gradient(700px 420px at 50% 20%, rgba(${a},0.09), transparent 70%), radial-gradient(600px 360px at 80% 90%, rgba(${b},0.08), transparent 70%), #0b0d10` }}
    >
      <div aria-hidden="true" className="absolute inset-x-0 bottom-10 flex h-[140px] items-center justify-center gap-[5px] opacity-30">
        {wave(!!lilac).map((x, i) => (
          <span key={i} className="w-[5px] flex-none rounded-[3px]" style={{ height: x.h, background: x.c }} />
        ))}
      </div>
      <main className="relative flex w-full max-w-[420px] flex-col gap-7">
        <div className="flex flex-col items-center gap-3.5">
          <Logo size={56} />
          <Wordmark size={26} />
        </div>
        <section
          aria-labelledby="auth-title"
          className="flex flex-col gap-5 rounded-3xl border border-[#232831] bg-stage/90 p-7 shadow-[0_40px_80px_-40px_rgba(0,0,0,0.9)]"
        >
          <div className="flex flex-col gap-1.5">
            {badge && (
              <span className="inline-flex h-6 items-center self-start rounded-full bg-lilac/14 px-2.5 text-xs font-semibold text-lilac-soft">{badge}</span>
            )}
            <h1 id="auth-title" className="m-0 font-display text-[22px] font-semibold leading-[1.2] tracking-tight">
              {title}
            </h1>
            {intro && <p className="m-0 text-sm text-dim">{intro}</p>}
          </div>
          {children}
        </section>
      </main>
    </div>
  );
}
